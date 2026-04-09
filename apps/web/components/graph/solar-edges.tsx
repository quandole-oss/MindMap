"use client";

import { Line } from "@react-three/drei";
import type { LayoutNode } from "./use-graph-layout";
import type { GraphEdge } from "@/actions/graph";

/**
 * Edge visual style keyed by edgeType.
 * Colors match the existing 2D knowledge-graph.tsx edge palette.
 */
function getEdgeStyle(edgeType: string): { color: string; opacity: number } {
  switch (edgeType) {
    case "bridge":
      return { color: "#7c3aed", opacity: 0.5 };
    case "misconception_cluster":
      return { color: "#dc2626", opacity: 0.4 };
    case "curiosity_link":
    default:
      return { color: "#4a4a8a", opacity: 0.35 };
  }
}

interface SolarEdgesProps {
  layoutNodes: LayoutNode[];
  edges: GraphEdge[];
}

/**
 * Renders constellation-style edges between star nodes.
 *
 * Each edge is a drei <Line> component (THREE.Line2 under the hood).
 * Source and target nodes are looked up from layoutNodes via an O(1) id map.
 * Edges with missing source or target are silently skipped.
 *
 * D-07 compliance: edges rendered as thin glowing lines.
 *
 * Performance: acceptable for <500 edges. If edge count exceeds 500,
 * migrate to a single <Segments> component for better batching.
 */
export function SolarEdges({ layoutNodes, edges }: SolarEdgesProps) {
  // O(1) lookup from node id → LayoutNode
  const nodeIndex = Object.fromEntries(layoutNodes.map((n) => [n.id, n]));

  return (
    <>
      {edges.map((edge, i) => {
        const src = nodeIndex[edge.source];
        const tgt = nodeIndex[edge.target];

        // Skip edges where either endpoint is not in the layout
        if (!src || !tgt) return null;

        const { color, opacity } = getEdgeStyle(edge.edgeType);

        return (
          <Line
            key={i}
            points={[
              [src.x, src.y, src.z],
              [tgt.x, tgt.y, tgt.z],
            ]}
            color={color}
            lineWidth={0.5}
            transparent
            opacity={opacity}
          />
        );
      })}
    </>
  );
}
