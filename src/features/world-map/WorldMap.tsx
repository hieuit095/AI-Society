/**
 * @file WorldMap.tsx
 * @description Hosts the responsive force-graph topology view and bridges graph node selection into the inspector.
 * @ai_context This view will eventually render Rust-authored topology snapshots while keeping the current God-Mode presentation stable.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorldStore } from '../../store/useWorldStore';
import { Citizen, GraphNode } from '../../types';
import { WorldGraphCanvas } from './WorldGraphCanvas';
import { WorldMapOverlay } from './WorldMapOverlay';

export const WorldMap = memo(function WorldMap() {
  const graphData = useWorldStore((s) => s.graphData);
  const citizens = useWorldStore((s) => s.citizens);
  const setSelectedAgent = useWorldStore((s) => s.setSelectedAgent);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const citizensById = useMemo(
    () => Object.fromEntries(citizens.map((citizen) => [citizen.id, citizen])) as Record<string, Citizen>,
    [citizens]
  );

  const awakeCount = useMemo(
    () => graphData.nodes.filter((node) => node.status === 'Awake').length,
    [graphData.nodes]
  );

  const handleNodeClick = useCallback((node: object) => {
    const graphNode = node as GraphNode;
    const citizen = citizensById[graphNode.id];
    if (!citizen) return;

    // ZeroClaw integration anchor: future graph events must preserve the same agent ids used by chat and citizen snapshots.
    setSelectedAgent({
      id: citizen.id,
      name: citizen.name,
      role: citizen.role,
      roleColor: 'emerald',
      avatarInitials: citizen.name.slice(0, 2).toUpperCase(),
      status: citizen.status === 'Awake' ? 'active' : 'idle',
    });
  }, [citizensById, setSelectedAgent]);

  return (
    <div ref={containerRef} className="relative h-full w-full bg-zinc-950 overflow-hidden">
      <WorldGraphCanvas dims={dims} graphData={graphData} onNodeClick={handleNodeClick} />
      <WorldMapOverlay awakeCount={awakeCount} graphData={graphData} />
    </div>
  );
});
