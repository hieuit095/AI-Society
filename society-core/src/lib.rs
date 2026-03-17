//! # society-core
//!
//! Shared domain types and WebSocket wire-protocol contracts for the ZeroClaw AI Society backend.
//!
//! ## Modules
//!
//! - [`agent`] — Canonical agent identity, roles, status, tiers, and profiles.
//! - [`channels`] — Society channel definitions, message payloads, and templates.
//! - [`envelope`] — Versioned event envelope wire protocol.
//! - [`events`] — Typed server events and client commands.

pub mod agent;
pub mod channels;
pub mod envelope;
pub mod events;

pub use agent::{AgentId, AgentRole, AgentStatus, AgentTier, RoleProfile};
pub use channels::{AgentDetailPayload, ChatMsg, GraphLink, GraphNode, GraphSnapshot};
pub use envelope::Envelope;
pub use events::{ClientCommand, ServerEvent, SimulationAction};
