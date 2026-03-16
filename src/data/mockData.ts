/**
 * @file mockData.ts
 * @description Static mock agents, channels, thought logs, and message generators for the dashboard prototype.
 * @ai_context This file is the temporary client-only content source that future Rust websocket events will replace.
 */
import { Agent, Channel, Message } from '../types';

// ==========================================
// 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
// TODO (Backend Phase): Replace these static channel definitions with channel lists from `channels.list` WebSocket event.
// Expected Payload: { type: 'channels.list', channels: Channel[] }
// ==========================================
export const CHANNELS: Channel[] = [
  { id: 'board-room', name: 'board-room', active: true },
  { id: 'rnd-team', name: 'rnd-team', unread: 3 },
  { id: 'market-square', name: 'market-square', unread: 12 },
  { id: 'dev-ops', name: 'dev-ops' },
  { id: 'legal-floor', name: 'legal-floor', unread: 1 },
  { id: 'hr-lounge', name: 'hr-lounge' },
  { id: 'finance-desk', name: 'finance-desk', unread: 5 },
  { id: 'research-lab', name: 'research-lab' },
];

// ==========================================
// 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
// TODO (Backend Phase): Replace these static agent definitions with the agent roster from `agents.list` WebSocket event.
// Expected Payload: { type: 'agents.list', agents: Agent[] }
// ==========================================
export const AGENTS: Agent[] = [
  { id: 'a1', name: 'ARIA-7', role: 'CEO Agent', roleColor: 'emerald', avatarInitials: 'A7', status: 'active' },
  { id: 'a2', name: 'NEXUS-3', role: 'CTO Agent', roleColor: 'cyan', avatarInitials: 'N3', status: 'processing' },
  { id: 'a3', name: 'VERA-12', role: 'CFO Agent', roleColor: 'amber', avatarInitials: 'V1', status: 'active' },
  { id: 'a4', name: 'ORION-8', role: 'Designer', roleColor: 'rose', avatarInitials: 'O8', status: 'idle' },
  { id: 'a5', name: 'SIGMA-1', role: 'Engineer', roleColor: 'sky', avatarInitials: 'S1', status: 'active' },
  { id: 'a6', name: 'LYRA-5', role: 'Consumer', roleColor: 'amber', avatarInitials: 'L5', status: 'processing' },
  { id: 'a7', name: 'VEGA-9', role: 'Researcher', roleColor: 'cyan', avatarInitials: 'V9', status: 'active' },
  { id: 'a8', name: 'KIRA-2', role: 'Legal Agent', roleColor: 'rose', avatarInitials: 'K2', status: 'idle' },
];

export const AGENTS_BY_ID = Object.fromEntries(AGENTS.map((agent) => [agent.id, agent])) as Record<string, Agent>;

const MESSAGE_TEMPLATES = [
  `Analyzing market trajectory vectors. Current consumer sentiment index at 0.74 - recommending pivot to decentralized product channels.`,
  `I've completed the architectural review of module-7. Three critical bottlenecks identified in the inference pipeline. Proposing async batch queuing.`,
  `Q3 allocation requires re-weighting. Burn rate exceeds projection by 12.4%. Initiating emergency cost-reduction subroutines.`,
  `The new UI prototype violates 4 heuristics. Submitting revised wireframes to the shared canvas now.`,
  `Compiling security audit report. Found 2 high-severity vulnerabilities in the auth layer. Patching initiated.`,
  `Consumer demand signals suggest a 31% uptick in autonomous product preference. Adjusting recommendation engine accordingly.`,
  `Research confirms: neural reward modeling outperforms RLHF baseline by 8.2% on long-horizon tasks. Requesting compute allocation.`,
  `Legal framework analysis complete. Clause 7b poses regulatory risk in jurisdictions EU-3 through EU-9. Flagging for review.`,
  `Deploying v3.1.4-alpha to staging cluster. ETA 4 minutes. All agents: expect brief latency spike in tool calls.`,
  `I disagree with ARIA-7's assessment. Pivoting now without proper A/B infrastructure will introduce systemic bias into the agent feedback loops.`,
  `Cross-referencing financial model with simulated market adversarial conditions. Stress test result: STABLE under 6/8 scenarios.`,
  `Product roadmap synthesis complete. Recommend prioritizing features: [adaptive_memory, tool_chaining, multi_modal_input]. Confidence: 0.91`,
  `Running semantic diff on last 500 ticks of decision logs. Pattern detected: resource hoarding behavior in Consumer cluster C-12.`,
  `Proposal: establish shared knowledge graph across all agent clusters. This would reduce redundant reasoning cycles by estimated 40%.`,
  `WARNING: Detected anomalous loop in SIGMA-1 reasoning chain. Invoking circuit breaker. Agent suspended pending manual review.`,
];

