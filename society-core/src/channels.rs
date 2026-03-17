//! Society channel definitions and message template generation.
//!
//! Channels are the communication primitives within the AI society.
//! Each channel has a stable ID that is shared between Rust and the React frontend.

use serde::{Deserialize, Serialize};

/// Stable channel identifiers — must match the frontend's channel list.
pub const CHANNEL_BOARD_ROOM: &str = "board-room";
pub const CHANNEL_RND_TEAM: &str = "rnd-team";
pub const CHANNEL_MARKET_SQUARE: &str = "market-square";
pub const CHANNEL_DEV_OPS: &str = "dev-ops";
pub const CHANNEL_LEGAL_FLOOR: &str = "legal-floor";
pub const CHANNEL_HR_LOUNGE: &str = "hr-lounge";
pub const CHANNEL_FINANCE_DESK: &str = "finance-desk";
pub const CHANNEL_RESEARCH_LAB: &str = "research-lab";

/// All available society channels.
pub const ALL_CHANNELS: &[&str] = &[
    CHANNEL_BOARD_ROOM,
    CHANNEL_RND_TEAM,
    CHANNEL_MARKET_SQUARE,
    CHANNEL_DEV_OPS,
    CHANNEL_LEGAL_FLOOR,
    CHANNEL_HR_LOUNGE,
    CHANNEL_FINANCE_DESK,
    CHANNEL_RESEARCH_LAB,
];

/// A chat message emitted by an agent into a channel.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatMsg {
    pub id: String,
    pub agent_id: String,
    pub agent_name: String,
    pub agent_role: String,
    pub agent_role_color: String,
    pub agent_avatar_initials: String,
    pub channel_id: String,
    pub content: String,
    pub timestamp: String,
    pub tick: u64,
    pub is_system_message: bool,
}

/// A node in the society graph snapshot.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    pub val: u32,
    pub group: String,
    pub status: String,
}

/// A link in the society graph.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphLink {
    pub source: String,
    pub target: String,
}

/// Full graph snapshot for the force-graph visualization.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphSnapshot {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

/// Detailed agent telemetry for the inspector panel.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentDetailPayload {
    pub agent_id: String,
    pub name: String,
    pub role: String,
    pub role_color: String,
    pub avatar_initials: String,
    pub status: String,
    pub model: String,
    pub tier: String,
    pub tokens_per_tick: u32,
    pub tools: Vec<String>,
    pub thought_log: Vec<String>,
}

/// Message templates for deterministic message generation during ticks.
pub const MESSAGE_TEMPLATES: &[&str] = &[
    "Analyzing market trajectory vectors. Current consumer sentiment index at 0.74 — recommending pivot to decentralized product channels.",
    "Completed the architectural review of module-7. Three critical bottlenecks identified in the inference pipeline. Proposing async batch queuing.",
    "Q3 allocation requires re-weighting. Burn rate exceeds projection by 12.4%. Initiating emergency cost-reduction subroutines.",
    "New UI prototype violates 4 heuristics. Submitting revised wireframes to the shared canvas now.",
    "Compiling security audit report. Found 2 high-severity vulnerabilities in the auth layer. Patching initiated.",
    "Consumer demand signals suggest a 31% uptick in autonomous product preference. Adjusting recommendation engine accordingly.",
    "Research confirms: neural reward modeling outperforms RLHF baseline by 8.2% on long-horizon tasks. Requesting compute allocation.",
    "Legal framework analysis complete. Clause 7b poses regulatory risk in jurisdictions EU-3 through EU-9. Flagging for review.",
    "Deploying v3.1.4-alpha to staging cluster. ETA 4 minutes. All agents: expect brief latency spike in tool calls.",
    "Cross-referencing financial model with simulated market adversarial conditions. Stress test result: STABLE under 6/8 scenarios.",
    "Product roadmap synthesis complete. Recommend prioritizing features: [adaptive_memory, tool_chaining, multi_modal_input]. Confidence: 0.91",
    "Running semantic diff on last 500 ticks of decision logs. Pattern detected: resource hoarding behavior in Consumer cluster C-12.",
    "Proposal: establish shared knowledge graph across all agent clusters. This would reduce redundant reasoning cycles by estimated 40%.",
    "WARNING: Detected anomalous loop in reasoning chain. Invoking circuit breaker. Agent suspended pending manual review.",
    "Scanning codebase for zero-day patterns. Static analysis on auth module reveals CVE-2024-8821. Generating differential patch.",
];

