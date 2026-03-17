//! Agent runtime system — manages the lifecycle, prompt assembly, and provider routing
//! for all agents in the ZeroClaw AI Society.
//!
//! ## Architecture
//!
//! Each agent is represented by an [`AgentRuntime`] struct that holds:
//! - Its canonical [`AgentId`] and [`RoleProfile`]
//! - A [`ProviderRoute`] determining which LLM backend processes its requests
//! - Runtime [`AgentStatus`] tracking
//! - A prompt assembly system that combines shared role files with per-agent deltas
//!
//! ## Provider Economics
//!
//! - **Elite agents (5%)** — CEO, CTO — use cloud providers (OpenAI/Anthropic) with fallback/retry.
//! - **Citizen agents (95%)** — Everyone else — use local providers (Ollama) at near-zero cost.

use society_core::{
    agent::{generate_agent_name, AgentTier, RoleProfile},
    AgentId, AgentRole, AgentStatus,
};
use std::collections::VecDeque;
use tracing::info;

// ─────────────────────────────────────────────
// Provider Routing
// ─────────────────────────────────────────────

/// Describes which LLM provider an agent's requests are routed to.
#[derive(Debug, Clone)]
pub struct ProviderRoute {
    /// The economic tier (Elite = cloud, Citizen = local).
    pub tier: AgentTier,
    /// Primary provider endpoint.
    pub primary_endpoint: String,
    /// Fallback provider (Elite agents only).
    pub fallback_endpoint: Option<String>,
    /// Model identifier (e.g., "gpt-4o", "llama3.3:8b").
    pub model: String,
    /// Maximum retries on provider failure.
    pub max_retries: u32,
}

impl ProviderRoute {
    /// Create a cloud provider route (for Elite agents).
    pub fn elite() -> Self {
        Self {
            tier: AgentTier::Elite,
            primary_endpoint: "https://api.openai.com/v1".to_string(),
            fallback_endpoint: Some("https://api.anthropic.com/v1".to_string()),
            model: "gpt-4o".to_string(),
            max_retries: 3,
        }
    }

    /// Create a local provider route (for Citizen agents).
    pub fn citizen() -> Self {
        Self {
            tier: AgentTier::Citizen,
            primary_endpoint: "http://localhost:11434/api".to_string(),
            fallback_endpoint: None,
            model: "llama3.3:8b".to_string(),
            max_retries: 1,
        }
    }

    /// Select the appropriate route based on agent tier.
    pub fn from_tier(tier: AgentTier) -> Self {
        match tier {
            AgentTier::Elite => Self::elite(),
            AgentTier::Citizen => Self::citizen(),
        }
    }
}

// ─────────────────────────────────────────────
// Prompt Assembly
// ─────────────────────────────────────────────

/// Shared identity preamble — embedded from `prompts/IDENTITY.md` at compile time.
const IDENTITY_PREAMBLE: &str = include_str!("../prompts/IDENTITY.md");

/// Shared behavioral/soul constraints — embedded from `prompts/SOUL.md` at compile time.
const SOUL_CONSTRAINTS: &str = include_str!("../prompts/SOUL.md");

/// Assembled system prompt for an agent — composes file-backed context artifacts
/// with role-specific identity and optional per-agent overrides.
///
/// ## Prompt Composition Order
/// ```text
/// ┌───────────────────────────────────────────┐
/// │  IDENTITY.md (shared)                    │  ← Compile-time embed
/// │  Role-specific identity                  │  ← From RoleProfile
/// │  SOUL.md (shared)                        │  ← Compile-time embed
/// │  Authorized tools                        │  ← From RoleProfile
/// │  Recent Channel Activity (optional)      │  ← Social Fabric Phase 2
/// │  Active Roster (optional)                │  ← Social Fabric Phase 3
/// │  Relationship Memory (optional)          │  ← Social Fabric Phase 4
/// │  Per-agent delta (optional)              │  ← Agent-specific overrides
/// └───────────────────────────────────────────┘
/// ```
#[derive(Debug, Clone)]
pub struct AssembledPrompt {
    pub system_prompt: String,
}

