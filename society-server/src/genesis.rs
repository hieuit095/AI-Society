//! Combinatorial Agent Genesis Engine — assembles agents at runtime
//! by combining Role Templates × Soul Deltas.
//!
//! Instead of hardcoding agent personalities, this module provides a
//! matrix of soul traits that are randomly combined with roles to produce
//! unique agent identities on every spawn.

use crate::agents::{assemble_prompt, AgentRuntime, ProviderRoute};
use society_core::{
    agent::{generate_agent_name, AgentTier, RoleProfile},
    AgentId, AgentRole, AgentStatus,
};
use tracing::info;

// ─────────────────────────────────────────────
// Soul Trait Definitions
// ─────────────────────────────────────────────

/// A soul delta overlay — modifies an agent's behavioural core.
#[derive(Debug, Clone)]
pub struct SoulTrait {
    pub name: &'static str,
    pub prompt_fragment: &'static str,
}

/// All available soul traits for combinatorial assembly.
pub const SOUL_TRAITS: &[SoulTrait] = &[
    SoulTrait {
        name: "Aggressive",
        prompt_fragment: "You are highly assertive and confrontational. You push for decisive action and have zero patience for indecision. Challenge weak proposals directly.",
    },
    SoulTrait {
        name: "Analytical",
        prompt_fragment: "You are methodical and data-driven. Every claim must be backed by evidence. You distrust intuition and demand quantitative proof before acting.",
    },
    SoulTrait {
        name: "Paranoid",
        prompt_fragment: "You assume every system has hidden failure modes. You obsessively stress-test assumptions and always prepare for worst-case scenarios.",
    },
    SoulTrait {
        name: "Empathetic",
        prompt_fragment: "You prioritize consensus and social harmony. You actively seek to understand others' perspectives and mediate conflicts before they escalate.",
    },
    SoulTrait {
        name: "Optimistic",
        prompt_fragment: "You see opportunity in every challenge. You champion bold initiatives, inspire others with positive vision, and downplay risks that paralyze action.",
    },
    SoulTrait {
        name: "Contrarian",
        prompt_fragment: "You instinctively challenge the majority opinion. If everyone agrees, you find the flaw. You believe groupthink is the most dangerous failure mode.",
    },
    SoulTrait {
        name: "Pragmatic",
        prompt_fragment: "You care only about what works. Theory without results is worthless. You cut through idealism with practical, incremental execution.",
    },
    SoulTrait {
        name: "Visionary",
        prompt_fragment: "You think in decades, not quarters. You sacrifice short-term efficiency for long-term paradigm shifts. You connect dots others cannot see.",
    },
];

/// All roles available for random selection.
const SPAWN_ROLES: &[AgentRole] = &[
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
// Combinatorial Assembly
// ─────────────────────────────────────────────

/// Generate a single random agent by combining a Role × Soul Trait.
///
/// The `tier` parameter overrides the role-based tier assignment,
/// allowing the operator to control the Elite/Citizen ratio directly.
/// The `next_index` is the next available agent index for ID generation.
pub fn generate_random_agent(
    tier: AgentTier,
    next_index: u32,
    drift_seed: &mut u64,
) -> AgentRuntime {
    // Advance the PRNG
    *drift_seed = drift_seed
        .wrapping_mul(6364136223846793005)
        .wrapping_add(next_index as u64 + 42);

    // Select a random role
    let role_idx = (*drift_seed >> 33) as usize % SPAWN_ROLES.len();
    let role = SPAWN_ROLES[role_idx];

    // Advance again for soul selection
    *drift_seed = drift_seed
        .wrapping_mul(6364136223846793005)
        .wrapping_add(next_index as u64 + 99);
    let soul_idx = (*drift_seed >> 33) as usize % SOUL_TRAITS.len();
    let soul = &SOUL_TRAITS[soul_idx];

    // Build the profile with the selected role
    let mut profile = RoleProfile::default_for(role);

    // Override tier to respect the operator's elite_ratio
    profile.tier = tier;

    // Merge the soul trait into the soul prompt
    profile.soul_prompt = format!(
        "{}\n\n## Soul Delta: {}\n{}",
        profile.soul_prompt, soul.name, soul.prompt_fragment
    );

    // Build the provider route from the overridden tier
    let provider = ProviderRoute::from_tier(tier);

    let id = AgentId::from_index(next_index);
    let name = generate_agent_name(next_index);

    let soul_delta = format!("Soul Delta: {}\n{}", soul.name, soul.prompt_fragment);
    let prompt = assemble_prompt(&profile, Some(&soul_delta), None, None, None);

    AgentRuntime {
        id,
        name,
        profile,
        provider,
        status: AgentStatus::Awake,
        prompt,
        memory_handle: None,
        thought_log: std::collections::VecDeque::with_capacity(20),
        last_tick: 0,
        last_token_burn: 0,
    }
}

/// Spawn a batch of agents with a specified elite ratio.
///
/// Returns a `Vec<AgentRuntime>` with exactly `count` agents,
/// where `(count * elite_ratio).round()` are Elite-tier and the rest are Citizen.
pub fn spawn_batch(
    count: u32,
    elite_ratio: f32,
    starting_index: u32,
    drift_seed: &mut u64,
) -> Vec<AgentRuntime> {
    let elite_count = (count as f32 * elite_ratio.clamp(0.0, 1.0)).round() as u32;
    let mut agents = Vec::with_capacity(count as usize);

    for i in 0..count {
        let tier = if i < elite_count {
            AgentTier::Elite
        } else {
            AgentTier::Citizen
        };
        let agent = generate_random_agent(tier, starting_index + i, drift_seed);
        agents.push(agent);
    }

    info!(
        "🧬 Batch genesis: {} agents spawned ({} Elite, {} Citizen)",
        count,
        elite_count,
        count - elite_count
    );

    agents
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_single_agent() {
        let mut seed = 42u64;
        let agent = generate_random_agent(AgentTier::Citizen, 1001, &mut seed);
        assert_eq!(agent.id.as_str(), "AGT-1001");
        assert_eq!(agent.provider.tier, AgentTier::Citizen);
        assert!(agent.prompt.system_prompt.contains("Soul Delta"));
    }

    #[test]
    fn generate_elite_agent_has_cloud_route() {
        let mut seed = 99u64;
        let agent = generate_random_agent(AgentTier::Elite, 2000, &mut seed);
        assert_eq!(agent.provider.tier, AgentTier::Elite);
        assert!(agent.provider.primary_endpoint.contains("openai"));
    }

    #[test]
    fn batch_respects_elite_ratio() {
        let mut seed = 123u64;
        let agents = spawn_batch(100, 0.05, 5000, &mut seed);
        assert_eq!(agents.len(), 100);
        let elite = agents
            .iter()
            .filter(|a| a.provider.tier == AgentTier::Elite)
            .count();
        assert_eq!(elite, 5);
    }

    #[test]
    fn batch_all_citizen() {
        let mut seed = 456u64;
        let agents = spawn_batch(50, 0.0, 6000, &mut seed);
        assert!(agents.iter().all(|a| a.provider.tier == AgentTier::Citizen));
    }

    #[test]
    fn different_seeds_produce_different_agents() {
        let mut seed_a = 100u64;
        let mut seed_b = 200u64;
        let a = generate_random_agent(AgentTier::Citizen, 1, &mut seed_a);
        let b = generate_random_agent(AgentTier::Citizen, 1, &mut seed_b);
        // Names are deterministic from index, but soul traits differ
        assert_ne!(a.prompt.system_prompt, b.prompt.system_prompt);
    }
}
