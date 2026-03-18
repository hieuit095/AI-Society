/**
 * @file useWorldStore.ts
 * @description Central Zustand store for the God-Mode dashboard.
 */
import { create } from 'zustand';
import { Agent, AnalyticsPoint, Channel, Citizen, GraphData, Message, WorldView } from '../types';
import { sendCommand } from '../services/wsClient';

/** Fields hydrated from the Rust server via WebSocket. */
export interface ServerHydration {
  isPlaying: boolean;
  currentTick: number;
  awakeAgents: number;
  totalAgents: number;
  rustRam: number;
}

/** Inspector detail payload from `agent.detail` WS event. */
export interface InspectorDetail {
  agentId: string;
  name: string;
  role: string;
  roleColor: string;
  avatarInitials: string;
  status: string;
  lastTick: number;
  model: string;
  tier: string;
  tokensPerTick: number;
  tools: string[];
  thoughtLog: string[];
}

export interface WorldState {
  isPlaying: boolean;
  currentTick: number;
  awakeAgents: number;
  totalAgents: number;
  rustRam: number;
  messagesByChannel: Record<string, Message[]>;
  selectedAgent: Agent | null;
  activeChannel: string;
  currentView: WorldView;
  isSeedModalOpen: boolean;
  analyticsData: AnalyticsPoint[];
  citizens: Citizen[];
  graphData: GraphData;
  inspectorDetail: InspectorDetail | null;
  channels: Channel[];
  isBootstrapped: boolean;
  connectionStatus: 'stable' | 'degraded' | 'resyncing';
  togglePlay: () => void;
  hydrateFromServer: (data: ServerHydration) => void;
  hydrateGraph: (data: GraphData) => void;
  hydrateInspector: (detail: InspectorDetail) => void;
  handleSeedApplied: (systemMessage: Message) => void;
  appendAnalytics: (point: AnalyticsPoint) => void;
  applyStatusBatch: (changes: Array<{ agentId: string; status: string }>) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  clearSelectedAgent: () => void;
  addMessage: (message: Message) => void;
  addMessages: (messages: Message[]) => void;
  setActiveChannel: (channelId: string) => void;
  setCurrentView: (view: WorldView) => void;
  openSeedModal: () => void;
  closeSeedModal: () => void;
  injectSeed: (title: string) => void;
  setConnectionStatus: (status: 'stable' | 'degraded' | 'resyncing') => void;
}

const MAX_MESSAGES_PER_CHANNEL = 200;

function normalizeCitizenStatus(status: string): Citizen['status'] {
  return status === 'Awake' || status === 'awake' ? 'Awake' : 'Sleeping';
}

function normalizeAgentStatus(status: string): Agent['status'] {
  switch (status) {
    case 'awake':
    case 'active':
      return 'awake';
    case 'processing':
      return 'processing';
    case 'suspended':
      return 'suspended';
    case 'failed':
      return 'failed';
    default:
      return 'idle';
  }
}

function buildCitizensFromGraph(data: GraphData): Citizen[] {
  const connectionsById = new Map<string, Set<string>>();

  for (const node of data.nodes) {
    connectionsById.set(node.id, new Set<string>());
  }

  for (const link of data.links) {
    const source = String(link.source);
    const target = String(link.target);
    connectionsById.get(source)?.add(target);
    connectionsById.get(target)?.add(source);
  }

  return data.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    role: node.group,
    status: normalizeCitizenStatus(node.status),
    memoryUsage: '—',
    connections: Array.from(connectionsById.get(node.id) ?? []),
  }));
}

