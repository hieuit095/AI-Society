/**
 * @file mapData.ts
 * @description Legacy static territory map dataset from an earlier world-map concept.
 * @ai_context This file is currently unused by the active force-graph implementation and should be kept only as a legacy reference.
 */
export interface Territory {
  id: string;
  name: string;
  color: string;
  strokeColor: string;
  glowColor: string;
  labelColor: string;
  path: string;
  labelX: number;
  labelY: number;
  agents: number;
  active: number;
  threat: 'low' | 'medium' | 'high';
}

export interface AgentNode {
  id: string;
  x: number;
  y: number;
  territory: string;
  color: string;
  glowColor: string;
  size: number;
  pulse: boolean;
  pulseDelay: number;
}

export interface Connection {
  from: string;
  to: string;
}

export const TERRITORIES: Territory[] = [
  {
    id: 'alpha',
    name: 'Alpha Sector',
    color: 'rgba(16,185,129,0.06)',
    strokeColor: 'rgba(16,185,129,0.35)',
    glowColor: '#10b981',
    labelColor: '#34d399',
    path: 'M 0,0 L 360,0 L 400,180 L 160,240 L 0,180 Z',
    labelX: 155,
    labelY: 100,
    agents: 18,
    active: 12,
    threat: 'low',
  },
  {
    id: 'beta',
    name: 'Beta Sector',
    color: 'rgba(6,182,212,0.06)',
    strokeColor: 'rgba(6,182,212,0.35)',
    glowColor: '#06b6d4',
    labelColor: '#22d3ee',
    path: 'M 360,0 L 900,0 L 900,200 L 620,240 L 400,180 Z',
    labelX: 640,
    labelY: 90,
    agents: 22,
    active: 15,
    threat: 'low',
  },
  {
    id: 'commerce',
    name: 'Commerce Hub',
    color: 'rgba(245,158,11,0.06)',
    strokeColor: 'rgba(245,158,11,0.35)',
    glowColor: '#f59e0b',
    labelColor: '#fbbf24',
    path: 'M 160,240 L 400,180 L 620,240 L 580,400 L 180,400 Z',
    labelX: 390,
    labelY: 310,
    agents: 31,
    active: 24,
    threat: 'medium',
  },
  {
    id: 'research',
    name: 'Research Zone',
    color: 'rgba(56,189,248,0.06)',
    strokeColor: 'rgba(56,189,248,0.3)',
    glowColor: '#38bdf8',
    labelColor: '#7dd3fc',
    path: 'M 0,180 L 160,240 L 180,400 L 40,480 L 0,420 Z',
    labelX: 70,
    labelY: 330,
    agents: 9,
    active: 6,
    threat: 'low',
  },
  {
    id: 'industrial',
    name: 'Industrial Core',
    color: 'rgba(244,63,94,0.06)',
    strokeColor: 'rgba(244,63,94,0.3)',
    glowColor: '#f43f5e',
    labelColor: '#fb7185',
    path: 'M 620,240 L 900,200 L 900,560 L 680,560 L 560,420 L 580,400 Z',
    labelX: 730,
    labelY: 370,
    agents: 14,
    active: 7,
    threat: 'high',
  },
  {
    id: 'frontier',
    name: 'Frontier',
    color: 'rgba(113,113,122,0.05)',
    strokeColor: 'rgba(113,113,122,0.25)',
    glowColor: '#71717a',
    labelColor: '#a1a1aa',
    path: 'M 40,480 L 180,400 L 560,420 L 680,560 L 0,560 L 0,420 Z',
    labelX: 290,
    labelY: 500,
    agents: 6,
    active: 2,
    threat: 'medium',
  },
];

