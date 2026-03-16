/**
 * @file WorldMapOverlay.tsx
 * @description Renders the informational chrome layered above the force-graph canvas.
 * @ai_context These overlays surface high-level topology counts that will stay stable as the backend swaps in live graph data.
 */
import { memo } from 'react';
import { GraphData } from '../../types';

interface WorldMapOverlayProps {
  awakeCount: number;
  graphData: GraphData;
}

export const WorldMapOverlay = memo(function WorldMapOverlay({
  awakeCount,
  graphData,
}: WorldMapOverlayProps) {
  return (
    <>
      <div className="absolute top-6 left-6 z-10 bg-zinc-950/80 backdrop-blur border border-zinc-800 p-4 rounded-lg pointer-events-none select-none min-w-48">
        <div className="font-mono text-emerald-500 text-sm tracking-widest mb-3 uppercase">
          Global Neural Topology
        </div>
        <div className="space-y-1.5 mb-4">
          {[
            { label: 'TOTAL NODES', value: graphData.nodes.length, color: 'text-zinc-200' },
            { label: 'ACTIVE', value: awakeCount, color: 'text-emerald-400' },
            { label: 'LINKS', value: graphData.links.length, color: 'text-cyan-400' },
            { label: 'DORMANT', value: graphData.nodes.length - awakeCount, color: 'text-zinc-500' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-6 font-mono text-xs">
              <span className="text-zinc-500">{row.label}</span>
              <span className={`${row.color} font-bold tabular-nums`}>{row.value}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-800 pt-3 space-y-1.5">
          <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Legend</div>
          {[
            { color: '#fbbf24', label: 'Leadership - CEO / CTO' },
            { color: '#06b6d4', label: 'Core - Engineer / Analyst' },
            { color: '#10b981', label: 'Field - Consumer / Researcher' },
            { color: '#3f3f46', label: 'Dormant' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: item.color,
                  boxShadow: item.color !== '#3f3f46' ? `0 0 5px ${item.color}` : undefined,
                }}
              />
              <span className="font-mono text-[10px] text-zinc-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 left-6 z-10 flex items-center gap-2 bg-zinc-950/80 backdrop-blur border border-zinc-800 rounded px-3 py-1.5 pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Live Scan Active</span>
      </div>

      <div className="absolute top-6 right-6 z-10 bg-zinc-950/80 backdrop-blur border border-zinc-800 rounded px-3 py-2 pointer-events-none">
        <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">Scroll to zoom - Click node to inspect</span>
      </div>
    </>
  );
});
