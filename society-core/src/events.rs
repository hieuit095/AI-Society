//! Typed event and command enums for the WebSocket wire protocol.
//!
//! - [`ServerEvent`]: Events sent from the Rust server to the browser client.
//! - [`ClientCommand`]: Commands sent from the browser client to the Rust server.
//!
//! Both use `#[serde(tag = "type")]` for internally tagged JSON representation,
//! which produces `{ "type": "tickSync", ... }` — clean for JS consumption.

use crate::channels::{AgentDetailPayload, ChatMsg, GraphSnapshot};
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────
// Server → Client events
// ─────────────────────────────────────────────

/// A single agent status change entry used in batched updates.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusEntry {
    pub agent_id: String,
    pub status: String,
}

/// Events emitted by the server and consumed by the React frontend.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerEvent {
    /// Echo response — mirrors the client's message back (Phase 1 POC).
    Echo { message: String },

    /// Periodic heartbeat emitted on every committed tick.
    #[serde(rename_all = "camelCase")]
    TickSync {
        is_playing: bool,
        current_tick: u64,
        awake_agents: u32,
        total_agents: u32,
        rust_ram: u32,
    },

    /// Sent once on connection — the client hydrates its full state from this.
    #[serde(rename_all = "camelCase")]
    WorldBootstrap {
        is_playing: bool,
        current_tick: u64,
        awake_agents: u32,
        total_agents: u32,
        rust_ram: u32,
    },

    /// A chat message emitted by an agent into a society channel.
    #[serde(rename_all = "camelCase")]
    ChatMessage {
        #[serde(flatten)]
        msg: ChatMsg,
    },

    /// Full force-graph snapshot of the agent society (emitted periodically).
    #[serde(rename_all = "camelCase")]
    GraphSnapshot { data: GraphSnapshot },

    /// Detailed agent telemetry for the inspector panel.
    #[serde(rename_all = "camelCase")]
    AgentDetail {
        #[serde(flatten)]
        detail: AgentDetailPayload,
    },

    /// Notifies the frontend that an agent's status changed.
    #[serde(rename_all = "camelCase")]
    AgentStatusChange { agent_id: String, status: String },

    /// Confirms that a seed directive was applied and the world was reset.
    #[serde(rename_all = "camelCase")]
    SeedApplied {
        seed_id: String,
        title: String,
        system_message: ChatMsg,
    },

    /// Per-tick analytics data point streamed to the frontend.
    #[serde(rename_all = "camelCase")]
    AnalyticsTick {
        tick: u64,
        positive: u32,
        negative: u32,
        tokens: u64,
        adoption: u32,
        simulated_revenue: f64,
    },

    /// Batched agent status changes emitted once per tick.
    #[serde(rename_all = "camelCase")]
    AgentStatusBatch { changes: Vec<AgentStatusEntry> },

    /// Result of an agent spawn operation (single or bulk).
    #[serde(rename_all = "camelCase")]
    GenesisResult {
        spawned_count: u32,
        elite_count: u32,
        citizen_count: u32,
        new_total: u32,
    },
}

// ─────────────────────────────────────────────
// Client → Server commands
// ─────────────────────────────────────────────

/// Commands sent by the browser client to the Rust server.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientCommand {
    /// Echo request — server will mirror the message back (Phase 1 POC).
    Echo { message: String },

    /// Play/pause control from the TopBar.
    #[serde(rename_all = "camelCase")]
    SimulationControl { action: SimulationAction },

    /// Request detailed agent telemetry for the inspector.
    #[serde(rename_all = "camelCase")]
    InspectAgent { agent_id: String },

    /// Inject a new scenario seed — resets the world and starts a new simulation run.
    #[serde(rename_all = "camelCase")]
    InjectSeed {
        title: String,
        audience: String,
        context: String,
    },

    /// Request a full world resync (sent when client detects a sequence gap).
    RequestResync,

    /// Spawn a single random agent.
    SpawnSingle,

    /// Spawn a batch of agents with a controlled elite ratio.
    #[serde(rename_all = "camelCase")]
    SpawnBulk { count: u32, elite_ratio: f32 },
}

