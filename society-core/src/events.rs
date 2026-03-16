//! Typed event and command enums for the WebSocket wire protocol.
//!
//! - [`ServerEvent`]: Events sent from the Rust server to the browser client.
//! - [`ClientCommand`]: Commands sent from the browser client to the Rust server.
//!
//! Both use `#[serde(tag = "type")]` for internally tagged JSON representation,
//! which produces `{ "type": "echo", "message": "..." }` — clean for JS consumption.

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────
// Server → Client events
// ─────────────────────────────────────────────

/// Events emitted by the server and consumed by the React frontend.
///
/// New variants will be added as backend features are built:
/// - `TickSync` (Phase 2)
/// - `ChatMessage` (Phase 2)
/// - `AgentDetail` (Phase 3)
/// - `GraphSnapshot` (Phase 3)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerEvent {
    /// Echo response — mirrors the client's message back.
    /// Used as a connectivity proof-of-concept.
    Echo { message: String },

    /// Periodic heartbeat to keep the connection alive and sync tick state.
    Heartbeat { tick: u64 },
}

// ─────────────────────────────────────────────
// Client → Server commands
// ─────────────────────────────────────────────

/// Commands sent by the browser client to the Rust server.
///
/// New variants will be added as frontend integration progresses:
/// - `InjectSeed` (Phase 2)
/// - `TogglePlay` (Phase 2)
/// - `InspectAgent` (Phase 3)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientCommand {
    /// Echo request — server will mirror the message back.
    Echo { message: String },
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
    fn server_event_heartbeat_serializes_tagged() {
        let event = ServerEvent::Heartbeat { tick: 42 };
        let json = serde_json::to_value(&event).expect("serialize");
        assert_eq!(json["type"], "heartbeat");
        assert_eq!(json["tick"], 42);
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
}
