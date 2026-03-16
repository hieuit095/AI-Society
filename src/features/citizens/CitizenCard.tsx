/**
 * @file CitizenCard.tsx
 * @description Card-style citizen presentation component from an earlier prototype iteration.
 * @ai_context This file is currently unused and should be treated as a legacy UI fragment unless it is deliberately revived.
 */
import { Activity, Cpu, Zap, Clock } from 'lucide-react';
import { ExtendedCitizen } from '../../data/citizenData';
import { useWorldStore } from '../../store/useWorldStore';
import { cn } from '../../lib/utils';

const ROLE_BADGE: Record<string, string> = {
  emerald: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50',
  amber: 'text-amber-400 bg-amber-900/30 border-amber-800/50',
  cyan: 'text-cyan-400 bg-cyan-900/30 border-cyan-800/50',
  rose: 'text-rose-400 bg-rose-900/30 border-rose-800/50',
  sky: 'text-sky-400 bg-sky-900/30 border-sky-800/50',
};

const AVATAR_BG: Record<string, string> = {
  emerald: 'bg-emerald-900/50 border-emerald-700/60 text-emerald-300',
  amber: 'bg-amber-900/50 border-amber-700/60 text-amber-300',
  cyan: 'bg-cyan-900/50 border-cyan-700/60 text-cyan-300',
  rose: 'bg-rose-900/50 border-rose-700/60 text-rose-300',
  sky: 'bg-sky-900/50 border-sky-700/60 text-sky-300',
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
  processing: 'bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]',
  idle: 'bg-zinc-600',
};

const STATUS_TEXT: Record<string, string> = {
  active: 'text-emerald-400',
  processing: 'text-amber-400',
  idle: 'text-zinc-500',
};

interface CitizenCardProps {
  citizen: ExtendedCitizen;
}

export function CitizenCard({ citizen }: CitizenCardProps) {
  const setSelectedAgent = useWorldStore((s) => s.setSelectedAgent);

  const handleClick = () => {
    setSelectedAgent({
      id: citizen.id,
      name: citizen.name,
      role: citizen.role,
      roleColor: citizen.roleColor,
      avatarInitials: citizen.avatarInitials,
      status: citizen.status,
    });
  };

  const avatarClass = AVATAR_BG[citizen.roleColor] ?? 'bg-zinc-800 border-zinc-700 text-zinc-300';
  const badgeClass = ROLE_BADGE[citizen.roleColor] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700';

  return (
    <button
      onClick={handleClick}
      className="group w-full text-left bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 rounded-lg p-4 transition-all duration-200 hover:shadow-lg flex flex-col gap-3 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, rgba(52,211,153,0.03), transparent 60%)` }} />

      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-lg border-2 flex items-center justify-center font-bold text-sm shrink-0 transition-transform duration-200 group-hover:scale-105',
          avatarClass
        )}>
          {citizen.avatarInitials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm text-zinc-100 truncate">{citizen.name}</span>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[citizen.status])} />
          </div>
          <span className={cn(
            'inline-block font-mono text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide font-semibold',
            badgeClass
          )}>
            {citizen.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
        <div className="flex items-center gap-1 text-zinc-600">
          <Zap className="w-2.5 h-2.5 shrink-0" />
          <span className="text-zinc-400 tabular-nums">{citizen.tokensUsed.toLocaleString()}</span>
          <span className="text-zinc-700">tok</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-600">
          <Activity className="w-2.5 h-2.5 shrink-0" />
          <span className="text-zinc-400 tabular-nums">{citizen.decisions.toLocaleString()}</span>
          <span className="text-zinc-700">dec</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-600">
          <Cpu className="w-2.5 h-2.5 shrink-0" />
          <span className="text-zinc-400 tabular-nums">{citizen.memoryMb}</span>
          <span className="text-zinc-700">MB</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-600">
          <Clock className="w-2.5 h-2.5 shrink-0" />
          <span className={cn('tabular-nums font-semibold', STATUS_TEXT[citizen.status])}>
            {citizen.uptime.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/50">
        <span className="text-[10px] font-mono text-zinc-700">{citizen.sector}</span>
        <span className={cn('text-[10px] font-mono uppercase font-bold', STATUS_TEXT[citizen.status])}>
          {citizen.status}
        </span>
      </div>
    </button>
  );
}
