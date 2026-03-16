/**
 * @file useWorldStore.ts
 * @description Central Zustand store for the God-Mode dashboard's mocked simulation state and UI controls.
 * @ai_context This is the temporary client-authoritative world model that will later become a websocket-hydrated projection of the Rust + ZeroClaw backend.
 */
import { create } from 'zustand';
import { generateMockMessage } from '../data/mockData';
import { Agent, AnalyticsPoint, Citizen, GraphData, GraphLink, GraphNode, Message, WorldView } from '../types';

export interface WorldState {
  isPlaying: boolean;
  currentTick: number;
  messages: Message[];
  selectedAgent: Agent | null;
  activeChannel: string;
  awakeAgents: number;
  totalAgents: number;
  rustRam: number;
  currentView: WorldView;
  isSeedModalOpen: boolean;
  analyticsData: AnalyticsPoint[];
  citizens: Citizen[];
  graphData: GraphData;

  togglePlay: () => void;
  setSelectedAgent: (agent: Agent | null) => void;
  clearSelectedAgent: () => void;
  addMessage: (message: Message) => void;
  setActiveChannel: (channelId: string) => void;
  incrementTick: () => void;
  setCurrentView: (view: WorldView) => void;
  openSeedModal: () => void;
  closeSeedModal: () => void;
  injectSeed: (title: string) => void;
}

// ==========================================
// 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
// TODO (Backend Phase): Replace this static mock seed with the initial message snapshot from `session.init` WebSocket event.
// Expected Payload: { type: 'session.init', messages: Message[] }
// ==========================================
const INITIAL_MESSAGES: Message[] = Array.from({ length: 12 }, (_, i) =>
  generateMockMessage(14000 + i * 10)
);

// ==========================================
// 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
// TODO (Backend Phase): Replace this random analytics seed with the initial analytics snapshot from `session.init`.
// Expected Payload: { type: 'session.init', analyticsHistory: AnalyticsPoint[] }
// ==========================================
const INITIAL_ANALYTICS: AnalyticsPoint[] = Array.from({ length: 20 }, (_, i) => ({
  tick: 14000 + i * 50,
  positive: Math.round(Math.random() * 50 + 20),
  negative: Math.round(Math.random() * 30),
  tokens: Math.round((14000 + i * 50) * 2.5),
  adoption: Math.round(Math.random() * 100),
}));

const ROLES = ['CEO', 'CTO', 'Engineer', 'Consumer', 'Researcher', 'Analyst'];
const NAME_PARTS = [
  'Nexus', 'Cipher', 'Axiom', 'Vex', 'Pulse', 'Qubit', 'Flux', 'Helix',
  'Orion', 'Nova', 'Prism', 'Echo', 'Sigma', 'Delta', 'Titan', 'Aria',
  'Lyra', 'Vega', 'Zeta', 'Kira', 'Neon', 'Byte', 'Volt', 'Arc',
];

function pseudoRand(seed: number): number {
  let s = seed;
  s = ((s >>> 16) ^ s) * 0x45d9f3b;
  s = ((s >>> 16) ^ s) * 0x45d9f3b;
  s = (s >>> 16) ^ s;
  return (s >>> 0) / 0xffffffff;
}

// ==========================================
// 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
// TODO (Backend Phase): Replace this deterministic citizen generator with the citizen roster from `citizens.snapshot` WebSocket event.
// Expected Payload: { type: 'citizens.snapshot', citizens: Citizen[] }
// ==========================================
function generateCitizens(): Citizen[] {
  return Array.from({ length: 150 }, (_, i) => {
    const r1 = pseudoRand(i * 7 + 1);
    const r2 = pseudoRand(i * 13 + 3);
    const r3 = pseudoRand(i * 19 + 5);
    const r4 = pseudoRand(i * 23 + 7);
    const r5 = pseudoRand(i * 31 + 11);

    const nameIdx = Math.floor(r1 * NAME_PARTS.length);
    const num = Math.floor(r2 * 99) + 1;
    const role = ROLES[Math.floor(r3 * ROLES.length)];
    const status = r4 > 0.35 ? 'Awake' : 'Sleeping';
    const memMb = (r5 * 58 + 4).toFixed(1);

    const connCount = 2 + Math.floor(pseudoRand(i * 41 + 13) * 3);
    const connections: string[] = [];
    for (let c = 0; c < connCount; c++) {
      let target = Math.floor(pseudoRand(i * 53 + c * 17 + 29) * 150) + 1;
      if (target === i + 1) target = (target % 150) + 1;
      const tid = `AGT-${String(target).padStart(3, '0')}`;
      if (!connections.includes(tid)) connections.push(tid);
    }

    return {
      id: `AGT-${String(i + 1).padStart(3, '0')}`,
      name: `${NAME_PARTS[nameIdx]}-${num}`,
      role,
      status,
      memoryUsage: `${memMb} MB`,
      connections,
    };
  });
}

