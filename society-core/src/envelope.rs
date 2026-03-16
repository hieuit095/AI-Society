//! Versioned event envelope — the wire protocol contract for all WebSocket messages.
//!
//! Every message between client and server is wrapped in an `Envelope<T>` that carries
//! metadata (schema version, world ID, sequence number, timestamp) alongside the typed payload.
//!
//! ## JSON Schema (v1)
//!
//! ```json
//! {
//!   "schemaVersion": 1,
//!   "worldId": "default",
//!   "sequence": 42,
//!   "sentAt": "2026-03-16T14:57:00Z",
//!   "eventType": "echo",
//!   "payload": { "type": "echo", "message": "hello" }
//! }
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// The canonical wire-protocol envelope.
///
/// `T` is the payload type — either [`crate::ServerEvent`] (server → client)
/// or [`crate::ClientCommand`] (client → server).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Envelope<T> {
    /// Protocol version. Always `1` for now.
    pub schema_version: u32,

    /// Identifies the simulation world. Defaults to `"default"`.
    pub world_id: String,

    /// Monotonically increasing sequence number per connection.
    pub sequence: u64,

    /// ISO 8601 timestamp of when the message was sent.
    pub sent_at: DateTime<Utc>,

    /// Dot-namespaced event type string, e.g. `"echo"`, `"heartbeat"`, `"tick.sync"`.
    pub event_type: String,

    /// The typed payload.
    pub payload: T,
}

impl<T> Envelope<T> {
    /// Create a new envelope with the given sequence, event type, and payload.
    ///
    /// Sets `schema_version` to `1`, `world_id` to `"default"`, and `sent_at` to `Utc::now()`.
    pub fn new(sequence: u64, event_type: impl Into<String>, payload: T) -> Self {
        Self {
            schema_version: 1,
            world_id: "default".to_string(),
            sequence,
            sent_at: Utc::now(),
            event_type: event_type.into(),
            payload,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::ServerEvent;

    #[test]
    fn envelope_roundtrip_json() {
        let envelope = Envelope::new(
            1,
            "echo",
            ServerEvent::Echo {
                message: "hello world".to_string(),
            },
        );

        let json = serde_json::to_string(&envelope).expect("serialize");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse json");

        // Verify camelCase keys
        assert_eq!(parsed["schemaVersion"], 1);
        assert_eq!(parsed["worldId"], "default");
        assert_eq!(parsed["sequence"], 1);
        assert_eq!(parsed["eventType"], "echo");
        assert!(parsed["sentAt"].is_string());

        // Verify payload structure
        assert_eq!(parsed["payload"]["type"], "echo");
        assert_eq!(parsed["payload"]["message"], "hello world");

        // Verify full round-trip
        let deserialized: Envelope<ServerEvent> = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(deserialized.schema_version, 1);
        assert_eq!(deserialized.world_id, "default");
        assert_eq!(deserialized.sequence, 1);
        assert_eq!(deserialized.event_type, "echo");
        match &deserialized.payload {
            ServerEvent::Echo { message } => assert_eq!(message, "hello world"),
            _ => panic!("expected Echo variant"),
        }
    }

    #[test]
    fn envelope_deserialize_from_browser_json() {
        // Simulate what a browser client would send
        let browser_json = r#"{
            "schemaVersion": 1,
            "worldId": "default",
            "sequence": 1,
            "sentAt": "2026-03-16T14:57:00Z",
            "eventType": "echo",
            "payload": { "type": "echo", "message": "Hello from browser!" }
        }"#;

        let envelope: Envelope<crate::events::ClientCommand> =
            serde_json::from_str(browser_json).expect("deserialize browser payload");

        assert_eq!(envelope.schema_version, 1);
        assert_eq!(envelope.event_type, "echo");
        match envelope.payload {
            crate::events::ClientCommand::Echo { message } => {
                assert_eq!(message, "Hello from browser!");
            }
        }
    }
}
