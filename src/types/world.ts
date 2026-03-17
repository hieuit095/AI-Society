/**
 * @file world.ts
 * @description Shared frontend type contracts for the mocked ZeroClaw AI Society dashboard.
 * @ai_context These interfaces mirror the current client-side world state and act as the stable bridge
 * between today's Zustand prototype and the future Rust websocket payloads.
 */
export type AgentRoleColor = 'emerald' | 'amber' | 'cyan' | 'rose' | 'sky';

export type AgentStatus = 'active' | 'idle' | 'processing';

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