/// Assemble the system prompt for an agent by composing file-backed context
/// artifacts with role-specific parameters.
///
/// The shared layers (`IDENTITY.md`, `SOUL.md`) are embedded at compile time
/// via `include_str!`, ensuring zero runtime I/O and immutable consistency
/// across all 1,000 agents.
///
/// ## Social Fabric (Phase 2)
///
/// When `recent_channel_activity` is `Some`, a transcript of the last N messages
/// from the agent's subscribed channel is injected into the prompt.
///
/// ## Social Fabric (Phase 3)
///
/// When `active_roster` is `Some`, a list of peers currently present in the
/// channel is injected so the LLM knows whom it can address via `@AGT-XXX`.
///
/// ## Social Fabric (Phase 4)
///
/// When `relationship_context` is `Some`, past interactions with the peer who
/// @-mentioned this agent are injected so the LLM has relational memory.
pub fn assemble_prompt(
    profile: &RoleProfile,
    agent_delta: Option<&str>,
    recent_channel_activity: Option<&str>,
    active_roster: Option<&str>,
    relationship_context: Option<&str>,
) -> AssembledPrompt {
    let mut parts: Vec<&str> = Vec::with_capacity(9);

    // Layer 1: Shared identity preamble (from prompts/IDENTITY.md)
    parts.push(IDENTITY_PREAMBLE);

    // Layer 2: Role-specific identity (from RoleProfile)
    let role_section = format!("## Role Identity\n{}", profile.identity_prompt);

    // Layer 3: Shared soul constraints (from prompts/SOUL.md)
    parts.push(&role_section);
    parts.push(SOUL_CONSTRAINTS);

    // Layer 4: Tool bounds
    let tools_section = format!("## Authorized Tools\n[{}]", profile.tool_bounds.join(", "));
    parts.push(&tools_section);

    // Layer 5: Recent channel activity (Social Fabric context injection)
    let activity_section;
    if let Some(activity) = recent_channel_activity {
        activity_section = format!("## Recent Channel Activity\n{}", activity);
        parts.push(&activity_section);
    }

    // Layer 5.5: Active roster (Social Fabric Phase 3 — peer awareness)
    let roster_section;
    if let Some(roster) = active_roster {
        roster_section = format!(
            "## Active Roster\nPresent in channel: {}\nTo address a peer directly, use their exact tag (e.g., @AGT-012).",
            roster
        );
        parts.push(&roster_section);
    }

    // Layer 6: Relationship memory (Social Fabric Phase 4)
    let relationship_section;
    if let Some(context) = relationship_context {
        relationship_section = format!(
            "## Relationship Memory\nYour past interactions with this peer:\n{}",
            context
        );
        parts.push(&relationship_section);
    }

    // Layer 7: Per-agent delta (if any)
    let delta_section;
    if let Some(delta) = agent_delta {
        delta_section = format!("## Agent-Specific Override\n{}", delta);
        parts.push(&delta_section);
    }

    AssembledPrompt {
        system_prompt: parts.join("\n\n"),
    }
}

// ─────────────────────────────────────────────
// Agent Runtime
// ─────────────────────────────────────────────

/// A live agent runtime instance — the server-side representation of one agent
/// in the society. Holds identity, routing, status, and prompt state.
#[derive(Debug, Clone)]
pub struct AgentRuntime {
    /// Canonical identifier (AGT-###).
    pub id: AgentId,
    /// Display name (e.g., "NEXUS-7").
    pub name: String,
    /// Role profile with prompt fragments and tool bounds.
    pub profile: RoleProfile,
    /// Provider routing configuration.
    pub provider: ProviderRoute,
    /// Current runtime status.
    pub status: AgentStatus,
    /// Assembled system prompt (cached).
    pub prompt: AssembledPrompt,
    /// Memory handle — placeholder for future vector store integration.
    pub memory_handle: Option<String>,
    /// Bounded ring buffer of recent reasoning steps / tool calls (max 20).
    pub thought_log: VecDeque<String>,
    /// Tokens consumed in the agent's last LLM turn.
    pub last_token_burn: u32,
}

impl AgentRuntime {
    /// Spawn a new agent with the given ID and role.
    pub fn spawn(id: AgentId, name: String, role: AgentRole) -> Self {
        let profile = RoleProfile::default_for(role);
        let provider = ProviderRoute::from_tier(profile.tier);
        let prompt = assemble_prompt(&profile, None, None, None, None);

        Self {
            id,
            name,
            profile,
            provider,
            status: AgentStatus::Awake,
            prompt,
            memory_handle: None,
            thought_log: VecDeque::with_capacity(20),
            last_token_burn: 0,
        }
    }
}

// ─────────────────────────────────────────────
// Society Genesis
// ─────────────────────────────────────────────

/// Role distribution for the initial society.
///
/// Roughly:
/// - CEO: 1, CTO: 1 (Elite tier)
/// - Finance: 3, Legal: 3, Analyst: 7, Researcher: 10
/// - Engineer: 25, Consumer: ~100 (bulk, Citizen tier)
struct RoleDistribution {
    role: AgentRole,
    count: u32,
}

const GENESIS_DISTRIBUTION: &[RoleDistribution] = &[
    RoleDistribution {
        role: AgentRole::Ceo,
        count: 10,
    },
    RoleDistribution {
        role: AgentRole::Cto,
        count: 40,
    },
    RoleDistribution {
        role: AgentRole::Finance,
        count: 50,
    },
    RoleDistribution {
        role: AgentRole::Legal,
        count: 50,
    },
    RoleDistribution {
        role: AgentRole::Analyst,
        count: 150,
    },
    RoleDistribution {
        role: AgentRole::Researcher,
        count: 200,
    },
    RoleDistribution {
        role: AgentRole::Engineer,
        count: 200,
    },
    RoleDistribution {
        role: AgentRole::Consumer,
        count: 300,
    },
];

