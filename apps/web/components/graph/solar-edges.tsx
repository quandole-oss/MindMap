"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { LayoutNode } from "./use-graph-layout";
import type { GraphEdge } from "@/actions/graph";
import { getDomainColor } from "@/lib/graph/domain-colors";

// Cache blended colors to avoid repeated THREE.Color allocations
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

/**
 * Edge color = 50/50 blend of both endpoints' domain colors.
 * Same-domain → blend = domain color (e.g., cyan+cyan = cyan).
 * Cross-domain → unique blend (e.g., cyan+pink = lavender).
 * Misconception edges always red.
 */
function getEdgeColor(srcDomain: string, tgtDomain: string, edgeType: string): string {
  if (edgeType === "misconception_cluster") return "#f87171";
  _colorA.set(getDomainColor(srcDomain));
  _colorB.set(getDomainColor(tgtDomain));
  _colorA.lerp(_colorB, 0.5);
  return `#${_colorA.getHexString()}`;
}

function getEdgeStyle(
  edge: GraphEdge,
  srcDomain: string,
  tgtDomain: string
): { color: string; opacity: number; lineWidth: number } {
  const color = getEdgeColor(srcDomain, tgtDomain, edge.edgeType);
  const w = edge.weight ?? 0.5;
  const isCrossDomain = srcDomain !== tgtDomain;

  // Cross-domain edges POP (the interesting surprise connections);
  // same-domain edges are faint background structure
  const isBridge = edge.edgeType === "bridge";
  const isMisconception = edge.edgeType === "misconception_cluster";

  const maxOpacity = isBridge ? 0.95 : isMisconception ? 0.85 : isCrossDomain ? 0.85 : 0.15;
  const maxLineWidth = isBridge ? 4.0 : isMisconception ? 2.5 : isCrossDomain ? 2.5 : 0.5;

  const MIN_OPACITY = isCrossDomain ? 0.50 : 0.06;
  const MIN_WIDTH = isCrossDomain ? 1.2 : 0.2;

  return {
    color,
    opacity: MIN_OPACITY + w * w * (maxOpacity - MIN_OPACITY),
    lineWidth: MIN_WIDTH + w * w * (maxLineWidth - MIN_WIDTH),
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

        const { color, opacity, lineWidth } = getEdgeStyle(edge, src.domain, tgt.domain);

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