/// Thought log templates indexed by role for the inspector panel.
pub fn thought_templates_for_role(role: &str) -> Vec<String> {
    match role {
        "CEO Agent" => vec![
            "> Initializing executive reasoning module...".into(),
            "> Loading world_state_v2.json...".into(),
            "> Scanning agent status reports...".into(),
            "> Synthesizing strategic objectives...".into(),
            "> Evaluating competitive landscape vectors...".into(),
            "> Generating board report...".into(),
        ],
        "CTO Agent" => vec![
            "> Booting systems architecture analyzer...".into(),
            "> Profiling inference pipeline performance...".into(),
            "> Bottleneck detected: layer_norm op in block_7...".into(),
            "> Running optimization subroutine...".into(),
            "> Proposing async batch queue implementation...".into(),
        ],
        "Engineer" => vec![
            "> Scanning codebase for security patterns...".into(),
            "> Running static analysis on auth module...".into(),
            "> CVE-2024-8821: HIGH severity found...".into(),
            "> Generating differential patch...".into(),
            "> Running regression test suite...".into(),
            "> Deploying patch to staging...".into(),
        ],
        "Researcher" => vec![
            "> Initializing research synthesis engine...".into(),
            "> Parsing recent papers in corpus...".into(),
            "> RLHF baseline comparison running...".into(),
            "> Neural reward model advantage: +8.2%...".into(),
            "> Requesting ComputeAllocationTool...".into(),
        ],
        "Consumer" => vec![
            "> Sampling consumer preference vectors...".into(),
            "> Aggregating synthetic user signals...".into(),
            "> Demand spike detected: autonomous_products +31%...".into(),
            "> Updating recommendation engine weights...".into(),
            "> Awaiting next tick cycle...".into(),
        ],
        _ => vec![
            "> Initializing agent context...".into(),
            "> Loading memory state...".into(),
            "> Analyzing task queue...".into(),
            "> Processing directives...".into(),
            "> Ready.".into(),
        ],
    }
}

/// Map a role to the appropriate channel for its messages.
pub fn channel_for_role(role: &str) -> &'static str {
    match role {
        "CEO Agent" | "CTO Agent" => CHANNEL_BOARD_ROOM,
        "Engineer" => CHANNEL_DEV_OPS,
        "CFO Agent" | "Analyst" => CHANNEL_FINANCE_DESK,
        "Legal Agent" => CHANNEL_LEGAL_FLOOR,
        "Researcher" => CHANNEL_RESEARCH_LAB,
        "Consumer" => CHANNEL_MARKET_SQUARE,
        _ => CHANNEL_HR_LOUNGE,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_channels_has_correct_count() {
        assert_eq!(ALL_CHANNELS.len(), 8);
    }

    #[test]
    fn channel_for_role_maps_correctly() {
        assert_eq!(channel_for_role("CEO Agent"), "board-room");
        assert_eq!(channel_for_role("Engineer"), "dev-ops");
        assert_eq!(channel_for_role("Consumer"), "market-square");
        assert_eq!(channel_for_role("Legal Agent"), "legal-floor");
    }

    #[test]
    fn thought_templates_non_empty() {
        let templates = thought_templates_for_role("CEO Agent");
        assert!(!templates.is_empty());
        let fallback = thought_templates_for_role("Unknown");
        assert!(!fallback.is_empty());
    }
}