/// Initialize the starting agent population for the society.
///
/// Spawns 1,000 agents across all roles following the `GENESIS_DISTRIBUTION`.
/// Returns a `Vec<AgentRuntime>` — each agent has its ID, role, provider route,
/// and cached prompt ready.
pub fn genesis_society() -> Vec<AgentRuntime> {
    let mut agents = Vec::new();
    let mut index: u32 = 1;

    for dist in GENESIS_DISTRIBUTION {
        for _ in 0..dist.count {
            let id = AgentId::from_index(index);
            let name = generate_agent_name(index);
            let agent = AgentRuntime::spawn(id, name, dist.role);
            agents.push(agent);
            index += 1;
        }
    }

    let total = agents.len();
    let elite = agents
        .iter()
        .filter(|a| a.provider.tier == AgentTier::Elite)
        .count();
    let citizen = total - elite;

    info!(
        "🧬 Genesis complete: {} agents spawned ({} Elite, {} Citizen)",
        total, elite, citizen
    );

    agents
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn genesis_spawns_correct_count() {
        let agents = genesis_society();
        assert_eq!(agents.len(), 1000);
    }

    #[test]
    fn genesis_has_correct_elite_count() {
        let agents = genesis_society();
        let elite: Vec<_> = agents
            .iter()
            .filter(|a| a.provider.tier == AgentTier::Elite)
            .collect();
        // CEO + CTO = 50 elite agents
        assert_eq!(elite.len(), 50);
    }

    #[test]
    fn genesis_ids_are_sequential() {
        let agents = genesis_society();
        for (i, agent) in agents.iter().enumerate() {
            let expected = AgentId::from_index((i + 1) as u32);
            assert_eq!(agent.id, expected);
        }
    }

    #[test]
    fn genesis_first_agent_is_ceo() {
        let agents = genesis_society();
        assert_eq!(agents[0].profile.role, AgentRole::Ceo);
        assert_eq!(agents[0].provider.tier, AgentTier::Elite);
    }

    #[test]
    fn genesis_last_agents_are_consumers() {
        let agents = genesis_society();
        let last = agents.last().unwrap();
        assert_eq!(last.profile.role, AgentRole::Consumer);
        assert_eq!(last.provider.tier, AgentTier::Citizen);
    }

    #[test]
    fn provider_route_elite_has_fallback() {
        let route = ProviderRoute::elite();
        assert!(route.fallback_endpoint.is_some());
        assert_eq!(route.max_retries, 3);
    }

    #[test]
    fn provider_route_citizen_no_fallback() {
        let route = ProviderRoute::citizen();
        assert!(route.fallback_endpoint.is_none());
        assert_eq!(route.max_retries, 1);
    }

    #[test]
    fn prompt_assembly_includes_role() {
        let profile = RoleProfile::default_for(AgentRole::Ceo);
        let prompt = assemble_prompt(&profile, None, None, None, None);
        assert!(prompt.system_prompt.contains("CEO Agent"));
        assert!(prompt.system_prompt.contains("strategy"));
    }

    #[test]
    fn prompt_assembly_includes_delta() {
        let profile = RoleProfile::default_for(AgentRole::Engineer);
        let prompt = assemble_prompt(
            &profile,
            Some("Focus on security patches."),
            None,
            None,
            None,
        );
        assert!(prompt.system_prompt.contains("Focus on security patches."));
    }

    #[test]
    fn prompt_assembly_includes_channel_activity() {
        let profile = RoleProfile::default_for(AgentRole::Analyst);
        let transcript = "[AGT-001] CEO: Budget approved.\n[AGT-042] CTO: Deploy the fix.";
        let prompt = assemble_prompt(&profile, None, Some(transcript), None, None);
        assert!(prompt.system_prompt.contains("## Recent Channel Activity"));
        assert!(prompt.system_prompt.contains("Budget approved."));
    }

    #[test]
    fn prompt_assembly_omits_activity_when_none() {
        let profile = RoleProfile::default_for(AgentRole::Analyst);
        let prompt = assemble_prompt(&profile, None, None, None, None);
        assert!(!prompt.system_prompt.contains("## Recent Channel Activity"));
    }

    #[test]
    fn prompt_assembly_includes_relationship_context() {
        let profile = RoleProfile::default_for(AgentRole::Engineer);
        let context = "[Tick 5] CEO Agent: We discussed the budget.";
        let prompt = assemble_prompt(&profile, None, None, None, Some(context));
        assert!(prompt.system_prompt.contains("## Relationship Memory"));
        assert!(prompt.system_prompt.contains("budget"));
    }

    #[test]
    fn prompt_assembly_omits_relationship_when_none() {
        let profile = RoleProfile::default_for(AgentRole::Engineer);
        let prompt = assemble_prompt(&profile, None, None, None, None);
        assert!(!prompt.system_prompt.contains("## Relationship Memory"));
    }

    #[test]
    fn all_agents_have_prompts() {
        let agents = genesis_society();
        for agent in &agents {
            assert!(
                !agent.prompt.system_prompt.is_empty(),
                "Agent {} ({}) has empty prompt",
                agent.id,
                agent.name
            );
        }
    }
}