/// The action payload for `SimulationControl` commands.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SimulationAction {
    Play,
    Pause,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_event_echo_serializes_tagged() {
        let event = ServerEvent::Echo {
            message: "test".to_string(),
        };
        let json = serde_json::to_value(&event).expect("serialize");
        assert_eq!(json["type"], "echo");
        assert_eq!(json["message"], "test");
    }

    #[test]
    fn tick_sync_serializes_camel_case() {
        let event = ServerEvent::TickSync {
            is_playing: true,
            current_tick: 42,
            awake_agents: 800,
            total_agents: 1000,
            rust_ram: 55,
        };
        let json = serde_json::to_value(&event).expect("serialize");
        assert_eq!(json["type"], "tickSync");
        assert_eq!(json["isPlaying"], true);
        assert_eq!(json["currentTick"], 42);
        assert_eq!(json["awakeAgents"], 800);
        assert_eq!(json["totalAgents"], 1000);
        assert_eq!(json["rustRam"], 55);
    }

    #[test]
    fn world_bootstrap_serializes_camel_case() {
        let event = ServerEvent::WorldBootstrap {
            is_playing: false,
            current_tick: 0,
            awake_agents: 1000,
            total_agents: 1000,
            rust_ram: 12,
        };
        let json = serde_json::to_value(&event).expect("serialize");
        assert_eq!(json["type"], "worldBootstrap");
        assert_eq!(json["isPlaying"], false);
        assert_eq!(json["currentTick"], 0);
    }

    #[test]
    fn simulation_control_deserializes() {
        let json = r#"{ "type": "simulationControl", "action": "play" }"#;
        let cmd: ClientCommand = serde_json::from_str(json).expect("deserialize");
        assert_eq!(
            cmd,
            ClientCommand::SimulationControl {
                action: SimulationAction::Play
            }
        );
    }

    #[test]
    fn client_command_echo_deserializes() {
        let json = r#"{ "type": "echo", "message": "ping" }"#;
        let cmd: ClientCommand = serde_json::from_str(json).expect("deserialize");
        assert_eq!(
            cmd,
            ClientCommand::Echo {
                message: "ping".to_string()
            }
        );
    }

    #[test]
    fn inspect_agent_deserializes() {
        let json = r#"{ "type": "inspectAgent", "agentId": "AGT-001" }"#;
        let cmd: ClientCommand = serde_json::from_str(json).expect("deserialize");
        assert_eq!(
            cmd,
            ClientCommand::InspectAgent {
                agent_id: "AGT-001".to_string()
            }
        );
    }

    #[test]
    fn inject_seed_deserializes() {
        let json = r#"{ "type": "injectSeed", "title": "Post-AGI Economy", "audience": "Mass Market", "context": "bandwidth shortage" }"#;
        let cmd: ClientCommand = serde_json::from_str(json).expect("deserialize");
        assert_eq!(
            cmd,
            ClientCommand::InjectSeed {
                title: "Post-AGI Economy".to_string(),
                audience: "Mass Market".to_string(),
                context: "bandwidth shortage".to_string(),
            }
        );
    }

    #[test]
    fn agent_status_change_serializes() {
        let event = ServerEvent::AgentStatusChange {
            agent_id: "AGT-042".to_string(),
            status: "processing".to_string(),
        };
        let json = serde_json::to_value(&event).expect("serialize");
        assert_eq!(json["type"], "agentStatusChange");
        assert_eq!(json["agentId"], "AGT-042");
        assert_eq!(json["status"], "processing");
    }

    #[test]
    fn seed_applied_serializes() {
        let msg = ChatMsg {
            id: "sys-1".into(),
            agent_id: "system".into(),
            agent_name: "SYSTEM".into(),
            agent_role: "DIRECTIVE".into(),
            agent_role_color: "rose".into(),
            agent_avatar_initials: "SY".into(),
            channel_id: "board-room".into(),
            content: "test".into(),
            timestamp: "2024-01-01T00:00:00Z".into(),
            tick: 0,
            is_system_message: true,
        };
        let event = ServerEvent::SeedApplied {
            seed_id: "seed-abc".into(),
            title: "Test".into(),
            system_message: msg,
        };
        let json = serde_json::to_value(&event).expect("serialize");
        assert_eq!(json["type"], "seedApplied");
        assert_eq!(json["seedId"], "seed-abc");
        assert_eq!(json["systemMessage"]["agentId"], "system");
    }
}
