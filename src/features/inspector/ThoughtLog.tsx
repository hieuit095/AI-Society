/**
 * @file ThoughtLog.tsx
 * @description Renders the agent's real reasoning traces from the `agent.detail` WS event.
 * @ai_context Phase 6: All thought log data is server-authoritative. The inspectorDetail
 *             is populated by the `agent.detail` WebSocket event when an agent is selected.
 */
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorldStore } from '../../store/useWorldStore';
import { cn } from '../../lib/utils';

export const ThoughtLog = memo(function ThoughtLog() {
  const { inspectorDetail } = useWorldStore(
    useShallow((state) => ({
      inspectorDetail: state.inspectorDetail,
    }))
  );

  const logs = inspectorDetail?.thoughtLog ?? [];
  const isEmpty = logs.length === 0;

  return (
    <div className="bg-zinc-950 p-3 rounded border border-zinc-800 font-mono text-xs text-zinc-400 space-y-1 min-h-[160px]">
      {isEmpty ? (
        <div className="text-zinc-600 animate-pulse">
          {'> '} Awaiting agent activity...
        </div>
      ) : (
        logs.map((log, idx) => {
          const isLast = idx === logs.length - 1;
          return (
            <div
              key={idx}
              className={cn(
                'transition-all duration-300',
                isLast ? 'animate-pulse text-emerald-400' : 'text-zinc-500'
              )}
            >
              {log}
            </div>
          );
        })
      )}
      <div className="text-emerald-400 animate-pulse">
        {'> '}
        <span className="inline-block w-2 h-3 bg-emerald-400 opacity-70" />
      </div>
    </div>
  );
});
