//! The authoritative World Engine — owns simulation time, agent roster,
//! and broadcasts state to all connected clients.
//!
//! ## Architecture (Phase 4 — Social Fabric)
//!
//! `WorldState` is wrapped in `Arc<RwLock<_>>` and shared across:
//! - The **tick loop** (advances time, generates chat messages, broadcasts graph snapshots)
//! - **WebSocket handlers** (read state for bootstrap, write state for commands)
//!
//! ### Social Fabric extensions
//! - `channel_history` — per-channel ring buffer of the last 20 messages for context injection.
//! - `mention_queue` — reactive scheduler queue of `(AgentId, ExpirationTick)` tuples.

use crate::agents::{assemble_prompt, AgentRuntime};
use crate::analytics::AnalyticsEngine;
use crate::llm::{self, SpeakerContext};
use crate::memory::{MemoryCategory, MemoryStore};
use regex::Regex;
use society_core::{
    channels::{
        channel_for_role, ChatMsg, GraphLink, GraphNode, GraphSnapshot as GraphSnapshotData,
        MESSAGE_TEMPLATES,
    },
    events::AgentStatusEntry,
    AgentStatus, Envelope, ServerEvent,
};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;
use std::time::Instant;
use sysinfo::System;
use tokio::sync::{broadcast, Mutex, RwLock};
use tokio::time::{interval, Duration};
use tracing::{debug, info, warn};

/// Maximum number of messages retained per channel in the volatile ring buffer.
const CHANNEL_HISTORY_CAPACITY: usize = 20;

/// Maximum number of speakers per tick (priority + backfill combined).
const MAX_SPEAKERS_PER_TICK: usize = 5;

/// How many ticks a mention remains valid in the reactive scheduler queue.
const MENTION_TTL: u64 = 3;

/// The authoritative simulation state.
#[derive(Debug, Clone)]
pub struct WorldState {
    pub is_playing: bool,
    pub current_tick: u64,
    pub total_agents: u32,
    pub rust_ram: u32,
    /// Unique identifier for the current scenario run (incremented on seed injection).
    pub seed_id: String,
    /// The live agent roster spawned during genesis.
    pub agents: Vec<AgentRuntime>,

    // ── Social Fabric (Phase 1) ──────────────────────────────────────
    /// Per-channel ring buffer of the last N messages, used for context
    /// injection into the LLM prompt assembly.
    pub channel_history: HashMap<String, VecDeque<ChatMsg>>,

    /// Reactive scheduler queue — agents mentioned via `@AGT-XXX` are
    /// pushed here with an expiration tick so they are prioritised as
    /// speakers in upcoming ticks.
    pub mention_queue: VecDeque<(String, u64)>,
}

