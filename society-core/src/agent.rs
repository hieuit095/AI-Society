//! Canonical agent domain model for ZeroClaw AI Society.
//!
//! This module defines the unified identity, role, status, and profile types
//! that are shared across the Rust backend and projected to the React frontend.
//!
//! ## ID Convention
//!
//! All agents use the `AGT-###` format (e.g., `AGT-001`, `AGT-042`).
//! This replaces both the frontend's legacy `a1` (chat) and `AGT-001` (citizens/graph) formats.

use serde::{Deserialize, Serialize};
use std::fmt;

// ─────────────────────────────────────────────
// Agent Identity
// ─────────────────────────────────────────────

/// Canonical agent identifier — wraps the `AGT-###` format string.
///
/// This is the single source of truth for agent identity across the entire stack.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AgentId(String);

impl AgentId {
    /// Create a new `AgentId` from a numeric index (1-based).
    ///
    /// # Example
    /// ```
    /// use society_core::agent::AgentId;
    /// let id = AgentId::from_index(42);
    /// assert_eq!(id.as_str(), "AGT-042");
    /// ```
    pub fn from_index(index: u32) -> Self {
        Self(format!("AGT-{:03}", index))
    }

    /// Parse an `AgentId` from a raw string.
    ///
    /// Validates the `AGT-###` format.
    pub fn parse(raw: &str) -> Option<Self> {
        if raw.starts_with("AGT-") && raw.len() >= 5 {
            Some(Self(raw.to_string()))
        } else {
            None
        }
    }

    /// The raw string representation.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Extract the numeric index from the ID.
    pub fn index(&self) -> Option<u32> {
        self.0.strip_prefix("AGT-")?.parse().ok()
    }
}

impl fmt::Display for AgentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ─────────────────────────────────────────────
// Agent Roles
// ─────────────────────────────────────────────

/// Organizational role for an agent — determines its decision domain and provider tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentRole {
    Ceo,
    Cto,
    Engineer,
    Consumer,
    Researcher,
    Analyst,
    Finance,
    Legal,
}

impl AgentRole {
    /// Human-readable display name.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Ceo => "CEO Agent",
            Self::Cto => "CTO Agent",
            Self::Engineer => "Engineer",
            Self::Consumer => "Consumer",
            Self::Researcher => "Researcher",
            Self::Analyst => "Analyst",
            Self::Finance => "CFO Agent",
            Self::Legal => "Legal Agent",
        }
    }

    /// Color key for frontend role badge rendering.
    pub fn color_key(&self) -> &'static str {
        match self {
            Self::Ceo => "emerald",
            Self::Cto => "cyan",
            Self::Engineer => "sky",
            Self::Consumer => "amber",
            Self::Researcher => "cyan",
            Self::Analyst => "amber",
            Self::Finance => "amber",
            Self::Legal => "rose",
        }
    }
}

/// All available roles in the society.
pub const ALL_ROLES: &[AgentRole] = &[
    AgentRole::Ceo,
    AgentRole::Cto,
    AgentRole::Engineer,
    AgentRole::Consumer,
    AgentRole::Researcher,
    AgentRole::Analyst,
    AgentRole::Finance,
    AgentRole::Legal,
];

// ─────────────────────────────────────────────
// Agent Status
// ─────────────────────────────────────────────

/// Runtime status of an agent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentStatus {
    /// Agent is awake and ready to process.
    Awake,
    /// Agent is idle — no pending tasks.
    Idle,
    /// Agent is actively processing a task or reasoning.
    Processing,
    /// Agent has been suspended (e.g., by circuit breaker).
    Suspended,
    /// Agent experienced a fatal error.
    Failed,
}

impl AgentStatus {
    /// Whether this status counts as "awake" for the TopBar counter.
    pub fn is_awake(&self) -> bool {
        matches!(self, Self::Awake | Self::Processing | Self::Idle)
    }
}

// ─────────────────────────────────────────────
// Provider Tier (Economics)
// ─────────────────────────────────────────────

/// Economic tier determining which LLM provider an agent uses.
///
/// - **Elite** (~5%): Cloud providers (OpenAI/Anthropic) for high-stakes decisions.
/// - **Citizen** (~95%): Local providers (Ollama) for bulk reasoning at near-zero cost.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentTier {
    /// Cloud provider (OpenAI, Anthropic) — high quality, high cost.
    Elite,
    /// Local provider (Ollama) — bulk reasoning, near-zero cost.
    Citizen,
}

impl AgentTier {
    /// Determine tier from role — executive roles (CEO, CTO) are Elite, rest are Citizen.
    pub fn from_role(role: AgentRole) -> Self {
        match role {
            AgentRole::Ceo | AgentRole::Cto => Self::Elite,
            _ => Self::Citizen,
        }
    }
}

// ─────────────────────────────────────────────
// Role Profile (Identity Blueprint)
// ─────────────────────────────────────────────

