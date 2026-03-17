/**
 * @file useWorldStore.ts
 * @description Central Zustand store for the God-Mode dashboard.
 * @ai_context Phase 4: Server-authoritative state. Chat messages arrive via `chatMessage` WS events.
 *             Graph data arrives via `graphSnapshot` WS events. Inspector data via `agentDetail`.
 *             The mock `generateMockMessage` has been removed from hydration — chat is now server-driven.
 */
import { create } from 'zustand';
import { Agent, AnalyticsPoint, Citizen, GraphData, Message, WorldView } from '../types';
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
  model: string;
  tier: string;
  tokensPerTick: number;
  tools: string[];
  thoughtLog: string[];
}

export interface WorldState {
  // ── Server-authoritative fields (hydrated via WS) ──
  isPlaying: boolean;
  currentTick: number;
  awakeAgents: number;
  totalAgents: number;
  rustRam: number;

  // ── Client-side state ──
  messages: Message[];
  selectedAgent: Agent | null;
  activeChannel: string;
  currentView: WorldView;
  isSeedModalOpen: boolean;
  analyticsData: AnalyticsPoint[];
  citizens: Citizen[];
  graphData: GraphData;
  inspectorDetail: InspectorDetail | null;

  // ── Actions ──
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
  setActiveChannel: (channelId: string) => void;
  setCurrentView: (view: WorldView) => void;
  openSeedModal: () => void;
  closeSeedModal: () => void;
  injectSeed: (title: string) => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  // Server-authoritative (initial values, overwritten by WorldBootstrap)
  isPlaying: false,
  currentTick: 0,
  awakeAgents: 0,
  totalAgents: 0,
  rustRam: 0,

  // Client-side — empty until server hydrates via WebSocket
  messages: [],
  selectedAgent: null,
  activeChannel: 'board-room',
  currentView: 'hub',
  isSeedModalOpen: false,
  analyticsData: [],
  citizens: [],
  graphData: { nodes: [], links: [] },
  inspectorDetail: null,


  /**
   * Send play/pause command to the Rust server.
   */
  togglePlay: () => {
    const current = useWorldStore.getState().isPlaying;
    sendCommand('simulation.control', {
      type: 'simulationControl',
      action: current ? 'pause' : 'play',
    });
  },

  /**
   * Hydrate server-authoritative fields from WebSocket events.
   * Called on `world.bootstrap` and `tick.sync` events.
   * Analytics points are generated per tick for the chart visualizations.
   */
  hydrateFromServer: (data: ServerHydration) =>
    set(() => data),

  /**
   * Hydrate graph data from `graph.snapshot` WS event.
   */
  hydrateGraph: (data: GraphData) =>
    set({
      graphData: data,
      // Also update citizens from graph nodes
      citizens: data.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        role: n.group,
        status: n.status as 'Awake' | 'Sleeping',
        memoryUsage: '—',
        connections: [],
      })),
    }),

  /**
   * Hydrate inspector detail from `agent.detail` WS event.
   */
  hydrateInspector: (detail: InspectorDetail) =>
    set({ inspectorDetail: detail }),

  /**
   * Handle `seedApplied` event from the Rust backend.
   * Clears all local messages, resets tick to 0, closes the seed modal,
   * and appends the server-authored system directive as the first message.
   */
  handleSeedApplied: (systemMessage: Message) =>
    set({
      messages: [systemMessage],
      currentTick: 0,
      isSeedModalOpen: false,
      analyticsData: [],
      currentView: 'hub',
      inspectorDetail: null,
      selectedAgent: null,
    }),

  /**
   * Append a server-computed analytics data point from `analytics.tick` WS event.
   */
  appendAnalytics: (point: AnalyticsPoint) =>
    set((state) => ({
      analyticsData: [...state.analyticsData.slice(-19), point],
    })),

  /**
   * Apply batched agent status changes from `agent.status.batch` WS event.
   * Single state mutation for all changes — avoids N re-renders.
   */
  applyStatusBatch: (changes) =>
    set((state) => {
      if (changes.length === 0) return state;
      const lookup = new Map(changes.map((c) => [c.agentId, c.status]));
      return {
        citizens: state.citizens.map((cit) => {
          const newStatus = lookup.get(cit.id);
          if (!newStatus) return cit;
          return { ...cit, status: newStatus === 'awake' ? 'Awake' : 'Sleeping' };
        }),
      };
    }),

  setSelectedAgent: (agent) => set({ selectedAgent: agent, inspectorDetail: null }),

  clearSelectedAgent: () => set({ selectedAgent: null, inspectorDetail: null }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages.slice(-199), message],
    })),

  setActiveChannel: (channelId) => set({ activeChannel: channelId }),

  setCurrentView: (view) => set({ currentView: view }),

  openSeedModal: () => set({ isSeedModalOpen: true }),

  closeSeedModal: () => set({ isSeedModalOpen: false }),

  injectSeed: (title) => {
    // Close the modal immediately for responsive UX.
    // All world-state mutations are FORBIDDEN here — they arrive
    // exclusively via the server's `seed.applied` event, handled
    // by `handleSeedApplied`.
    set({ isSeedModalOpen: false });
    sendCommand('clientCommand', {
      type: 'injectSeed',
      title,
      audience: '',
      context: '',
    });
  },
}));