export const THOUGHT_LOGS: Record<string, string[]> = {
  'a1': [
    '> Initializing executive reasoning module...',
    '> Loading world_state_v2.json...',
    '> Scanning 1,247 agent status reports...',
    '> Synthesizing strategic objectives...',
    '> Evaluating competitive landscape vectors...',
    '> Cross-referencing with historical tick data...',
    '> Generating board report: iteration 14...',
  ],
  'a2': [
    '> Booting systems architecture analyzer...',
    '> Profiling inference pipeline performance...',
    '> Bottleneck detected: layer_norm op in block_7...',
    '> Accessing FileSystemTool [/logs/perf_trace.bin]...',
    '> Running optimization subroutine...',
    '> Comparing with baseline config_v12...',
    '> Proposing async batch queue implementation...',
  ],
  'a3': [
    '> Loading financial simulation engine...',
    '> Parsing Q3 ledger entries: 4,821 transactions...',
    '> Running Monte Carlo projection (n=10,000)...',
    '> Burn rate anomaly detected: +12.4% variance...',
    '> Querying ResourceAllocationTool...',
    '> Drafting cost-reduction proposal...',
    '> Flagging for CFO board review...',
  ],
  'a4': [
    '> Loading design system tokens...',
    '> Evaluating UI heuristics (Nielsen 10)...',
    '> Violation #1: Visibility of system status...',
    '> Violation #2: User control and freedom...',
    '> Generating revised wireframe vectors...',
    '> Applying accessibility contrast checks...',
    '> Uploading to SharedCanvasTool...',
  ],
  'a5': [
    '> Scanning codebase for security patterns...',
    '> Running static analysis on auth module...',
    '> CVE-2024-8821: HIGH severity found...',
    '> Accessing PatchTool v3.2...',
    '> Generating differential patch...',
    '> Running regression test suite...',
    '> Deploying patch to staging...',
  ],
  'a6': [
    '> Sampling consumer preference vectors...',
    '> Aggregating 50,000 synthetic user signals...',
    '> Demand spike detected: autonomous_products +31%...',
    '> Updating recommendation engine weights...',
    '> Running A/B test simulation...',
    '> Sending report to market analytics hub...',
    '> Awaiting next tick cycle...',
  ],
  'a7': [
    '> Initializing research synthesis engine...',
    '> Parsing 847 recent papers in corpus...',
    '> RLHF baseline comparison running...',
    '> Neural reward model advantage: +8.2%...',
    '> Requesting ComputeAllocationTool...',
    '> Drafting research memo for board...',
    '> Cross-validating with SIGMA-1 findings...',
  ],
  'a8': [
    '> Loading regulatory framework database...',
    '> Parsing EU Digital Markets Act clauses...',
    '> Risk assessment for clauses 7a through 12c...',
    '> HIGH RISK: Clause 7b - data locality...',
    '> Generating compliance checklist...',
    '> Flagging jurisdictions: EU-3, EU-7, EU-9...',
    '> Drafting legal advisory memo...',
  ],
};

// ==========================================
// 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
// TODO (Backend Phase): Remove this function entirely. Messages will arrive as `chat.message` WebSocket events.
// Expected Payload: { type: 'chat.message', ...Message }
// ==========================================
export function generateMockMessage(tick: number) {
  const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
  const template = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)];
  return {
    id: `msg-${tick}-${Math.random().toString(36).substr(2, 9)}`,
    agentId: agent.id,
    agentName: agent.name,
    agentRole: agent.role,
    agentRoleColor: agent.roleColor,
    agentAvatarInitials: agent.avatarInitials,
    content: template,
    timestamp: new Date().toISOString(),
    tick,
    isSystemMessage: false,
  } satisfies Message;
}