// ==========================================
// 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
// TODO (Backend Phase): Replace this client-built graph with topology snapshots from `graph.snapshot` WebSocket event.
// Expected Payload: { type: 'graph.snapshot', nodes: GraphNode[], links: GraphLink[] }
// ==========================================
function buildGraphData(citizens: Citizen[]): GraphData {
  const nodes: GraphNode[] = citizens.map((c) => ({
    id: c.id,
    name: c.name,
    val: 1.5,
    group: c.role,
    status: c.status,
  }));

  const seen = new Set<string>();
  const links: GraphLink[] = [];
  for (const c of citizens) {
    for (const target of c.connections) {
      const key = [c.id, target].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        links.push({ source: c.id, target });
      }
    }
  }

  return { nodes, links };
}

const INITIAL_CITIZENS = generateCitizens();
const INITIAL_GRAPH = buildGraphData(INITIAL_CITIZENS);

export const useWorldStore = create<WorldState>((set) => ({
  isPlaying: false,
  currentTick: 14052,
  messages: INITIAL_MESSAGES,
  selectedAgent: null,
  activeChannel: 'board-room',
  awakeAgents: 842,
  totalAgents: 1000,
  rustRam: 45,
  currentView: 'hub',
  isSeedModalOpen: false,
  analyticsData: INITIAL_ANALYTICS,
  citizens: INITIAL_CITIZENS,
  graphData: INITIAL_GRAPH,

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),

  clearSelectedAgent: () => set({ selectedAgent: null }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages.slice(-199), message],
    })),

  setActiveChannel: (channelId) => set({ activeChannel: channelId }),

  setCurrentView: (view) => set({ currentView: view }),

  openSeedModal: () => set({ isSeedModalOpen: true }),

  closeSeedModal: () => set({ isSeedModalOpen: false }),

  // ==========================================
  // 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
  // TODO (Backend Phase): Replace this local seed.applied reducer with the server-authored `seed.applied` WebSocket event.
  // Expected Payload: { type: 'seed.applied', title: string, newTick: 0, systemMessage: Message }
  // ==========================================
  injectSeed: (title) =>
    set(() => {
      const systemMessage: Message = {
        id: `sys-${Date.now()}`,
        agentId: 'system',
        agentName: 'SYSTEM',
        agentRole: 'DIRECTIVE',
        agentRoleColor: 'rose',
        agentAvatarInitials: 'SY',
        content: `>>> NEW SEED DIRECTIVE INJECTED${title ? `: "${title}"` : ''}. AWAKENING AGENTS... ALL PRIOR CONTEXT PURGED. RE-INITIALIZING SIMULATION.`,
        timestamp: new Date().toISOString(),
        tick: 0,
        isSystemMessage: true,
      };
      return {
        isSeedModalOpen: false,
        currentTick: 0,
        messages: [systemMessage],
        isPlaying: true,
        currentView: 'hub',
        analyticsData: [],
      };
    }),

  // ==========================================
  // 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
  // TODO (Backend Phase): Replace this mocked tick loop with WebSocket-driven `tick.sync`, `chat.message`, and `analytics.tick` events.
  // Expected Payload: { type: 'tick.sync', tick: number, message: Message, analytics: AnalyticsPoint, awakeAgents: number, rustRam: number }
  // ==========================================
  incrementTick: () =>
    set((state) => {
      const newTick = state.currentTick + 1;
      const newMessage = generateMockMessage(newTick);
      const newRam = Math.max(30, Math.min(120, state.rustRam + (Math.random() - 0.45) * 2));
      const newAwake = Math.max(600, Math.min(1000, state.awakeAgents + Math.floor((Math.random() - 0.45) * 5)));
      const newPoint: AnalyticsPoint = {
        tick: newTick,
        positive: Math.round(Math.random() * 50 + 20),
        negative: Math.round(Math.random() * 30),
        tokens: Math.round(newTick * 2.5),
        adoption: Math.round(Math.random() * 100),
      };
      return {
        currentTick: newTick,
        messages: [...state.messages.slice(-199), newMessage],
        rustRam: Math.round(newRam),
        awakeAgents: newAwake,
        analyticsData: [...state.analyticsData.slice(-19), newPoint],
      };
    }),
}));
