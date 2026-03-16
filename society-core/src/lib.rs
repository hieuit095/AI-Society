//! # society-core
//!
//! Shared domain types and WebSocket wire-protocol contracts for the ZeroClaw AI Society backend.
//!
//! This crate defines the **versioned event envelope** (`Envelope<T>`) and the typed event/command
//! enums that both the server and any future clients must agree on.

pub mod envelope;
pub mod events;

pub use envelope::Envelope;
pub use events::{ClientCommand, ServerEvent};
