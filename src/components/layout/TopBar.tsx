/**
 * @file TopBar.tsx
 * @description Renders the global simulation controls and high-level telemetry in the dashboard header.
 * @ai_context This is the primary surface that will reflect Rust-authored tick, agent, and memory telemetry once websocket sync is live.
 */
import { memo, useState, useRef, useEffect } from 'react';
import { Play, Pause, FastForward, Activity, Cpu, FlaskConical, UserPlus, Users } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useWorldStore } from '../../store/useWorldStore';
import { sendCommand } from '../../services/wsClient';
import { cn } from '../../lib/utils';

function formatTick(tick: number): string {
  return tick.toString().padStart(7, '0').replace(/(\d{3})(\d{3})(\d+)/, '$1,$2');
}

export const TopBar = memo(function TopBar() {
  const { isPlaying, currentTick, awakeAgents, totalAgents, rustRam, togglePlay, openSeedModal } = useWorldStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
      currentTick: state.currentTick,
      awakeAgents: state.awakeAgents,
      totalAgents: state.totalAgents,
      rustRam: state.rustRam,
      togglePlay: state.togglePlay,
      openSeedModal: state.openSeedModal,
    }))
  );

  // ── Bulk Genesis Popover State ──
  const [showBulkPopover, setShowBulkPopover] = useState(false);
  const [bulkCount, setBulkCount] = useState(100);
  const [eliteRatio, setEliteRatio] = useState(5);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowBulkPopover(false);
      }
    }
    if (showBulkPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showBulkPopover]);

  const handleSpawnSingle = () => {
    sendCommand('clientCommand', { type: 'spawnSingle' });
  };

  const handleSpawnBulk = () => {
    sendCommand('clientCommand', {
      type: 'spawnBulk',
      count: bulkCount,
      eliteRatio: eliteRatio / 100,
    });
    setShowBulkPopover(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 z-30 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-zinc-950 rounded border border-zinc-800 p-1">
          <button
            onClick={togglePlay}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all duration-200',
              isPlaying
                ? 'bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-800'
                : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-800'
            )}
          >
            {isPlaying ? (
              <><Pause className="w-3.5 h-3.5" /><span>PAUSE</span></>
            ) : (
              <><Play className="w-3.5 h-3.5" /><span>PLAY</span></>
            )}
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold text-amber-400 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-900 transition-all duration-200">
            <FastForward className="w-3.5 h-3.5" />
            <span>2x</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Tick</span>
          <div className="font-mono text-emerald-400 bg-zinc-950 px-3 py-1 rounded border border-zinc-800 text-sm tabular-nums relative overflow-hidden">
            <span className={cn('transition-all duration-300', isPlaying && 'animate-pulse')}>
              {formatTick(currentTick)}
            </span>
            {isPlaying && (
              <span className="absolute inset-0 bg-emerald-400/5 animate-pulse rounded" />
            )}
          </div>
        </div>

        {isPlaying && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-emerald-500 uppercase tracking-wider">LIVE</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-950/50 px-3 py-1.5 rounded border border-zinc-800/50">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-emerald-400">{awakeAgents.toLocaleString()}</span>
          <span className="text-zinc-600">/</span>
          <span>{totalAgents.toLocaleString()}</span>
          <span className="text-zinc-500 ml-1">Awake</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-950/50 px-3 py-1.5 rounded border border-zinc-800/50">
          <Cpu className="w-3.5 h-3.5 text-cyan-500" />
          <span className="text-cyan-400">{rustRam}MB</span>
          <span className="text-zinc-500">Rust RAM</span>
        </div>

        {/* ── Spawn Controls ── */}
        <div className="flex items-center gap-1 bg-zinc-950 rounded border border-zinc-800 p-1">
          <button
            onClick={handleSpawnSingle}
            title="Drop Random Agent"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold text-violet-400 bg-violet-600/10 hover:bg-violet-600/20 border border-violet-900 transition-all duration-200"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>DROP</span>
          </button>

          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowBulkPopover(!showBulkPopover)}
              title="Bulk Genesis"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold text-sky-400 bg-sky-600/10 hover:bg-sky-600/20 border border-sky-900 transition-all duration-200"
            >
              <Users className="w-3.5 h-3.5" />
              <span>BULK</span>
            </button>

            {showBulkPopover && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl shadow-black/50 p-4 z-50">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">
                  Bulk Genesis
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span>Agent Count</span>
                      <span className="font-mono text-sky-400">{bulkCount}</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={1000}
                      value={bulkCount}
                      onChange={(e) => setBulkCount(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-sky-500"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                      <span>1</span>
                      <span>1000</span>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span>Elite Ratio</span>
                      <span className="font-mono text-amber-400">{eliteRatio}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={eliteRatio}
                      onChange={(e) => setEliteRatio(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                      <span>0% (All Local)</span>
                      <span>100% (All Cloud)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                    <div className="text-[10px] text-zinc-500">
                      <span className="text-amber-400">{Math.round(bulkCount * eliteRatio / 100)}</span> Elite ·{' '}
                      <span className="text-sky-400">{bulkCount - Math.round(bulkCount * eliteRatio / 100)}</span> Citizen
                    </div>
                    <button
                      onClick={handleSpawnBulk}
                      className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-1.5 rounded text-xs transition-all duration-200 shadow-lg shadow-sky-900/30"
                    >
                      SPAWN
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={openSeedModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded text-xs transition-all duration-200 shadow-lg shadow-emerald-900/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          INJECT SEED
        </button>
      </div>
    </header>
  );
});
