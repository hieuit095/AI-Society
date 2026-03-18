/**
 * @file world.ts
 * @description Shared frontend type contracts for the ZeroClaw AI Society dashboard.
 * @ai_context These interfaces mirror the Rust websocket payloads and the projected UI state.
 */
export type AgentRoleColor = 'emerald' | 'amber' | 'cyan' | 'rose' | 'sky';

export type AgentStatus = 'active' | 'awake' | 'idle' | 'processing' | 'suspended' | 'failed';

export type CitizenStatus = 'Awake' | 'Sleeping';

export type WorldView = 'hub' | 'analytics' | 'map' | 'citizens' | 'settings';

export interface Agent {
  id: string;
  name: string;
  role: string;
  roleColor: AgentRoleColor;
  avatarInitials: string;
  status: AgentStatus;
}

export interface Channel {
  id: string;
  name: string;
  unread?: number;
  active?: boolean;
}

export interface Message {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  agentRoleColor: string;
  agentAvatarInitials: string;
  channelId: string;
  content: string;
  timestamp: string;
  tick: number;
  isSystemMessage: boolean;
}

export interface AnalyticsPoint {
  tick: number;
  positive: number;
  negative: number;
  tokens: number;
  adoption: number;
  simulatedRevenue: number;
  tickLatencyMs: number;
  recallLatencyMs: number;
  wsQueueDepth: number;
}

export interface Citizen {
  id: string;
  name: string;
  role: string;
  status: CitizenStatus;
  memoryUsage: string;
  connections: string[];
}

export interface GraphNode {
  id: string;
  name: string;
  val: number;
  group: string;
  status: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
