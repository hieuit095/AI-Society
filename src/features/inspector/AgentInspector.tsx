/**
 * @file AgentInspector.tsx
 * @description Slides in detailed agent telemetry from the Rust `agent.detail` WebSocket event.
 * @ai_context Phase 6: All stats are server-authoritative via `inspectorDetail` in the Zustand store.
 */
import { memo } from 'react';
import { X, Cpu, Hash, Activity, Zap, Clock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWorldStore } from '../../store/useWorldStore';
import { ThoughtLog } from './ThoughtLog';
import { cn } from '../../lib/utils';

const ROLE_COLOR_MAP: Record<string, string> = {
  emerald: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50',
  amber: 'text-amber-400 bg-amber-900/30 border-amber-800/50',
  cyan: 'text-cyan-400 bg-cyan-900/30 border-cyan-800/50',
  rose: 'text-rose-400 bg-rose-900/30 border-rose-800/50',
  sky: 'text-sky-400 bg-sky-900/30 border-sky-800/50',
};

const AVATAR_GLOW: Record<string, string> = {
  emerald: 'shadow-emerald-900/50 bg-emerald-900/30 border-emerald-700 text-emerald-300',
  amber: 'shadow-amber-900/50 bg-amber-900/30 border-amber-700 text-amber-300',
  cyan: 'shadow-cyan-900/50 bg-cyan-900/30 border-cyan-700 text-cyan-300',
  rose: 'shadow-rose-900/50 bg-rose-900/30 border-rose-700 text-rose-300',
  sky: 'shadow-sky-900/50 bg-sky-900/30 border-sky-700 text-sky-300',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-400',
  idle: 'bg-zinc-500',
  processing: 'bg-amber-400 animate-pulse',
};

const STATUS_TEXT: Record<string, string> = {
  active: 'text-emerald-400',
  idle: 'text-zinc-500',
  processing: 'text-amber-400',
};

function StatRow({ icon: Icon, label, value, valueClass }: { icon: React.ElementType; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Icon className="w-3 h-3" />
        <span className="font-mono uppercase tracking-wide">{label}</span>
      </div>
      <span className={cn('text-xs font-mono font-semibold', valueClass ?? 'text-zinc-300')}>
        {value}
      </span>
    </div>
  );
}

export const AgentInspector = memo(function AgentInspector() {
  const { selectedAgent, clearSelectedAgent, currentTick, inspectorDetail } = useWorldStore(
    useShallow((state) => ({
      selectedAgent: state.selectedAgent,
      clearSelectedAgent: state.clearSelectedAgent,
      currentTick: state.currentTick,
      inspectorDetail: state.inspectorDetail,
    }))
  );

  return (
    <div
      className={cn(
        'absolute right-0 top-0 bottom-0 w-80 bg-zinc-900/95 backdrop-blur-md border-l border-zinc-800 z-40 flex flex-col transition-transform duration-300 ease-in-out',
        selectedAgent ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest font-mono">Agent Inspector</span>
        </div>
        <button
          onClick={clearSelectedAgent}
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-150"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {selectedAgent && (
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
          <div className="p-4 border-b border-zinc-800/50">
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-14 h-14 rounded-xl border-2 flex items-center justify-center font-bold text-lg shadow-lg',
                AVATAR_GLOW[selectedAgent.roleColor] ?? 'bg-zinc-800 border-zinc-700 text-zinc-200'
              )}>
                {selectedAgent.avatarInitials}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-zinc-100 text-base leading-tight">{selectedAgent.name}</h2>
                <span className={cn(
                  'inline-block font-mono text-[11px] px-2 py-0.5 rounded border font-semibold uppercase tracking-wide mt-1',
                  ROLE_COLOR_MAP[selectedAgent.roleColor] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'
                )}>
                  {selectedAgent.role}
                </span>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_COLORS[selectedAgent.status])} />
                  <span className={cn('text-[11px] font-mono uppercase', STATUS_TEXT[selectedAgent.status])}>
                    {selectedAgent.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-zinc-800/50">
            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono mb-2">System Stats</h3>
            <div className="space-y-0">
              <StatRow icon={Hash} label="Agent ID" value={selectedAgent.id.toUpperCase()} />
              <StatRow icon={Clock} label="Last Tick" value={currentTick.toLocaleString()} valueClass="text-emerald-400" />
              <StatRow icon={Activity} label="Status" value={selectedAgent.status.toUpperCase()} valueClass={STATUS_TEXT[selectedAgent.status]} />
              <StatRow icon={Zap} label="Model" value={inspectorDetail?.model ?? 'Awaiting Telemetry...'} valueClass={inspectorDetail?.model ? 'text-cyan-400' : 'text-zinc-600'} />
              <StatRow icon={Cpu} label="Tokens/tick" value={inspectorDetail?.tokensPerTick?.toLocaleString() ?? '0'} valueClass="text-amber-400" />
            </div>
          </div>

          <div className="p-4">
            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono mb-2">Live Thought Log</h3>
            <ThoughtLog />

            <div className="mt-4 space-y-2">
              <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono">Actions</h3>
              <button className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs font-mono text-zinc-300 transition-all duration-150 text-left hover:text-zinc-100">
                {'>'} Inspect Memory Store
              </button>
              <button className="w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs font-mono text-zinc-300 transition-all duration-150 text-left hover:text-zinc-100">
                {'>'} View Decision Tree
              </button>
              <button className="w-full px-3 py-2 bg-rose-900/20 hover:bg-rose-900/30 border border-rose-900/50 rounded text-xs font-mono text-rose-400 transition-all duration-150 text-left hover:text-rose-300">
                {'>'} Suspend Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
