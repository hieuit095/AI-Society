//! WebSocket handler for the ZeroClaw society server.
//!
//! ## Architecture (Phase 4)
//!
//! Each WebSocket connection spawns two concurrent tasks:
//! 1. **Outbound**: Subscribes to the broadcast channel and forwards all events to the client.
//! 2. **Inbound**: Reads client commands and mutates shared `WorldState`.
//!
//! Events broadcast per tick:
//! - `tick.sync` — heartbeat with counters
//! - `chat.message` — agent messages emitted during the tick
//! - `graph.snapshot` — periodic force-graph data (every 5th tick)
//!
//! On-demand events:
//! - `world.bootstrap` — sent once on connection
//! - `agent.detail` — sent in response to `inspectAgent` command

use crate::world::{EventTx, SharedWorld};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use society_core::{
    channels::{thought_templates_for_role, AgentDetailPayload, ChatMsg},
    ClientCommand, Envelope, ServerEvent, SimulationAction,
};
use tracing::{debug, info, warn};

/// Shared application state injected into the WebSocket handler via Axum extractors.
#[derive(Clone)]
pub struct AppState {
    pub world: SharedWorld,
    pub event_tx: EventTx,
}

/// Axum handler that upgrades an HTTP request to a WebSocket connection.
pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    info!("WebSocket upgrade requested");
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Per-connection WebSocket handler.
async fn handle_socket(socket: WebSocket, state: AppState) {
    info!("WebSocket connection established");

    let (mut ws_sink, ws_stream) = socket.split();

    // ── Bootstrap: send current world state ──
    {
        let world = state.world.read().await;
        let bootstrap = Envelope::new(0, "world.bootstrap", world.to_bootstrap());
        if let Ok(json) = serde_json::to_string(&bootstrap) {
            if ws_sink.send(Message::Text(json.into())).await.is_err() {
                return;
            }
        }
    }

    let mut rx = state.event_tx.subscribe();

    // ── Outbound task: forward broadcast events to this client ──
    let outbound = tokio::spawn(async move {
        while let Ok(json) = rx.recv().await {
            if ws_sink.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
    });

    // ── Inbound task: read client commands ──
    let world = state.world.clone();
    let event_tx = state.event_tx.clone();
    let inbound = tokio::spawn({
        let world = world.clone();
        let event_tx = event_tx.clone();
        let mut ws_stream = ws_stream;

        async move {
            let mut sequence: u64 = 1000;

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
                                sequence += 1;
                                let response = Envelope::new(
                                    sequence,
                                    "echo",
                                    ServerEvent::Echo {
                                        message: message.clone(),
                                    },
                                );
                                if let Ok(json) = serde_json::to_string(&response) {
                                    let _ = event_tx.send(json);
                                }
                            }
                            ClientCommand::SimulationControl { action } => {
                                let mut w = world.write().await;
                                match action {
                                    SimulationAction::Play => {
                                        info!("▶️  Simulation PLAY");
                                        w.is_playing = true;
                                    }
                                    SimulationAction::Pause => {
                                        info!("⏸️  Simulation PAUSE");
                                        w.is_playing = false;
                                    }
                                }

                                sequence += 1;
                                let sync = Envelope::new(sequence, "tick.sync", w.to_tick_sync());
                                if let Ok(json) = serde_json::to_string(&sync) {
                                    let _ = event_tx.send(json);
                                }
                            }
                            ClientCommand::InspectAgent { agent_id } => {
                                info!("🔍 Inspect agent: {agent_id}");
                                let w = world.read().await;
                                if let Some(agent) =
                                    w.agents.iter().find(|a| a.id.as_str() == agent_id)
                                {
                                    let role_name = agent.profile.role.display_name().to_string();
                                    let detail = AgentDetailPayload {
                                        agent_id: agent.id.as_str().to_string(),
                                        name: agent.name.clone(),
                                        role: role_name.clone(),
                                        role_color: agent.profile.role.color_key().to_string(),
                                        avatar_initials: agent.name[..2].to_uppercase(),
                                        status: format!("{:?}", agent.status).to_lowercase(),
                                        model: agent.provider.model.clone(),
                                        tier: format!("{:?}", agent.provider.tier).to_lowercase(),
                                        tokens_per_tick: {
                                            let mut hash: u32 = 0;
                                            for b in agent.id.as_str().bytes() {
                                                hash = hash.wrapping_mul(31).wrapping_add(b as u32);
                                            }
                                            (hash % 800) + 200
                                        },
                                        tools: agent.profile.tool_bounds.clone(),
                                        thought_log: thought_templates_for_role(&role_name),
                                    };

                                    sequence += 1;
                                    let envelope = Envelope::new(
                                        sequence,
                                        "agent.detail",
                                        ServerEvent::AgentDetail { detail },
                                    );
                                    if let Ok(json) = serde_json::to_string(&envelope) {
                                        let _ = event_tx.send(json);
                                    }
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
                                    "🌱 Seed injection: title=\"{title}\", audience=\"{audience}\""
                                );

                                let mut w = world.write().await;

                                // 1. Apply seed — resets tick, statuses, generates new seed_id
                                let seed_id = w.apply_seed();

                                // 2. Build system directive message
                                let system_msg = ChatMsg {
                                    id: format!("sys-seed-{}", seed_id),
                                    agent_id: "system".to_string(),
                                    agent_name: "SYSTEM".to_string(),
                                    agent_role: "DIRECTIVE".to_string(),
                                    agent_role_color: "rose".to_string(),
                                    agent_avatar_initials: "SY".to_string(),
                                    channel_id: "board-room".to_string(),
                                    content: format!(
                                        ">>> NEW SEED DIRECTIVE INJECTED: \"{}\". \
                                         TARGET AUDIENCE: {}. \
                                         CONTEXT: {}. \
                                         ALL PRIOR CONTEXT PURGED. \
                                         RE-INITIALIZING {} AGENTS. \
                                         SIMULATION CLOCK RESET TO T+0.",
                                        title, audience, context, w.total_agents
                                    ),
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                    tick: 0,
                                    is_system_message: true,
                                };

                                // 3. Broadcast SeedApplied
                                sequence += 1;
                                let seed_event = Envelope::new(
                                    sequence,
                                    "seed.applied",
                                    ServerEvent::SeedApplied {
                                        seed_id: seed_id.clone(),
                                        title: title.clone(),
                                        system_message: system_msg,
                                    },
                                );
                                if let Ok(json) = serde_json::to_string(&seed_event) {
                                    let _ = event_tx.send(json);
                                }

                                // 4. Broadcast fresh WorldBootstrap
                                sequence += 1;
                                let bootstrap =
                                    Envelope::new(sequence, "world.bootstrap", w.to_bootstrap());
                                if let Ok(json) = serde_json::to_string(&bootstrap) {
                                    let _ = event_tx.send(json);
                                }

                                // 5. Resume tick loop
                                w.is_playing = true;
                                info!(
                                    "🌱 Seed applied: seed_id={}, title=\"{}\", agents reset, tick loop resumed",
                                    seed_id, title
                                );
                            }
                            ClientCommand::RequestResync => {
                                info!("🔄 Client requested resync");
                                let w = world.read().await;

                                // Send fresh bootstrap
                                sequence += 1;
                                let bootstrap =
                                    Envelope::new(sequence, "world.bootstrap", w.to_bootstrap());
                                if let Ok(json) = serde_json::to_string(&bootstrap) {
                                    let _ = event_tx.send(json);
                                }

                                // Send fresh graph snapshot
                                let graph_data = w.to_graph_snapshot();
                                sequence += 1;
                                let graph_envelope = Envelope::new(
                                    sequence,
                                    "graph.snapshot",
                                    ServerEvent::GraphSnapshot { data: graph_data },
                                );
                                if let Ok(json) = serde_json::to_string(&graph_envelope) {
                                    let _ = event_tx.send(json);
                                }
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
        _ = outbound => {},
        _ = inbound => {},
    }

    info!("WebSocket connection closed");
}
