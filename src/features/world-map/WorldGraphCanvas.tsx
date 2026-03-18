/**
 * @file WorldGraphCanvas.tsx
 * @description Isolates the force-graph canvas renderer for the neural topology view.
 * @ai_context This memoized canvas is the future landing zone for Rust-streamed graph snapshots and topology deltas.
 */
import { memo, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphData, GraphNode } from '../../types';

const ROLE_COLORS: Record<string, string> = {
  CEO: '#fbbf24',
  'CEO Agent': '#fbbf24',
  CTO: '#fbbf24',
  'CTO Agent': '#fbbf24',
  'CFO Agent': '#f59e0b',
  Engineer: '#06b6d4',
  Analyst: '#06b6d4',
  Consumer: '#10b981',
  Researcher: '#10b981',
  'Legal Agent': '#f43f5e',
};

const LINK_COLOR = 'rgba(16, 185, 129, 0.18)';

function nodeColor(node: GraphNode): string {
  if (node.status === 'Sleeping') return '#3f3f46';
  return ROLE_COLORS[node.group] ?? '#6b7280';
}

function drawNode(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) {
  const r = Math.max(3, 5 / Math.sqrt(globalScale));
  const x = (node as GraphNode & { x?: number }).x ?? 0;
  const y = (node as GraphNode & { y?: number }).y ?? 0;
  const color = nodeColor(node);
  const awake = node.status === 'Awake';

  if (awake) {
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  if (awake) {
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
    ctx.strokeStyle = `${color}40`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

interface WorldGraphCanvasProps {
  dims: { w: number; h: number };
  graphData: GraphData;
  onNodeClick: (node: object) => void;
}

export const WorldGraphCanvas = memo(function WorldGraphCanvas({
  dims,
  graphData,
  onNodeClick,
}: WorldGraphCanvasProps) {
  const graphPayload = useMemo(
    () => graphData as { nodes: object[]; links: object[] },
    [graphData]
  );

  const handleLinkColor = useCallback(() => LINK_COLOR, []);
  const handleNodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      drawNode(node as GraphNode, ctx, globalScale);
    },
    []
  );
  const handleNodeCanvasMode = useCallback(() => 'replace' as const, []);
  const handleNodeLabel = useCallback((node: object) => {
    const graphNode = node as GraphNode;
    return `${graphNode.name} - ${graphNode.group}`;
  }, []);

  return (
    <ForceGraph2D
      graphData={graphPayload}
      width={dims.w}
      height={dims.h}
      backgroundColor="#09090b"
      linkColor={handleLinkColor}
      linkWidth={0.8}
      nodeCanvasObject={handleNodeCanvasObject}
      nodeCanvasObjectMode={handleNodeCanvasMode}
      onNodeClick={onNodeClick}
      enableNodeDrag={true}
      enableZoomInteraction={true}
      cooldownTicks={120}
      nodeLabel={handleNodeLabel}
    />
  );
});
