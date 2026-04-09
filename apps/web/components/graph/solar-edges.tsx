"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { LayoutNode } from "./use-graph-layout";
import type { GraphEdge } from "@/actions/graph";

/**
 * Base style maximums per edge type. Actual opacity and lineWidth are
 * modulated by edge.weight [0..1] (co-occurrence strength).
 * Bridge = surprise connections (boldest). Curiosity_link = standard (subtlest).
 */
function getBaseStyle(edgeType: string): { color: string; maxOpacity: number; maxLineWidth: number } {
  switch (edgeType) {
    case "bridge":
      return { color: "#a78bfa", maxOpacity: 0.95, maxLineWidth: 4.0 };
    case "misconception_cluster":
      return { color: "#f87171", maxOpacity: 0.80, maxLineWidth: 2.5 };
    case "curiosity_link":
    default:
      return { color: "#6366f1", maxOpacity: 0.60, maxLineWidth: 1.8 };
  }
}

function getEdgeStyle(edge: GraphEdge): { color: string; opacity: number; lineWidth: number } {
  const base = getBaseStyle(edge.edgeType);
  const w = edge.weight ?? 0.5;
  // Weak links nearly invisible, strong links dramatically bold
  const MIN_OPACITY = 0.06, MIN_WIDTH = 0.2;

  return {
    color: base.color,
    opacity: MIN_OPACITY + w * w * (base.maxOpacity - MIN_OPACITY),
    lineWidth: MIN_WIDTH + w * w * (base.maxLineWidth - MIN_WIDTH),
  };
}

interface SolarEdgesProps {
  layoutNodes: LayoutNode[];
  edges: GraphEdge[];
}

/**
 * Renders constellation-style edges between star nodes.
 * Bridge edges render on top (sorted last) and are thicker + brighter
 * to highlight surprise cross-domain connections.
 */
export function SolarEdges({ layoutNodes, edges }: SolarEdgesProps) {
  const nodeIndex = useMemo(
    () => Object.fromEntries(layoutNodes.map((n) => [n.id, n])),
    [layoutNodes]
  );

  // Sort: curiosity_link first (background), then misconception, then bridge on top
  const sortedEdges = useMemo(() => {
    const order: Record<string, number> = { curiosity_link: 0, misconception_cluster: 1, bridge: 2 };
    return [...edges].sort((a, b) => (order[a.edgeType] ?? 0) - (order[b.edgeType] ?? 0));
  }, [edges]);

  return (
    <>
      {sortedEdges.map((edge, i) => {
        const src = nodeIndex[edge.source];
        const tgt = nodeIndex[edge.target];
        if (!src || !tgt) return null;

        const { color, opacity, lineWidth } = getEdgeStyle(edge);

        return (
          <Line
            key={i}
            points={[
              [src.x, src.y, src.z],
              [tgt.x, tgt.y, tgt.z],
            ]}
            color={color}
            lineWidth={lineWidth}
            transparent
            opacity={opacity}
          />
        );
      })}
    </>
  );
}
