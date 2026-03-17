//! The authoritative World Engine — owns simulation time, agent roster,
//! and broadcasts state to all connected clients.
//!
//! ## Architecture (Phase 4)
//!
//! `WorldState` is wrapped in `Arc<RwLock<_>>` and shared across:
//! - The **tick loop** (advances time, generates chat messages, broadcasts graph snapshots)
//! - **WebSocket handlers** (read state for bootstrap, write state for commands)

use crate::agents::AgentRuntime;
use crate::analytics::AnalyticsEngine;
use crate::memory::{MemoryCategory, MemoryStore};
use society_core::{
    channels::{
        channel_for_role, ChatMsg, GraphLink, GraphNode, GraphSnapshot as GraphSnapshotData,
        MESSAGE_TEMPLATES,
    },
    events::AgentStatusEntry,
    AgentStatus, Envelope, ServerEvent,
};
use std::sync::Arc;
use std::time::Instant;
use sysinfo::System;
use tokio::sync::{broadcast, Mutex, RwLock};
use tokio::time::{interval, Duration};
use tracing::{debug, info, warn};

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
    chat_messages: Vec<ChatMsg>,
    tick_sync_event: ServerEvent,
    graph_snapshot: Option<GraphSnapshotData>,
}

/// Spawns the authoritative tick loop. On each tick, acquires the world
/// write lock briefly to mutate state, extracts a [`TickSnapshot`], then
/// releases the lock before broadcasting events or writing to SQLite.
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
            // LOCK SCOPE: Acquire write lock, mutate state, extract
            // snapshot, DROP lock immediately. No serialization, no
            // broadcasting, no SQLite I/O inside this scope.
            // ════════════════════════════════════════════════════════════
            let (snapshot, speakers_this_tick) = {
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
                let mut speakers_this_tick: u32 = 0;
                let mut status_changes: Vec<AgentStatusEntry> = Vec::new();
                let mut chat_messages: Vec<ChatMsg> = Vec::new();

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

                    // ── Select 2-5 agents to speak (extract data only, no I/O) ──
                    drift_seed = drift_seed
                        .wrapping_mul(6364136223846793005)
                        .wrapping_add(13);
                    let speaker_count = ((drift_seed >> 33) % 4) + 2;

                    for s in 0..speaker_count {
                        drift_seed = drift_seed
                            .wrapping_mul(6364136223846793005)
                            .wrapping_add(s + 100);
                        let agent_idx = (drift_seed >> 33) as usize % agent_count;
                        let agent = &state.agents[agent_idx];

                        if !agent.status.is_awake() {
                            continue;
                        }

                        speakers_this_tick += 1;

                        drift_seed = drift_seed
                            .wrapping_mul(6364136223846793005)
                            .wrapping_add(s + 200);
                        let template_idx = (drift_seed >> 33) as usize % MESSAGE_TEMPLATES.len();

                        // These return &'static str — no heap allocation
                        let role_name = agent.profile.role.display_name();
                        let channel = channel_for_role(role_name);
                        let content = MESSAGE_TEMPLATES[template_idx];

                        chat_messages.push(ChatMsg {
                            id: format!("msg-{}-{}", tick, s),
                            agent_id: agent.id.as_str().to_string(),
                            agent_name: agent.name.clone(),
                            agent_role: role_name.to_string(),
                            agent_role_color: agent.profile.role.color_key().to_string(),
                            agent_avatar_initials: agent.name[..2].to_uppercase(),
                            channel_id: channel.to_string(),
                            content: content.to_string(),
                            timestamp: chrono::Utc::now().to_rfc3339(),
                            tick,
                            is_system_message: false,
                        });
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

                let snapshot = TickSnapshot {
                    tick,
                    seed_id,
                    awake_count,
                    total_agents: state.total_agents,
                    rust_ram: state.rust_ram,
                    is_playing: state.is_playing,
                    status_changes,
                    chat_messages,
                    tick_sync_event,
                    graph_snapshot,
                };

                (snapshot, speakers_this_tick)
            };
            // ════════════════════════════════════════════════════════════
            // LOCK RELEASED — all broadcasting, serialization, and
            // database I/O happens below without holding any lock.
            // ════════════════════════════════════════════════════════════

            let tick = snapshot.tick;

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

            // ── Broadcast chat messages + write memories ──
            // Build memory entries from ChatMsg fields — no redundant tuple clones.
            let mut mem_entries: Vec<(String, String, String)> =
                Vec::with_capacity(snapshot.chat_messages.len());
            let seed_for_mem = snapshot.seed_id.clone(); // clone once, not per-iteration

            for msg in snapshot.chat_messages {
                // Build memory text from owned fields before moving msg into the envelope
                mem_entries.push((
                    msg.agent_id.clone(),
                    format!("[Tick {}] {}: {}", tick, msg.agent_role, msg.content),
                    seed_for_mem.clone(),
                ));

                sequence += 1;
                let envelope =
                    Envelope::new(sequence, "chat.message", ServerEvent::ChatMessage { msg });
                if let Ok(json) = serde_json::to_string(&envelope) {
                    let _ = tx.send(json);
                }
            }

            // ── Offload all SQLite writes to a blocking thread ──
            if !mem_entries.is_empty() {
                let mem_handle = memory.clone();
                let tick_for_mem = tick;
                tokio::task::spawn_blocking(move || {
                    // Block on the async mutex from a sync context is safe here
                    // because we are already on a blocking thread.
                    let mem = mem_handle.blocking_lock();
                    for (agent_id, content, seed_id) in &mem_entries {
                        if let Err(e) = mem.store(
                            agent_id,
                            MemoryCategory::Observation,
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
