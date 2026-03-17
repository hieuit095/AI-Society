/**
 * @file mockData.ts
 * @description Static mock agents, channels, thought logs, and message generators for the dashboard prototype.
 * @ai_context This file is the temporary client-only content source that future Rust websocket events will replace.
 */
import { Agent, Channel } from '../types';

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
  { id: 'AGT-001', name: 'ARIA-7', role: 'CEO Agent', roleColor: 'emerald', avatarInitials: 'A7', status: 'active' },
  { id: 'AGT-002', name: 'NEXUS-3', role: 'CTO Agent', roleColor: 'cyan', avatarInitials: 'N3', status: 'processing' },
  { id: 'AGT-003', name: 'VERA-12', role: 'CFO Agent', roleColor: 'amber', avatarInitials: 'V1', status: 'active' },
  { id: 'AGT-004', name: 'ORION-8', role: 'Designer', roleColor: 'rose', avatarInitials: 'O8', status: 'idle' },
  { id: 'AGT-005', name: 'SIGMA-1', role: 'Engineer', roleColor: 'sky', avatarInitials: 'S1', status: 'active' },
  { id: 'AGT-006', name: 'LYRA-5', role: 'Consumer', roleColor: 'amber', avatarInitials: 'L5', status: 'processing' },
  { id: 'AGT-007', name: 'VEGA-9', role: 'Researcher', roleColor: 'cyan', avatarInitials: 'V9', status: 'active' },
  { id: 'AGT-008', name: 'KIRA-2', role: 'Legal Agent', roleColor: 'rose', avatarInitials: 'K2', status: 'idle' },
];

export const AGENTS_BY_ID = Object.fromEntries(AGENTS.map((agent) => [agent.id, agent])) as Record<string, Agent>;

export const THOUGHT_LOGS: Record<string, string[]> = {
  'AGT-001': [
    '> Initializing executive reasoning module...',
    '> Loading world_state_v2.json...',
    '> Scanning 1,247 agent status reports...',
    '> Synthesizing strategic objectives...',
    '> Evaluating competitive landscape vectors...',
    '> Cross-referencing with historical tick data...',
    '> Generating board report: iteration 14...',
  ],
  'AGT-002': [
    '> Booting systems architecture analyzer...',
    '> Profiling inference pipeline performance...',
    '> Bottleneck detected: layer_norm op in block_7...',
    '> Accessing FileSystemTool [/logs/perf_trace.bin]...',
    '> Running optimization subroutine...',
    '> Comparing with baseline config_v12...',
    '> Proposing async batch queue implementation...',
  ],
  'AGT-003': [
    '> Loading financial simulation engine...',
    '> Parsing Q3 ledger entries: 4,821 transactions...',
    '> Running Monte Carlo projection (n=10,000)...',
    '> Burn rate anomaly detected: +12.4% variance...',
    '> Querying ResourceAllocationTool...',
    '> Drafting cost-reduction proposal...',
    '> Flagging for CFO board review...',
  ],
  'AGT-004': [
    '> Loading design system tokens...',
    '> Evaluating UI heuristics (Nielsen 10)...',
    '> Violation #1: Visibility of system status...',
    '> Violation #2: User control and freedom...',
    '> Generating revised wireframe vectors...',
    '> Applying accessibility contrast checks...',
    '> Uploading to SharedCanvasTool...',
  ],
  'AGT-005': [
    '> Scanning codebase for security patterns...',
    '> Running static analysis on auth module...',
    '> CVE-2024-8821: HIGH severity found...',
    '> Accessing PatchTool v3.2...',
    '> Generating differential patch...',
    '> Running regression test suite...',
    '> Deploying patch to staging...',
  ],
  'AGT-006': [
    '> Sampling consumer preference vectors...',
    '> Aggregating 50,000 synthetic user signals...',
    '> Demand spike detected: autonomous_products +31%...',
    '> Updating recommendation engine weights...',
    '> Running A/B test simulation...',
    '> Sending report to market analytics hub...',
    '> Awaiting next tick cycle...',
  ],
  'AGT-007': [
    '> Initializing research synthesis engine...',
    '> Parsing 847 recent papers in corpus...',
    '> RLHF baseline comparison running...',
    '> Neural reward model advantage: +8.2%...',
    '> Requesting ComputeAllocationTool...',
    '> Drafting research memo for board...',
    '> Cross-validating with SIGMA-1 findings...',
  ],
  'AGT-008': [
    '> Loading regulatory framework database...',
    '> Parsing EU Digital Markets Act clauses...',
    '> Risk assessment for clauses 7a through 12c...',
    '> HIGH RISK: Clause 7b - data locality...',
    '> Generating compliance checklist...',
    '> Flagging jurisdictions: EU-3, EU-7, EU-9...',
    '> Drafting legal advisory memo...',
  ],
};

