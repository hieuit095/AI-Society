//! WebSocket handler for the ZeroClaw society server.
//!
//! Each connection subscribes to the shared broadcast stream and can also
//! issue commands that mutate the authoritative Rust world state.

use crate::memory::MemoryStore;
use crate::world::{current_sequence, next_sequence, EventTx, SharedSequence, SharedWorld};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use society_core::{
    channels::{AgentDetailPayload, ChatMsg},
    ClientCommand, Envelope, ServerEvent, SimulationAction,
};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

/// Type alias for the shared memory store.
pub type SharedMemory = Arc<Mutex<MemoryStore>>;

/// Shared application state injected into the WebSocket handler via Axum extractors.
#[derive(Clone)]
pub struct AppState {
    pub world: SharedWorld,
    pub event_tx: EventTx,
    pub shared_memory: SharedMemory,
    pub sequence: SharedSequence,
}

fn broadcast_event(
    event_tx: &EventTx,
    sequence: &SharedSequence,
    event_type: &'static str,
    payload: ServerEvent,
) {
    let envelope = Envelope::new(next_sequence(sequence), event_type, payload);
    if let Ok(json) = serde_json::to_string(&envelope) {
        let _ = event_tx.send(json);
    }
}

/// Axum handler that upgrades an HTTP request to a WebSocket connection.
pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    info!("WebSocket upgrade requested");
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Per-connection WebSocket handler.
async fn handle_socket(socket: WebSocket, state: AppState) {
    info!("WebSocket connection established");

    let (mut ws_sink, mut ws_stream) = socket.split();
    let mut rx = state.event_tx.subscribe();

    let bootstrap = {
        let world = state.world.read().await;
        Envelope::new(
            current_sequence(&state.sequence),
            "world.bootstrap",
            world.to_bootstrap(),
        )
    };
    if let Ok(json) = serde_json::to_string(&bootstrap) {
        if ws_sink.send(Message::Text(json.into())).await.is_err() {
            return;
        }
    }

    let outbound = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(json) => {
                    if ws_sink.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                    warn!(
                        skipped,
                        "WS client lagging - {} events dropped by broadcast",
                        skipped
                    );
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    let inbound = tokio::spawn({
        let world = state.world.clone();
        let event_tx = state.event_tx.clone();
        let shared_memory = state.shared_memory.clone();
        let sequence = state.sequence.clone();

        async move {
            while let Some(Ok(msg)) = ws_stream.next().await {
                match msg {
                    Message::Text(text) => {
                        debug!("Received: {text}");

                        let envelope: Envelope<ClientCommand> = match serde_json::from_str(&text) {
                            Ok(env) => env,
                            Err(e) => {
                                warn!("Invalid envelope: {e}");
                                continue;
                            }
                        };

                        match envelope.payload {
                            ClientCommand::Echo { message } => {
                                info!("Echo: {message}");
                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "echo",
                                    ServerEvent::Echo { message },
                                );
                            }
                            ClientCommand::SimulationControl { action } => {
                                let sync = {
                                    let mut w = world.write().await;
                                    match action {
                                        SimulationAction::Play => {
                                            info!("Simulation PLAY");
                                            w.is_playing = true;
                                        }
                                        SimulationAction::Pause => {
                                            info!("Simulation PAUSE");
                                            w.is_playing = false;
                                        }
                                    }
                                    w.to_tick_sync()
                                };

                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "tick.sync",
                                    sync,
                                );
                            }
                            ClientCommand::InspectAgent { agent_id } => {
                                info!("Inspect agent: {agent_id}");
                                let detail = {
                                    let w = world.read().await;
                                    w.agents
                                        .iter()
                                        .find(|agent| agent.id.as_str() == agent_id)
                                        .map(|agent| AgentDetailPayload {
                                            agent_id: agent.id.as_str().to_string(),
                                            name: agent.name.clone(),
                                            role: agent.profile.role.display_name().to_string(),
                                            role_color: agent.profile.role.color_key().to_string(),
                                            avatar_initials: agent.name[..2].to_uppercase(),
                                            status: format!("{:?}", agent.status).to_lowercase(),
                                            last_tick: agent.last_tick,
                                            model: agent.provider.model.clone(),
                                            tier: format!("{:?}", agent.provider.tier).to_lowercase(),
                                            tokens_per_tick: agent.last_token_burn,
                                            tools: agent.profile.tool_bounds.clone(),
                                            thought_log: agent.thought_log.iter().cloned().collect(),
                                        })
                                };

                                if let Some(detail) = detail {
                                    broadcast_event(
                                        &event_tx,
                                        &sequence,
                                        "agent.detail",
                                        ServerEvent::AgentDetail { detail },
                                    );
                                } else {
                                    warn!("Agent not found: {agent_id}");
                                }
                            }
                            ClientCommand::InjectSeed {
                                title,
                                audience,
                                context,
                            } => {
                                info!(
                                    "Seed injection: title=\"{title}\", audience=\"{audience}\""
                                );

                                let (seed_id, total_agents, bootstrap) = {
                                    let mut w = world.write().await;
                                    let seed_id = w.apply_seed();
                                    w.is_playing = true;
                                    (seed_id, w.total_agents, w.to_bootstrap())
                                };

                                {
                                    let mem = shared_memory.lock().await;
                                    if let Err(e) = mem.purge_all() {
                                        warn!("Failed to purge memory store: {e}");
                                    }
                                }

                                let system_msg = ChatMsg {
                                    id: format!("sys-seed-{seed_id}"),
                                    agent_id: "system".to_string(),
                                    agent_name: "SYSTEM".to_string(),
                                    agent_role: "DIRECTIVE".to_string(),
                                    agent_role_color: "rose".to_string(),
                                    agent_avatar_initials: "SY".to_string(),
                                    channel_id: "board-room".to_string(),
                                    content: format!(
                                        ">>> NEW SEED DIRECTIVE INJECTED: \"{}\". TARGET AUDIENCE: {}. CONTEXT: {}. ALL PRIOR CONTEXT PURGED. RE-INITIALIZING {} AGENTS. SIMULATION CLOCK RESET TO T+0.",
                                        title, audience, context, total_agents
                                    ),
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                    tick: 0,
                                    is_system_message: true,
                                };

                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "seed.applied",
                                    ServerEvent::SeedApplied {
                                        seed_id: seed_id.clone(),
                                        title: title.clone(),
                                        system_message: system_msg,
                                    },
                                );
                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "world.bootstrap",
                                    bootstrap,
                                );

                                info!(
                                    "Seed applied: seed_id={}, title=\"{}\", agents reset, tick loop resumed",
                                    seed_id, title
                                );
                            }
                            ClientCommand::RequestResync => {
                                info!("Client requested resync");
                                let (bootstrap, graph_data) = {
                                    let w = world.read().await;
                                    (w.to_bootstrap(), w.to_graph_snapshot())
                                };

                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "world.bootstrap",
                                    bootstrap,
                                );
                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "graph.snapshot",
                                    ServerEvent::GraphSnapshot { data: graph_data },
                                );
                            }
                            ClientCommand::SpawnSingle => {
                                info!("Single agent spawn requested");
                                let (new_total, sync, graph_data) = {
                                    let mut w = world.write().await;
                                    let next_idx = w.agents.len() as u32 + 1;
                                    let mut drift = next_idx as u64
                                        ^ std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_nanos() as u64;

                                    let agent = crate::genesis::generate_random_agent(
                                        society_core::AgentTier::Citizen,
                                        next_idx,
                                        &mut drift,
                                    );
                                    w.agents.push(agent);
                                    w.total_agents = w.agents.len() as u32;

                                    (w.total_agents, w.to_tick_sync(), w.to_graph_snapshot())
                                };

                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "genesis.result",
                                    ServerEvent::GenesisResult {
                                        spawned_count: 1,
                                        elite_count: 0,
                                        citizen_count: 1,
                                        new_total,
                                    },
                                );
                                broadcast_event(&event_tx, &sequence, "tick.sync", sync);
                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "graph.snapshot",
                                    ServerEvent::GraphSnapshot { data: graph_data },
                                );
                            }
                            ClientCommand::SpawnBulk { count, elite_ratio } => {
                                let clamped_count = count.min(1000);
                                info!(
                                    "Bulk spawn: count={}, elite_ratio={:.2}",
                                    clamped_count, elite_ratio
                                );

                                let (elite_count, citizen_count, new_total, sync, graph_data) = {
                                    let mut w = world.write().await;
                                    let starting_idx = w.agents.len() as u32 + 1;
                                    let mut drift = starting_idx as u64
                                        ^ std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_nanos() as u64;

                                    let new_agents = crate::genesis::spawn_batch(
                                        clamped_count,
                                        elite_ratio,
                                        starting_idx,
                                        &mut drift,
                                    );

                                    let elite_count = new_agents
                                        .iter()
                                        .filter(|agent| {
                                            agent.provider.tier == society_core::AgentTier::Elite
                                        })
                                        .count() as u32;
                                    let citizen_count = clamped_count - elite_count;

                                    w.agents.extend(new_agents);
                                    w.total_agents = w.agents.len() as u32;

                                    (
                                        elite_count,
                                        citizen_count,
                                        w.total_agents,
                                        w.to_tick_sync(),
                                        w.to_graph_snapshot(),
                                    )
                                };

                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "genesis.result",
                                    ServerEvent::GenesisResult {
                                        spawned_count: clamped_count,
                                        elite_count,
                                        citizen_count,
                                        new_total,
                                    },
                                );
                                broadcast_event(&event_tx, &sequence, "tick.sync", sync);
                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "graph.snapshot",
                                    ServerEvent::GraphSnapshot { data: graph_data },
                                );
                            }
                            ClientCommand::SaveSnapshot => {
                                info!("Snapshot save requested");
                                let snapshot_data = {
                                    let w = world.read().await;
                                    w.generate_snapshot()
                                };

                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "snapshot.data",
                                    ServerEvent::SnapshotData {
                                        snapshot: snapshot_data,
                                    },
                                );
                                info!("Snapshot sent to client");
                            }
                            ClientCommand::LoadSnapshot { snapshot } => {
                                info!("Snapshot load requested");
                                let restored = {
                                    let mut w = world.write().await;
                                    match w.hydrate_from_snapshot(&snapshot) {
                                        Ok(()) => Some((w.to_bootstrap(), w.to_graph_snapshot())),
                                        Err(e) => {
                                            warn!("Snapshot hydration failed: {e}");
                                            None
                                        }
                                    }
                                };

                                let Some((bootstrap, graph_data)) = restored else {
                                    continue;
                                };

                                {
                                    let mem = shared_memory.lock().await;
                                    if let Err(e) = mem.purge_all() {
                                        warn!("Failed to purge memory on hydration: {e}");
                                    }
                                }

                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "world.bootstrap",
                                    bootstrap,
                                );
                                broadcast_event(
                                    &event_tx,
                                    &sequence,
                                    "graph.snapshot",
                                    ServerEvent::GraphSnapshot { data: graph_data },
                                );

                                info!("Snapshot hydration complete - simulation paused");
                            }
                        }
                    }
                    Message::Close(_) => {
                        info!("WebSocket client disconnected");
                        break;
                    }
                    _ => {}
                }
            }
        }
    });

    tokio::select! {
        _ = outbound => {}
        _ = inbound => {}
    }

    info!("WebSocket connection closed");
}
