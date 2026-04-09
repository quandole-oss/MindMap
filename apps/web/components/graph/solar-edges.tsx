"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { LayoutNode } from "./use-graph-layout";
import type { GraphEdge } from "@/actions/graph";

/**
 * Edge visual style keyed by edgeType.
 * Bridge = highlighted surprise connections (bright, thick, glowing).
 * Curiosity_link = standard connections (subtle).
 * Misconception_cluster = warning connections (red tint).
 */
function getEdgeStyle(edgeType: string): { color: string; opacity: number; lineWidth: number } {
  switch (edgeType) {
    case "bridge":
      // Surprise cross-domain connections — bright purple, thick, highly visible
      return { color: "#a78bfa", opacity: 0.85, lineWidth: 2.5 };
    case "misconception_cluster":
      return { color: "#f87171", opacity: 0.6, lineWidth: 1.5 };
    case "curiosity_link":
    default:
      return { color: "#6366f1", opacity: 0.4, lineWidth: 0.8 };
  }
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

        const { color, opacity, lineWidth } = getEdgeStyle(edge.edgeType);

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