export const AGENT_NODES: AgentNode[] = [
  { id: 'n1',  x: 80,  y: 60,  territory: 'alpha',    color: '#10b981', glowColor: '#10b981', size: 4, pulse: true,  pulseDelay: 0 },
  { id: 'n2',  x: 160, y: 40,  territory: 'alpha',    color: '#34d399', glowColor: '#10b981', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n3',  x: 240, y: 80,  territory: 'alpha',    color: '#10b981', glowColor: '#10b981', size: 5, pulse: true,  pulseDelay: 0.4 },
  { id: 'n4',  x: 310, y: 50,  territory: 'alpha',    color: '#6ee7b7', glowColor: '#10b981', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n5',  x: 200, y: 140, territory: 'alpha',    color: '#10b981', glowColor: '#10b981', size: 4, pulse: true,  pulseDelay: 0.8 },
  { id: 'n6',  x: 100, y: 130, territory: 'alpha',    color: '#34d399', glowColor: '#10b981', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n7',  x: 60,  y: 100, territory: 'alpha',    color: '#10b981', glowColor: '#10b981', size: 3, pulse: false, pulseDelay: 0 },

  { id: 'n8',  x: 480, y: 50,  territory: 'beta',     color: '#06b6d4', glowColor: '#06b6d4', size: 5, pulse: true,  pulseDelay: 0.2 },
  { id: 'n9',  x: 580, y: 80,  territory: 'beta',     color: '#22d3ee', glowColor: '#06b6d4', size: 4, pulse: false, pulseDelay: 0 },
  { id: 'n10', x: 680, y: 40,  territory: 'beta',     color: '#06b6d4', glowColor: '#06b6d4', size: 3, pulse: true,  pulseDelay: 0.6 },
  { id: 'n11', x: 780, y: 70,  territory: 'beta',     color: '#67e8f9', glowColor: '#06b6d4', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n12', x: 840, y: 120, territory: 'beta',     color: '#06b6d4', glowColor: '#06b6d4', size: 4, pulse: true,  pulseDelay: 1.0 },
  { id: 'n13', x: 560, y: 160, territory: 'beta',     color: '#22d3ee', glowColor: '#06b6d4', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n14', x: 450, y: 100, territory: 'beta',     color: '#06b6d4', glowColor: '#06b6d4', size: 3, pulse: false, pulseDelay: 0 },

  { id: 'n15', x: 270, y: 280, territory: 'commerce', color: '#f59e0b', glowColor: '#f59e0b', size: 6, pulse: true,  pulseDelay: 0 },
  { id: 'n16', x: 360, y: 250, territory: 'commerce', color: '#fbbf24', glowColor: '#f59e0b', size: 4, pulse: true,  pulseDelay: 0.3 },
  { id: 'n17', x: 450, y: 300, territory: 'commerce', color: '#f59e0b', glowColor: '#f59e0b', size: 5, pulse: true,  pulseDelay: 0.7 },
  { id: 'n18', x: 520, y: 260, territory: 'commerce', color: '#fcd34d', glowColor: '#f59e0b', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n19', x: 320, y: 350, territory: 'commerce', color: '#f59e0b', glowColor: '#f59e0b', size: 4, pulse: true,  pulseDelay: 0.5 },
  { id: 'n20', x: 420, y: 370, territory: 'commerce', color: '#fbbf24', glowColor: '#f59e0b', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n21', x: 220, y: 310, territory: 'commerce', color: '#f59e0b', glowColor: '#f59e0b', size: 3, pulse: false, pulseDelay: 0 },

  { id: 'n22', x: 60,  y: 280, territory: 'research', color: '#38bdf8', glowColor: '#38bdf8', size: 4, pulse: true,  pulseDelay: 0.4 },
  { id: 'n23', x: 110, y: 340, territory: 'research', color: '#7dd3fc', glowColor: '#38bdf8', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n24', x: 80,  y: 410, territory: 'research', color: '#38bdf8', glowColor: '#38bdf8', size: 3, pulse: false, pulseDelay: 0 },

  { id: 'n25', x: 660, y: 280, territory: 'industrial', color: '#f43f5e', glowColor: '#f43f5e', size: 5, pulse: true,  pulseDelay: 0.6 },
  { id: 'n26', x: 750, y: 310, territory: 'industrial', color: '#fb7185', glowColor: '#f43f5e', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n27', x: 830, y: 360, territory: 'industrial', color: '#f43f5e', glowColor: '#f43f5e', size: 4, pulse: true,  pulseDelay: 0.9 },
  { id: 'n28', x: 700, y: 420, territory: 'industrial', color: '#fda4af', glowColor: '#f43f5e', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n29', x: 850, y: 460, territory: 'industrial', color: '#f43f5e', glowColor: '#f43f5e', size: 3, pulse: false, pulseDelay: 0 },

  { id: 'n30', x: 200, y: 450, territory: 'frontier', color: '#71717a', glowColor: '#a1a1aa', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n31', x: 360, y: 470, territory: 'frontier', color: '#52525b', glowColor: '#71717a', size: 3, pulse: false, pulseDelay: 0 },
  { id: 'n32', x: 480, y: 460, territory: 'frontier', color: '#71717a', glowColor: '#a1a1aa', size: 3, pulse: true,  pulseDelay: 1.2 },
];

export const CONNECTIONS: Connection[] = [
  { from: 'n3',  to: 'n8'  },
  { from: 'n5',  to: 'n15' },
  { from: 'n13', to: 'n17' },
  { from: 'n15', to: 'n22' },
  { from: 'n17', to: 'n25' },
  { from: 'n19', to: 'n30' },
  { from: 'n27', to: 'n31' },
  { from: 'n8',  to: 'n16' },
  { from: 'n6',  to: 'n21' },
];

const NODE_MAP = Object.fromEntries(AGENT_NODES.map((n) => [n.id, n]));

export function getNodeById(id: string): AgentNode | undefined {
  return NODE_MAP[id];
}
