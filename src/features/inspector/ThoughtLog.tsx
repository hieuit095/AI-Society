/**
 * @file ThoughtLog.tsx
 * @description Reveals the mocked incremental thought stream for the currently inspected agent.
 * @ai_context This component is intentionally shaped like a future stream consumer for real agent reasoning traces from the Rust backend.
 */
import { memo, useEffect, useMemo, useState } from 'react';
import { THOUGHT_LOGS } from '../../data/mockData';
import { cn } from '../../lib/utils';
import { Agent } from '../../types';

interface ThoughtLogProps {
  agent: Agent;
}

export const ThoughtLog = memo(function ThoughtLog({ agent }: ThoughtLogProps) {
  // ==========================================
  // 🔗 [RUST-BINDING-POINT]: WEBSOCKET TARGET
  // TODO (Backend Phase): Replace this static THOUGHT_LOGS lookup with a streaming `agent.thought` WebSocket event subscription.
  // Expected Payload: { type: 'agent.thought', agentId: string, logLine: string, isComplete: boolean }
  // ==========================================
  const allLogs = useMemo(
    () => THOUGHT_LOGS[agent.id] ?? ['> Initializing agent context...', '> Loading memory state...', '> Ready.'],
    [agent.id]
  );
  const [visibleLogs, setVisibleLogs] = useState<string[]>([allLogs[0]]);
  const [currentIndex, setCurrentIndex] = useState(1);

  useEffect(() => {
    setVisibleLogs([allLogs[0]]);
    setCurrentIndex(1);
  }, [allLogs]);

  useEffect(() => {
    if (currentIndex >= allLogs.length) return;
    const timeout = setTimeout(() => {
      setVisibleLogs((prev) => [...prev, allLogs[currentIndex]]);
      setCurrentIndex((i) => i + 1);
    }, 600 + Math.random() * 400);
    return () => clearTimeout(timeout);
  }, [currentIndex, allLogs]);

  const isComplete = currentIndex >= allLogs.length;

  return (
    <div className="bg-zinc-950 p-3 rounded border border-zinc-800 font-mono text-xs text-zinc-400 space-y-1 min-h-[160px]">
      {visibleLogs.map((log, idx) => {
        const isLast = idx === visibleLogs.length - 1 && !isComplete;
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
      })}
      {isComplete && (
        <div className="text-emerald-400 animate-pulse">
          {'> '}
          <span className="inline-block w-2 h-3 bg-emerald-400 opacity-70" />
        </div>
      )}
    </div>
  );
});