export const useWorldStore = create<WorldState>((set) => ({
  isPlaying: false,
  currentTick: 0,
  awakeAgents: 0,
  totalAgents: 0,
  rustRam: 0,
  messagesByChannel: {},
  selectedAgent: null,
  activeChannel: 'board-room',
  currentView: 'hub',
  isSeedModalOpen: false,
  analyticsData: [],
  citizens: [],
  graphData: { nodes: [], links: [] },
  inspectorDetail: null,
  channels: [
    { id: 'board-room', name: 'board-room', active: true },
    { id: 'rnd-team', name: 'rnd-team' },
    { id: 'market-square', name: 'market-square' },
    { id: 'dev-ops', name: 'dev-ops' },
    { id: 'legal-floor', name: 'legal-floor' },
    { id: 'hr-lounge', name: 'hr-lounge' },
    { id: 'finance-desk', name: 'finance-desk' },
    { id: 'research-lab', name: 'research-lab' },
  ],
  isBootstrapped: false,
  connectionStatus: 'stable',

  togglePlay: () => {
    const current = useWorldStore.getState().isPlaying;
    sendCommand('simulation.control', {
      type: 'simulationControl',
      action: current ? 'pause' : 'play',
    });
  },

  hydrateFromServer: (data: ServerHydration) =>
    set(() => ({ ...data, isBootstrapped: true })),

  hydrateGraph: (data: GraphData) =>
    set({
      graphData: data,
      citizens: buildCitizensFromGraph(data),
    }),

  hydrateInspector: (detail: InspectorDetail) =>
    set((state) => ({
      inspectorDetail: detail,
      selectedAgent: state.selectedAgent && state.selectedAgent.id === detail.agentId
        ? {
            ...state.selectedAgent,
            name: detail.name,
            role: detail.role,
            roleColor: detail.roleColor as Agent['roleColor'],
            avatarInitials: detail.avatarInitials,
            status: normalizeAgentStatus(detail.status),
          }
        : state.selectedAgent,
    })),

  handleSeedApplied: (systemMessage: Message) =>
    set({
      messagesByChannel: {
        'board-room': [systemMessage],
      },
      currentTick: 0,
      isSeedModalOpen: false,
      analyticsData: [],
      currentView: 'hub',
      inspectorDetail: null,
      selectedAgent: null,
    }),

  appendAnalytics: (point: AnalyticsPoint) =>
    set((state) => ({
      analyticsData: [...state.analyticsData.slice(-59), point],
    })),

  applyStatusBatch: (changes) =>
    set((state) => {
      if (changes.length === 0) return state;
      const lookup = new Map(changes.map((change) => [change.agentId, change.status]));

      return {
        citizens: state.citizens.map((citizen) => {
          const nextStatus = lookup.get(citizen.id);
          if (!nextStatus) return citizen;
          return { ...citizen, status: normalizeCitizenStatus(nextStatus) };
        }),
        graphData: {
          ...state.graphData,
          nodes: state.graphData.nodes.map((node) => {
            const nextStatus = lookup.get(node.id);
            if (!nextStatus) return node;
            return { ...node, status: normalizeCitizenStatus(nextStatus) };
          }),
        },
        selectedAgent: state.selectedAgent && lookup.has(state.selectedAgent.id)
          ? {
              ...state.selectedAgent,
              status: normalizeAgentStatus(lookup.get(state.selectedAgent.id) ?? state.selectedAgent.status),
            }
          : state.selectedAgent,
      };
    }),

  setSelectedAgent: (agent) => {
    set({ selectedAgent: agent, inspectorDetail: null });
    if (agent) {
      sendCommand('inspect.agent', { type: 'inspectAgent', agentId: agent.id });
    }
  },

  clearSelectedAgent: () => set({ selectedAgent: null, inspectorDetail: null }),

  addMessage: (message) =>
    set((state) => {
      const channelId = message.channelId || 'board-room';
      const existing = state.messagesByChannel[channelId] ?? [];
      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: [...existing.slice(-(MAX_MESSAGES_PER_CHANNEL - 1)), message],
        },
      };
    }),

  addMessages: (messages) =>
    set((state) => {
      const updated = { ...state.messagesByChannel };
      for (const message of messages) {
        const channelId = message.channelId || 'board-room';
        const existing = updated[channelId] ?? [];
        updated[channelId] = [...existing.slice(-(MAX_MESSAGES_PER_CHANNEL - 1)), message];
      }
      return { messagesByChannel: updated };
    }),

  setActiveChannel: (channelId) => set({ activeChannel: channelId }),

  setCurrentView: (view) => set({ currentView: view }),

  openSeedModal: () => set({ isSeedModalOpen: true }),

  closeSeedModal: () => set({ isSeedModalOpen: false }),

  injectSeed: (title) => {
    set({ isSeedModalOpen: false });
    sendCommand('seed.inject', {
      type: 'injectSeed',
      title,
      audience: '',
      context: '',
    });
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
