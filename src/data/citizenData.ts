/**
 * @file citizenData.ts
 * @description Extended citizen records and aggregate sector stats for unused prototype exploration views.
 * @ai_context This dataset is currently dormant and should either be removed or reconciled with the main Rust-backed citizen model later.
 */
import { Agent } from '../types';

export interface Citizen extends Agent {
  sector: string;
  tokensUsed: number;
  decisions: number;
  uptime: number;
  memoryMb: number;
  lastActive: string;
}

export type CitizenStatus = 'active' | 'idle' | 'processing' | 'suspended' | 'error';

export interface ExtendedCitizen {
  id: string;
  name: string;
  role: string;
  roleColor: Agent['roleColor'];
  avatarInitials: string;
  status: 'active' | 'idle' | 'processing';
  sector: string;
  tokensUsed: number;
  decisions: number;
  uptime: number;
  memoryMb: number;
}

const ROLES: Array<{ role: string; roleColor: Agent['roleColor'] }> = [
  { role: 'CEO Agent', roleColor: 'emerald' },
  { role: 'CTO Agent', roleColor: 'cyan' },
  { role: 'CFO Agent', roleColor: 'amber' },
  { role: 'Designer', roleColor: 'rose' },
  { role: 'Engineer', roleColor: 'sky' },
  { role: 'Consumer', roleColor: 'amber' },
  { role: 'Researcher', roleColor: 'cyan' },
  { role: 'Legal Agent', roleColor: 'rose' },
  { role: 'Marketing', roleColor: 'emerald' },
  { role: 'Analyst', roleColor: 'sky' },
  { role: 'Operator', roleColor: 'cyan' },
  { role: 'Strategist', roleColor: 'emerald' },
];

const SECTORS = ['Alpha Sector', 'Beta Sector', 'Commerce Hub', 'Research Zone', 'Industrial Core', 'Frontier'];

const STATUSES: Array<'active' | 'idle' | 'processing'> = ['active', 'idle', 'processing'];

const PREFIXES = ['ARIA', 'NEXUS', 'VERA', 'ORION', 'SIGMA', 'LYRA', 'VEGA', 'KIRA', 'ZETA', 'ECHO', 'NOVA', 'FLUX', 'HELIX', 'AXON', 'QUARK', 'PRISM', 'DELTA', 'OMEGA', 'TITAN', 'CIPHER'];

function seed(n: number) {
  return ((n * 1664525 + 1013904223) & 0xffffffff) >>> 0;
}

export const ALL_CITIZENS: ExtendedCitizen[] = Array.from({ length: 64 }, (_, i) => {
  const s = seed(i + 7);
  const roleIdx = s % ROLES.length;
  const prefixIdx = i % PREFIXES.length;
  const num = (seed(i * 3 + 1) % 98) + 1;
  const statusIdx = seed(i * 7) % 3;
  const sectorIdx = seed(i * 11) % SECTORS.length;
  const role = ROLES[roleIdx];
  return {
    id: `c${i + 1}`,
    name: `${PREFIXES[prefixIdx]}-${num}`,
    role: role.role,
    roleColor: role.roleColor,
    avatarInitials: `${PREFIXES[prefixIdx][0]}${num}`,
    status: STATUSES[statusIdx],
    sector: SECTORS[sectorIdx],
    tokensUsed: seed(i * 13) % 48000 + 1200,
    decisions: seed(i * 17) % 2400 + 50,
    uptime: (seed(i * 19) % 9900 + 100) / 100,
    memoryMb: seed(i * 23) % 480 + 24,
  };
});

export const SECTOR_STATS = SECTORS.map((sector) => {
  const members = ALL_CITIZENS.filter((c) => c.sector === sector);
  const active = members.filter((c) => c.status === 'active').length;
  const totalTokens = members.reduce((sum, c) => sum + c.tokensUsed, 0);
  return { name: sector, total: members.length, active, totalTokens };
});