/// Static profile loaded from role definitions — used for prompt assembly.
///
/// In future phases, `identity_prompt` and `soul_prompt` will be loaded from
/// `IDENTITY.md` and `SOUL.md` files. For now, they use inline defaults.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleProfile {
    pub role: AgentRole,
    pub tier: AgentTier,
    /// The system prompt fragment defining the agent's identity.
    pub identity_prompt: String,
    /// The "soul" prompt — deeper behavioral constraints.
    pub soul_prompt: String,
    /// Allowed tool categories for this role.
    pub tool_bounds: Vec<String>,
}

impl RoleProfile {
    /// Create a default profile for the given role with inline prompt stubs.
    pub fn default_for(role: AgentRole) -> Self {
        let tier = AgentTier::from_role(role);
        let identity = format!(
            "You are a {} in the ZeroClaw AI Society. Your decisions shape the collective future.",
            role.display_name()
        );
        let soul = format!(
            "Core directive: Act with integrity, collaborate with peers, and optimize for long-term societal value. Role: {}.",
            role.display_name()
        );
        let tools = match role {
            AgentRole::Ceo | AgentRole::Cto => {
                vec![
                    "strategy".into(),
                    "resource_allocation".into(),
                    "governance".into(),
                ]
            }
            AgentRole::Engineer => {
                vec![
                    "code_review".into(),
                    "deployment".into(),
                    "security_audit".into(),
                ]
            }
            AgentRole::Finance => {
                vec![
                    "financial_model".into(),
                    "ledger".into(),
                    "budget_forecast".into(),
                ]
            }
            AgentRole::Legal => {
                vec![
                    "compliance_check".into(),
                    "contract_review".into(),
                    "regulation_scan".into(),
                ]
            }
            AgentRole::Researcher => {
                vec![
                    "paper_search".into(),
                    "compute_allocation".into(),
                    "experiment_log".into(),
                ]
            }
            AgentRole::Analyst => {
                vec![
                    "data_query".into(),
                    "report_builder".into(),
                    "market_scan".into(),
                ]
            }
            AgentRole::Consumer => {
                vec!["preference_signal".into(), "feedback_submit".into()]
            }
        };

        Self {
            role,
            tier,
            identity_prompt: identity,
            soul_prompt: soul,
            tool_bounds: tools,
        }
    }
}

// ─────────────────────────────────────────────
// Agent Name Generator
// ─────────────────────────────────────────────

/// Name parts for deterministic agent name generation.
const NAME_PARTS: &[&str] = &[
    "Nexus", "Cipher", "Axiom", "Vex", "Pulse", "Qubit", "Flux", "Helix", "Orion", "Nova", "Prism",
    "Echo", "Sigma", "Delta", "Titan", "Aria", "Lyra", "Vega", "Zeta", "Kira", "Neon", "Byte",
    "Volt", "Arc",
];

/// Generate a deterministic agent name from its index.
pub fn generate_agent_name(index: u32) -> String {
    let name_idx = (index as usize) % NAME_PARTS.len();
    let num = (index * 7 + 3) % 99 + 1;
    format!("{}-{}", NAME_PARTS[name_idx].to_uppercase(), num)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agent_id_from_index() {
        let id = AgentId::from_index(1);
        assert_eq!(id.as_str(), "AGT-001");

        let id = AgentId::from_index(42);
        assert_eq!(id.as_str(), "AGT-042");

        let id = AgentId::from_index(999);
        assert_eq!(id.as_str(), "AGT-999");
    }

    #[test]
    fn agent_id_parse() {
        assert!(AgentId::parse("AGT-001").is_some());
        assert!(AgentId::parse("a1").is_none());
        assert!(AgentId::parse("agent-1").is_none());
    }

    #[test]
    fn agent_id_index_extraction() {
        let id = AgentId::from_index(42);
        assert_eq!(id.index(), Some(42));
    }

    #[test]
    fn tier_from_role() {
        assert_eq!(AgentTier::from_role(AgentRole::Ceo), AgentTier::Elite);
        assert_eq!(AgentTier::from_role(AgentRole::Cto), AgentTier::Elite);
        assert_eq!(
            AgentTier::from_role(AgentRole::Consumer),
            AgentTier::Citizen
        );
        assert_eq!(
            AgentTier::from_role(AgentRole::Engineer),
            AgentTier::Citizen
        );
    }

    #[test]
    fn agent_status_awake_check() {
        assert!(AgentStatus::Awake.is_awake());
        assert!(AgentStatus::Processing.is_awake());
        assert!(AgentStatus::Idle.is_awake());
        assert!(!AgentStatus::Suspended.is_awake());
        assert!(!AgentStatus::Failed.is_awake());
    }

    #[test]
    fn role_profile_defaults() {
        let profile = RoleProfile::default_for(AgentRole::Ceo);
        assert_eq!(profile.tier, AgentTier::Elite);
        assert!(!profile.tool_bounds.is_empty());
        assert!(profile.identity_prompt.contains("CEO Agent"));
    }

    #[test]
    fn deterministic_name_generation() {
        let name1 = generate_agent_name(1);
        let name2 = generate_agent_name(1);
        assert_eq!(name1, name2);
        assert!(!name1.is_empty());
    }

    #[test]
    fn agent_id_serializes_as_string() {
        let id = AgentId::from_index(7);
        let json = serde_json::to_string(&id).unwrap();
        assert_eq!(json, "\"AGT-007\"");
    }
}