impl WorldState {
    /// Create a new WorldState with a spawned agent roster.
    pub fn with_agents(agents: Vec<AgentRuntime>) -> Self {
        let total = agents.len() as u32;
        Self {
            is_playing: false,
            current_tick: 0,
            total_agents: total,
            rust_ram: 45,
            seed_id: format!(
                "seed-genesis-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            ),
            agents,
            channel_history: HashMap::new(),
            mention_queue: VecDeque::new(),
        }
    }

    /// Apply a seed injection — resets the world clock, agent statuses, and generates a new seed_id.
    ///
    /// Returns the new `seed_id` for event broadcasting.
    pub fn apply_seed(&mut self) -> String {
        // Pause and reset
        self.is_playing = false;
        self.current_tick = 0;
        self.rust_ram = 45;

        // Generate new seed_id
        self.seed_id = format!(
            "seed-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        );

        // Reset all agents to baseline Awake status
        for agent in &mut self.agents {
            agent.status = AgentStatus::Awake;
        }

        // Flush Social Fabric state
        self.channel_history.clear();
        self.mention_queue.clear();

        self.seed_id.clone()
    }

    /// Count agents in awake-equivalent states.
    pub fn awake_count(&self) -> u32 {
        self.agents.iter().filter(|a| a.status.is_awake()).count() as u32
    }

    /// Create a `TickSync` server event.
    pub fn to_tick_sync(&self) -> ServerEvent {
        ServerEvent::TickSync {
            is_playing: self.is_playing,
            current_tick: self.current_tick,
            awake_agents: self.awake_count(),
            total_agents: self.total_agents,
            rust_ram: self.rust_ram,
        }
    }

    /// Create a `WorldBootstrap` server event.
    pub fn to_bootstrap(&self) -> ServerEvent {
        ServerEvent::WorldBootstrap {
            is_playing: self.is_playing,
            current_tick: self.current_tick,
            awake_agents: self.awake_count(),
            total_agents: self.total_agents,
            rust_ram: self.rust_ram,
        }
    }

    /// Build a graph snapshot from the current agent roster.
    pub fn to_graph_snapshot(&self) -> GraphSnapshotData {
        let nodes: Vec<GraphNode> = self
            .agents
            .iter()
            .map(|a| GraphNode {
                id: a.id.as_str().to_string(),
                name: a.name.clone(),
                val: match a.profile.role {
                    society_core::AgentRole::Ceo | society_core::AgentRole::Cto => 8,
                    society_core::AgentRole::Finance | society_core::AgentRole::Legal => 5,
                    society_core::AgentRole::Engineer | society_core::AgentRole::Researcher => 4,
                    society_core::AgentRole::Analyst => 3,
                    society_core::AgentRole::Consumer => 2,
                },
                group: a.profile.role.display_name().to_string(),
                status: if a.status.is_awake() {
                    "Awake".to_string()
                } else {
                    "Sleeping".to_string()
                },
            })
            .collect();

        // Generate deterministic links — each agent connects to 1-3 nearby agents
        let mut links = Vec::new();
        let count = self.agents.len();
        for (i, agent) in self.agents.iter().enumerate() {
            // Connect to the next agent (circular)
            if count > 1 {
                let next = (i + 1) % count;
                links.push(GraphLink {
                    source: agent.id.as_str().to_string(),
                    target: self.agents[next].id.as_str().to_string(),
                });
            }
            // Leaders connect to a few more agents
            if matches!(
                agent.profile.role,
                society_core::AgentRole::Ceo | society_core::AgentRole::Cto
            ) && count > 10
            {
                for offset in [5, 10, 20] {
                    let target_idx = (i + offset) % count;
                    links.push(GraphLink {
                        source: agent.id.as_str().to_string(),
                        target: self.agents[target_idx].id.as_str().to_string(),
                    });
                }
            }
        }

        GraphSnapshotData { nodes, links }
    }
}

impl Default for WorldState {
    fn default() -> Self {
        Self {
            is_playing: false,
            current_tick: 0,
            total_agents: 0,
            rust_ram: 45,
            seed_id: "seed-default".to_string(),
            agents: Vec::new(),
            channel_history: HashMap::new(),
            mention_queue: VecDeque::new(),
        }
    }
}

/// Thread-safe handle to the world state.
pub type SharedWorld = Arc<RwLock<WorldState>>;

/// Broadcast sender for server events.
pub type EventTx = broadcast::Sender<String>;

/// Thread-safe handle for the memory store (rusqlite Connection is !Send).
pub type SharedMemory = Arc<Mutex<MemoryStore>>;

/// Lightweight snapshot extracted under the write lock for use after releasing it.
#[allow(dead_code)]
struct TickSnapshot {
    tick: u64,
    seed_id: String,
    awake_count: u32,
    total_agents: u32,
    rust_ram: u32,
    is_playing: bool,
    status_changes: Vec<AgentStatusEntry>,
    /// Speaker contexts extracted under the lock for lock-free async inference.
    speaker_contexts: Vec<SpeakerSlot>,
    tick_sync_event: ServerEvent,
    graph_snapshot: Option<GraphSnapshotData>,
}

/// All the owned data needed to run LLM inference for one speaker
/// and then construct a `ChatMsg` from the result.
struct SpeakerSlot {
    /// Index within the tick's speaker list (for msg ID generation).
    slot_index: u64,
    agent_id: String,
    agent_name: String,
    agent_role: String,
    agent_role_color: String,
    agent_avatar_initials: String,
    channel_id: String,
    /// If this speaker was selected because of an @-mention, this holds
    /// the mentioner's AgentId (e.g., "AGT-042") for JIT memory recall.
    mentioned_by: Option<String>,
    /// Fully-owned LLM inference context.
    llm_ctx: SpeakerContext,
}

/// Format a channel's message ring buffer into a newline-separated transcript.
/// This is called at most **once per channel per tick** via the transcript cache.
fn format_channel_transcript(buf: &VecDeque<ChatMsg>) -> String {
    buf.iter()
        .map(|m| {
            format!(
                "[{}] {} ({}): {}",
                m.agent_id, m.agent_name, m.agent_role, m.content
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Resolve the formatted transcript for `channel` from the cache,
/// populating it on first access. Returns `None` if the channel has
/// no history.
fn cached_transcript<'a>(
    cache: &'a mut HashMap<String, String>,
    channel: &str,
    channel_history: &HashMap<String, VecDeque<ChatMsg>>,
) -> Option<&'a str> {
    if !cache.contains_key(channel) {
        if let Some(buf) = channel_history.get(channel).filter(|b| !b.is_empty()) {
            cache.insert(channel.to_string(), format_channel_transcript(buf));
        }
    }
    cache.get(channel).map(|s| s.as_str())
}

/// Build a [`SpeakerSlot`] from an agent reference by extracting all owned
/// data needed for lock-free async inference. Returns `None` only if the
/// agent has an impossible state (should not happen in practice).
///
/// `channel_transcript` is the **pre-formatted** transcript string for the
/// agent's channel, resolved via the per-tick transcript cache so that
/// `Vec.join("\n")` is never called more than once per channel per tick.
fn build_speaker_slot(
    agent: &AgentRuntime,
    channel_transcript: Option<&str>,
    active_roster: Option<&str>,
    slot_index: u64,
    drift_seed: &mut u64,
) -> Option<SpeakerSlot> {
    let role_name = agent.profile.role.display_name();
    let channel = channel_for_role(role_name);

    // Assemble the dynamic prompt with pre-cached channel context + roster
    let dynamic_prompt = assemble_prompt(
        &agent.profile,
        None,
        channel_transcript,
        active_roster,
        None,
    );

    // Deterministic fallback index
    *drift_seed = drift_seed
        .wrapping_mul(6364136223846793005)
        .wrapping_add(slot_index + 200);
    let template_idx = (*drift_seed >> 33) as usize % MESSAGE_TEMPLATES.len();

    Some(SpeakerSlot {
        slot_index,
        agent_id: agent.id.as_str().to_string(),
        agent_name: agent.name.clone(),
        agent_role: role_name.to_string(),
        agent_role_color: agent.profile.role.color_key().to_string(),
        agent_avatar_initials: agent.name[..2].to_uppercase(),
        channel_id: channel.to_string(),
        mentioned_by: None,
        llm_ctx: SpeakerContext {
            agent_name: agent.name.clone(),
            agent_role: role_name.to_string(),
            system_prompt: dynamic_prompt.system_prompt,
            provider_endpoint: agent.provider.primary_endpoint.clone(),
            model: agent.provider.model.clone(),
            max_retries: agent.provider.max_retries,
            fallback_template_idx: template_idx,
        },
    })
}

/// Spawns the authoritative tick loop. On each tick:
///
/// 1. **Lock Scope 1 (fast):** Acquire write lock → advance tick → drift statuses
///    → select speakers → extract `SpeakerContext` with channel history → drop lock.
/// 2. **Async Inference (lock-free):** Run LLM inference concurrently for all speakers.
/// 3. **Lock Scope 2 (fast):** Re-acquire write lock → commit messages to channel
///    history ring buffers → drop lock.
/// 4. **Broadcast & Persist (lock-free):** Serialize and broadcast events, offload
///    SQLite writes to a blocking thread.
pub fn spawn_tick_loop(world: SharedWorld, tx: EventTx, memory: SharedMemory) {
    tokio::spawn(async move {
        let mut tick_interval = interval(Duration::from_millis(1500));
        let mut sequence: u64 = 0;
        let mut drift_seed: u64 = 42;
        let mut analytics = AnalyticsEngine::new();
        let mut sys = System::new_all();

        loop {
            tick_interval.tick().await;
            let tick_start = Instant::now();

            // ════════════════════════════════════════════════════════════
            // LOCK SCOPE 1: Acquire write lock, mutate state, extract
            // speaker contexts. DROP lock before any network I/O.
            // ════════════════════════════════════════════════════════════
            let snapshot = {
                let mut state = world.write().await;

                // Dynamically track actual server RAM usage
                sys.refresh_memory();
                let used_ram_mb = (sys.used_memory() / 1024 / 1024) as u32;
                state.rust_ram = used_ram_mb;

                if !state.is_playing {
                    continue;
                }

                // Advance tick
                state.current_tick += 1;
                let tick = state.current_tick;
                let seed_id = state.seed_id.clone();
                let agent_count = state.agents.len();
                let mut status_changes: Vec<AgentStatusEntry> = Vec::new();
                let mut speaker_contexts: Vec<SpeakerSlot> = Vec::new();

                if agent_count > 0 {
                    // ── Deterministic agent status drift ──
                    for i in 0..3 {
                        drift_seed = drift_seed
                            .wrapping_mul(6364136223846793005)
                            .wrapping_add(i + 1);
                        let idx = (drift_seed >> 33) as usize % agent_count;
                        drift_seed = drift_seed.wrapping_mul(6364136223846793005).wrapping_add(7);
                        let status_roll = (drift_seed >> 33) % 10;
                        let new_status = match status_roll {
                            0..=5 => AgentStatus::Awake,
                            6..=7 => AgentStatus::Processing,
                            8 => AgentStatus::Idle,
                            _ => AgentStatus::Suspended,
                        };

                        if state.agents[idx].status != new_status {
                            state.agents[idx].status = new_status;
                            status_changes.push(AgentStatusEntry {
                                agent_id: state.agents[idx].id.as_str().to_string(),
                                status: format!("{:?}", state.agents[idx].status).to_lowercase(),
                            });
                        }
                    }

                    // ══════════════════════════════════════════════════════
                    // PRIORITY SPEAKER SELECTION (Social Fabric Phase 3)
                    //
                    // 1. Drain mention_queue: pop agents that were @-mentioned
                    //    in recent ticks and still have valid TTL.
                    // 2. Backfill: fill remaining slots using random drift_seed.
                    // ══════════════════════════════════════════════════════
                    let mut selected_ids: HashSet<String> = HashSet::new();
                    let mut slot_counter: u64 = 0;

                    // ── Per-tick transcript cache ──────────────────────────
                    // Formatted channel history strings are cached here so
                    // that `Vec.join("\n")` runs at most ONCE per active
                    // channel, regardless of how many speakers share it.
                    let mut transcript_cache: HashMap<String, String> = HashMap::new();

                    // ── Per-channel roster cache ──────────────────────────
                    // Formatted lists of awake peers per channel, built once.
                    let mut roster_cache: HashMap<String, String> = HashMap::new();
                    for a in &state.agents {
                        if a.status.is_awake() {
                            let ch = channel_for_role(a.profile.role.display_name()).to_string();
                            let entry = roster_cache.entry(ch).or_default();
                            if !entry.is_empty() {
                                entry.push_str(", ");
                            }
                            entry.push_str(&format!(
                                "@{} ({})",
                                a.id.as_str(),
                                a.profile.role.display_name()
                            ));
                        }
                    }

                    // ── Step 1: Drain mention_queue for priority speakers ──
                    let mut remaining_queue: VecDeque<(String, u64)> = VecDeque::new();
                    while let Some((mentioned_id, expiry)) = state.mention_queue.pop_front() {
                        // Discard expired entries
                        if expiry < tick {
                            continue;
                        }
                        // Cap at MAX_SPEAKERS_PER_TICK
                        if speaker_contexts.len() >= MAX_SPEAKERS_PER_TICK {
                            remaining_queue.push_back((mentioned_id, expiry));
                            continue;
                        }
                        // Skip if already selected
                        if selected_ids.contains(&mentioned_id) {
                            continue;
                        }
                        // Find the agent in the roster
                        if let Some(agent) =
                            state.agents.iter().find(|a| a.id.as_str() == mentioned_id)
                        {
                            if agent.status.is_awake() {
                                let ch = channel_for_role(agent.profile.role.display_name());
                                let transcript = cached_transcript(
                                    &mut transcript_cache,
                                    ch,
                                    &state.channel_history,
                                );
                                let roster = roster_cache.get(ch).map(|s| s.as_str());
                                if let Some(mut slot) = build_speaker_slot(
                                    agent,
                                    transcript,
                                    roster,
                                    slot_counter,
                                    &mut drift_seed,
                                ) {
                                    // Tag this slot as mention-triggered for JIT recall
                                    slot.mentioned_by = Some(mentioned_id.clone());
                                    selected_ids.insert(mentioned_id);
                                    speaker_contexts.push(slot);
                                    slot_counter += 1;
                                }
                            } else {
                                // Agent not awake — re-queue for the next tick
                                remaining_queue.push_back((mentioned_id, expiry));
                            }
                        }
                    }
                    // Put unprocessed entries back
                    state.mention_queue = remaining_queue;

                    // ── Step 2: Backfill with random drift_seed selection ──
                    drift_seed = drift_seed
                        .wrapping_mul(6364136223846793005)
                        .wrapping_add(13);
                    let desired_count = (((drift_seed >> 33) % 4) + 2) as usize;
                    let backfill_target = desired_count.min(MAX_SPEAKERS_PER_TICK);

                    let mut backfill_attempts: u64 = 0;
                    while speaker_contexts.len() < backfill_target && backfill_attempts < 20 {
                        drift_seed = drift_seed
                            .wrapping_mul(6364136223846793005)
                            .wrapping_add(backfill_attempts + 100);
                        let agent_idx = (drift_seed >> 33) as usize % agent_count;
                        let agent = &state.agents[agent_idx];
                        let agent_id_str = agent.id.as_str().to_string();

                        backfill_attempts += 1;

                        if !agent.status.is_awake() || selected_ids.contains(&agent_id_str) {
                            continue;
                        }

                        let ch = channel_for_role(agent.profile.role.display_name());
                        let transcript =
                            cached_transcript(&mut transcript_cache, ch, &state.channel_history);
                        let roster = roster_cache.get(ch).map(|s| s.as_str());
                        if let Some(slot) = build_speaker_slot(
                            agent,
                            transcript,
                            roster,
                            slot_counter,
                            &mut drift_seed,
                        ) {
                            selected_ids.insert(agent_id_str);
                            speaker_contexts.push(slot);
                            slot_counter += 1;
                        }
                    }
                }

                // RAM drift (small mutation, stay inside lock)
                drift_seed = drift_seed.wrapping_mul(6364136223846793005).wrapping_add(1);
                let ram_drift = ((drift_seed >> 33) as i32) % 3;
                state.rust_ram = state
                    .rust_ram
                    .saturating_add_signed(ram_drift)
                    .clamp(30, 120);

                let awake_count = state.awake_count();
                let tick_sync_event = state.to_tick_sync();
                let graph_snapshot = if tick % 5 == 0 {
                    Some(state.to_graph_snapshot())
                } else {
                    None
                };

                TickSnapshot {
                    tick,
                    seed_id,
                    awake_count,
                    total_agents: state.total_agents,
                    rust_ram: state.rust_ram,
                    is_playing: state.is_playing,
                    status_changes,
                    speaker_contexts,
                    tick_sync_event,
                    graph_snapshot,
                }
            };
            // ════════════════════════════════════════════════════════════
            // LOCK RELEASED — async LLM inference runs lock-free.
            // ════════════════════════════════════════════════════════════

            let tick = snapshot.tick;
            let speakers_this_tick = snapshot.speaker_contexts.len() as u32;

            // ── Broadcast batched status changes ──
            if !snapshot.status_changes.is_empty() {
                sequence += 1;
                let batch_envelope = Envelope::new(
                    sequence,
                    "agent.status.batch",
                    ServerEvent::AgentStatusBatch {
                        changes: snapshot.status_changes,
                    },
                );
                if let Ok(json) = serde_json::to_string(&batch_envelope) {
                    let _ = tx.send(json);
                }
            }

            // ════════════════════════════════════════════════════════════
            // JIT RELATIONAL MEMORY QUERY (Social Fabric Phase 4)
            // For mention-triggered speakers, fetch past interactions
            // with the mentioner via spawn_blocking, then re-assemble
            // their prompt with relationship context.
            // ════════════════════════════════════════════════════════════
            let mut speaker_contexts = snapshot.speaker_contexts;
            let seed_id_for_recall = snapshot.seed_id.clone();

            // Collect indices of mention-triggered speakers
            let mention_indices: Vec<(usize, String)> = speaker_contexts
                .iter()
                .enumerate()
                .filter_map(|(i, slot)| {
                    slot.mentioned_by
                        .as_ref()
                        .map(|mentioner| (i, mentioner.clone()))
                })
                .collect();

            if !mention_indices.is_empty() {
                // Dispatch all relational memory queries concurrently
                let mut recall_futures = Vec::with_capacity(mention_indices.len());
                for (idx, mentioner_id) in &mention_indices {
                    let mem_handle = memory.clone();
                    let agent_id = speaker_contexts[*idx].agent_id.clone();
                    let peer_id = mentioner_id.clone();
                    let seed = seed_id_for_recall.clone();

                    recall_futures.push(tokio::task::spawn_blocking(move || {
                        let mem = mem_handle.blocking_lock();
                        mem.recall_peer_conversations(&agent_id, &peer_id, &seed, 5)
                            .unwrap_or_default()
                    }));
                }

                // Await all recall results
                let recall_results = futures_util::future::join_all(recall_futures).await;

                // Inject relationship context into the speaker's LLM prompt
                for ((idx, _mentioner_id), recall_result) in
                    mention_indices.into_iter().zip(recall_results.into_iter())
                {
                    if let Ok(entries) = recall_result {
                        if !entries.is_empty() {
                            let context_text: String = entries
                                .iter()
                                .map(|e| e.content.clone())
                                .collect::<Vec<_>>()
                                .join("\n");

                            // Re-assemble the prompt with relationship context
                            // appended to the existing system prompt
                            let existing_prompt = &speaker_contexts[idx].llm_ctx.system_prompt;
                            speaker_contexts[idx].llm_ctx.system_prompt = format!(
                                "{}\n\n## Relationship Memory\nYour past interactions with this peer:\n{}",
                                existing_prompt, context_text
                            );

                            debug!(
                                agent = %speaker_contexts[idx].agent_id,
                                entries = entries.len(),
                                "Injected relationship memory into prompt"
                            );
                        }
                    }
                }
            }

            // ════════════════════════════════════════════════════════════
            // ASYNC LLM INFERENCE (lock-free, concurrent)
            // Each speaker's inference runs as a separate future.
            // ════════════════════════════════════════════════════════════
            let mut chat_messages: Vec<ChatMsg> = Vec::new();

            if !speaker_contexts.is_empty() {
                // Build inference futures
                let inference_futures: Vec<_> = speaker_contexts
                    .iter()
                    .map(|slot| {
                        let ctx = slot.llm_ctx.clone();
                        async move { llm::infer(&ctx).await }
                    })
                    .collect();

                // Execute all inference calls concurrently
                let results = futures_util::future::join_all(inference_futures).await;

                // Assemble ChatMsg from results + slot metadata
                for (slot, content) in speaker_contexts.iter().zip(results.into_iter()) {
                    chat_messages.push(ChatMsg {
                        id: format!("msg-{}-{}", tick, slot.slot_index),
                        agent_id: slot.agent_id.clone(),
                        agent_name: slot.agent_name.clone(),
                        agent_role: slot.agent_role.clone(),
                        agent_role_color: slot.agent_role_color.clone(),
                        agent_avatar_initials: slot.agent_avatar_initials.clone(),
                        channel_id: slot.channel_id.clone(),
                        content,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        tick,
                        is_system_message: false,
                    });
                }
            }

            // ── Broadcast chat messages + build memory entries ──
            let mut mem_entries: Vec<(String, String, String)> =
                Vec::with_capacity(chat_messages.len() * 2);
            let seed_for_mem = snapshot.seed_id.clone();
            let mut history_inserts: Vec<(String, ChatMsg)> = Vec::new();
            let cross_poll_re = Regex::new(r"@(AGT-\d+)").expect("valid mention regex");

            for msg in chat_messages {
                let sender_content = format!("[Tick {}] {}: {}", tick, msg.agent_role, msg.content);

                // ── Sender memory entry ──
                mem_entries.push((
                    msg.agent_id.clone(),
                    sender_content.clone(),
                    seed_for_mem.clone(),
                ));

                // ── Cross-pollination: write a copy into each mentioned agent's namespace ──
                let recipient_content = format!(
                    "[Tick {}] @{} ({}) directed at me: {}",
                    tick, msg.agent_id, msg.agent_role, msg.content
                );
                for cap in cross_poll_re.captures_iter(&msg.content) {
                    let mentioned_id = cap[1].to_string();
                    if mentioned_id != msg.agent_id {
                        mem_entries.push((
                            mentioned_id,
                            recipient_content.clone(),
                            seed_for_mem.clone(),
                        ));
                    }
                }

                history_inserts.push((msg.channel_id.clone(), msg.clone()));

                sequence += 1;
                let envelope =
                    Envelope::new(sequence, "chat.message", ServerEvent::ChatMessage { msg });
                if let Ok(json) = serde_json::to_string(&envelope) {
                    let _ = tx.send(json);
                }
            }

            // ════════════════════════════════════════════════════════════
            // LOCK SCOPE 2: Re-acquire write lock briefly to commit
            // messages into channel_history + extract @mentions into
            // the reactive scheduler queue.
            // ════════════════════════════════════════════════════════════
            {
                let mention_re = Regex::new(r"@(AGT-\d+)").expect("valid mention regex");
                let mut extracted_mentions: Vec<String> = Vec::new();

                // Scan all generated messages for @AGT-XXX mentions
                for msg in &history_inserts {
                    for cap in mention_re.captures_iter(&msg.1.content) {
                        let mentioned = cap[1].to_string();
                        // Don't let an agent mention itself
                        if mentioned != msg.1.agent_id {
                            extracted_mentions.push(mentioned);
                        }
                    }
                }

                let mut state = world.write().await;

                // Push channel history entries
                for (channel_id, msg) in history_inserts {
                    let buf = state
                        .channel_history
                        .entry(channel_id)
                        .or_insert_with(|| VecDeque::with_capacity(CHANNEL_HISTORY_CAPACITY + 1));
                    buf.push_back(msg);
                    while buf.len() > CHANNEL_HISTORY_CAPACITY {
                        buf.pop_front();
                    }
                }

                // Push extracted mentions into the reactive scheduler queue
                if !extracted_mentions.is_empty() {
                    let expiry = tick + MENTION_TTL;
                    for mentioned_id in extracted_mentions {
                        // Avoid duplicate entries for the same agent
                        if !state
                            .mention_queue
                            .iter()
                            .any(|(id, _)| id == &mentioned_id)
                        {
                            debug!(
                                agent = %mentioned_id,
                                expiry_tick = expiry,
                                "@mention detected, queuing for priority scheduling"
                            );
                            state.mention_queue.push_back((mentioned_id, expiry));
                        }
                    }
                }
            }

            // ── Offload all SQLite writes to a blocking thread ──
            if !mem_entries.is_empty() {
                let mem_handle = memory.clone();
                let tick_for_mem = tick;
                tokio::task::spawn_blocking(move || {
                    let mem = mem_handle.blocking_lock();
                    for (agent_id, content, seed_id) in &mem_entries {
                        if let Err(e) = mem.store(
                            agent_id,
                            MemoryCategory::Conversation,
                            content,
                            tick_for_mem,
                            seed_id,
                        ) {
                            warn!("Memory store error: {e}");
                        }
                    }
                });
            }

            // ── Compute and emit analytics (no lock needed) ──
            let analytics_point =
                analytics.compute_tick(tick, snapshot.awake_count, speakers_this_tick);
            sequence += 1;
            let analytics_envelope = Envelope::new(
                sequence,
                "analytics.tick",
                ServerEvent::AnalyticsTick {
                    tick: analytics_point.tick,
                    positive: analytics_point.positive,
                    negative: analytics_point.negative,
                    tokens: analytics_point.tokens,
                    adoption: analytics_point.adoption,
                    simulated_revenue: analytics_point.simulated_revenue,
                },
            );
            if let Ok(json) = serde_json::to_string(&analytics_envelope) {
                let _ = tx.send(json);
            }

            // ── Broadcast tick.sync ──
            sequence += 1;
            let envelope = Envelope::new(sequence, "tick.sync", snapshot.tick_sync_event);
            if let Ok(json) = serde_json::to_string(&envelope) {
                let _ = tx.send(json);
                debug!(tick, "Tick broadcast");
            }

            // ── Broadcast graph snapshot (every 5th tick) ──
            if let Some(graph_data) = snapshot.graph_snapshot {
                sequence += 1;
                let graph_envelope = Envelope::new(
                    sequence,
                    "graph.snapshot",
                    ServerEvent::GraphSnapshot { data: graph_data },
                );
                if let Ok(json) = serde_json::to_string(&graph_envelope) {
                    let _ = tx.send(json);
                    debug!(tick, "Graph snapshot broadcast");
                }
            }

            // ── Reset analytics if the seed just changed ──
            if tick == 1 {
                analytics.reset();
            }

            // ── Telemetry ──
            let tick_duration = tick_start.elapsed();
            let duration_ms = tick_duration.as_millis();

            tracing::info!(
                "[TICK PROFILER] Tick {} completed in {} ms | Awake: {} | Active Speakers: {}",
                tick,
                duration_ms,
                snapshot.awake_count,
                speakers_this_tick
            );

            if duration_ms > 1500 {
                tracing::warn!(
                    "[TICK PROFILER] ⚠️  SLIPPAGE DETECTED — Tick {} took {} ms (target: 1500ms)",
                    tick,
                    duration_ms
                );
            }
        }
    });

    info!("⏱️  Tick loop spawned (1500ms interval)");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::genesis_society;

    #[test]
    fn world_state_with_agents() {
        let agents = genesis_society();
        let state = WorldState::with_agents(agents);
        assert_eq!(state.total_agents, 1000);
        assert!(state.awake_count() > 0);
    }

    #[test]
    fn awake_count_matches_agent_states() {
        let agents = genesis_society();
        let state = WorldState::with_agents(agents);
        assert_eq!(state.awake_count(), 1000);
    }

    #[test]
    fn to_tick_sync_uses_live_awake_count() {
        let mut agents = genesis_society();
        agents[0].status = AgentStatus::Suspended;
        agents[1].status = AgentStatus::Failed;
        let state = WorldState::with_agents(agents);
        let event = state.to_tick_sync();
        if let ServerEvent::TickSync {
            awake_agents,
            total_agents,
            ..
        } = event
        {
            assert_eq!(total_agents, 1000);
            assert_eq!(awake_agents, 998);
        } else {
            panic!("expected TickSync");
        }
    }

    #[test]
    fn graph_snapshot_has_correct_node_count() {
        let agents = genesis_society();
        let state = WorldState::with_agents(agents);
        let snapshot = state.to_graph_snapshot();
        assert_eq!(snapshot.nodes.len(), 1000);
        assert!(!snapshot.links.is_empty());
    }

    #[test]
    fn graph_snapshot_leader_nodes_have_high_val() {
        let agents = genesis_society();
        let state = WorldState::with_agents(agents);
        let snapshot = state.to_graph_snapshot();
        let ceo_node = snapshot
            .nodes
            .iter()
            .find(|n| n.group == "CEO Agent")
            .unwrap();
        assert_eq!(ceo_node.val, 8);
    }

    #[tokio::test]
    async fn tick_loop_advances_monotonically() {
        let agents = genesis_society();
        let world = Arc::new(RwLock::new(WorldState {
            is_playing: true,
            ..WorldState::with_agents(agents)
        }));
        let (tx, mut rx) = broadcast::channel(256);
        let mem = Arc::new(Mutex::new(MemoryStore::new_in_memory().unwrap()));

        spawn_tick_loop(world.clone(), tx, mem);

        // Collect tick.sync events (skip chat.message events)
        let mut ticks = Vec::new();
        let mut attempts = 0;
        while ticks.len() < 2 && attempts < 20 {
            if let Ok(json) = tokio::time::timeout(Duration::from_secs(5), rx.recv()).await {
                if let Ok(envelope) = serde_json::from_str::<Envelope<ServerEvent>>(&json.unwrap())
                {
                    if let ServerEvent::TickSync { current_tick, .. } = envelope.payload {
                        ticks.push(current_tick);
                    }
                }
            }
            attempts += 1;
        }

        assert!(ticks.len() >= 2);
        for w in ticks.windows(2) {
            assert!(w[1] > w[0]);
        }
    }

    #[tokio::test]
    async fn tick_loop_pauses_when_not_playing() {
        let agents = genesis_society();
        let world = Arc::new(RwLock::new(WorldState::with_agents(agents)));
        let (tx, mut rx) = broadcast::channel(64);
        let mem = Arc::new(Mutex::new(MemoryStore::new_in_memory().unwrap()));

        spawn_tick_loop(world.clone(), tx, mem);

        let result = tokio::time::timeout(Duration::from_secs(2), rx.recv()).await;
        assert!(result.is_err());

        let state = world.read().await;
        assert_eq!(state.current_tick, 0);
    }

    #[test]
    fn apply_seed_resets_tick_and_statuses() {
        let mut agents = genesis_society();
        agents[0].status = AgentStatus::Processing;
        agents[1].status = AgentStatus::Suspended;
        agents[2].status = AgentStatus::Failed;

        let mut state = WorldState::with_agents(agents);
        state.current_tick = 500;
        state.is_playing = true;
        state.rust_ram = 100;

        let seed_id = state.apply_seed();

        assert_eq!(state.current_tick, 0);
        assert!(!state.is_playing);
        assert_eq!(state.rust_ram, 45);
        assert!(seed_id.starts_with("seed-"));
        assert_eq!(state.seed_id, seed_id);

        // All agents should be Awake
        for agent in &state.agents {
            assert_eq!(agent.status, AgentStatus::Awake);
        }
    }

    #[test]
    fn apply_seed_generates_unique_seed_ids() {
        let agents = genesis_society();
        let mut state = WorldState::with_agents(agents);
        let original_seed = state.seed_id.clone();

        let new_seed = state.apply_seed();
        assert_ne!(original_seed, new_seed);
    }
}
