// MiniGraphSvg — RSC-compatible static SVG thumbnail of a student knowledge graph.
// No "use client", no hooks, no D3. Pure function of props.

const NODE_COLORS = {
  healthy: "#0d9488",
  misconception: "#dc2626",
  unprobed: "#71717a",
} as const;

interface MiniGraphSvgProps {
  nodes: Array<{
    id: string;
    name: string;
    domain: string;
    status: "unprobed" | "healthy" | "misconception";
    visitCount: number;
  }>;
  edges: Array<{ source: string; target: string }>;
  width?: number;
  height?: number;
  className?: string;
}

export function MiniGraphSvg({
  nodes,
  edges,
  width = 160,
  height = 120,
  className,
}: MiniGraphSvgProps) {
  if (nodes.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="0 concepts"
        className={className}
      >
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fill="#71717a"
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        >
          No data
        </text>
      </svg>
    );
  }

  // Circular layout: position nodes evenly around a circle
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;

  const nodePositions = new Map<string, { x: number; y: number }>();

  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    nodePositions.set(node.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${nodes.length} concept${nodes.length === 1 ? "" : "s"}`}
      className={className}
    >
      {/* Edges rendered first (z-order: below nodes) */}
      {edges.map((edge, i) => {
        const src = nodePositions.get(edge.source);
        const tgt = nodePositions.get(edge.target);
        if (!src || !tgt) return null;
        return (
          <line
            key={i}
            x1={src.x}
            y1={src.y}
            x2={tgt.x}
            y2={tgt.y}
            stroke="#e4e4e7"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const pos = nodePositions.get(node.id);
        if (!pos) return null;
        const nodeRadius = 4 + Math.min(node.visitCount, 10) * 0.3;
        const fill = NODE_COLORS[node.status] ?? NODE_COLORS.unprobed;
        return (
          <circle
            key={node.id}
            cx={pos.x}
            cy={pos.y}
            r={nodeRadius}
            fill={fill}
          />
        );
      })}
    </svg>
  );
}
