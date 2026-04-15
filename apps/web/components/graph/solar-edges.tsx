"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
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
 * Same-domain -> blend = domain color (e.g., cyan+cyan = cyan).
 * Cross-domain -> unique blend (e.g., cyan+pink = lavender).
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
  /** Set of edge keys ("sourceId:targetId", sorted) that should animate in */
  newEdgeKeys?: Set<string>;
  /** Clock time when edge animation should start (from SolarScene) */
  edgeAnimationStartTime?: number;
}

/**
 * Renders constellation-style edges between star nodes.
 * Bridge edges render on top (sorted last) and are thicker + brighter
 * to highlight surprise cross-domain connections.
 *
 * D-08: New edges draw progressively from source to target over 400ms
 * when newEdgeKeys and edgeAnimationStartTime are provided.
 */
export function SolarEdges({
  layoutNodes,
  edges,
  newEdgeKeys,
  edgeAnimationStartTime,
}: SolarEdgesProps) {
  const nodeIndex = useMemo(
    () => Object.fromEntries(layoutNodes.map((n) => [n.id, n])),
    [layoutNodes]
  );

  // Sort: curiosity_link first (background), then misconception, then bridge on top
  const sortedEdges = useMemo(() => {
    const order: Record<string, number> = { curiosity_link: 0, misconception_cluster: 1, bridge: 2 };
    return [...edges].sort((a, b) => (order[a.edgeType] ?? 0) - (order[b.edgeType] ?? 0));
  }, [edges]);

  // D-08: Track edge draw-in progress via ref for useFrame (Pitfall 2: never useState)
  const edgeProgressRef = useRef<Map<string, number>>(new Map());

  useFrame(({ clock }) => {
    if (
      !newEdgeKeys ||
      newEdgeKeys.size === 0 ||
      edgeAnimationStartTime === undefined ||
      edgeAnimationStartTime < 0
    ) {
      return;
    }

    const now = clock.elapsedTime;
    if (now < edgeAnimationStartTime) return;

    const elapsed = now - edgeAnimationStartTime;

    // D-08: 400ms draw-in per edge, linear easing
    for (const key of newEdgeKeys) {
      const progress = Math.min(elapsed / 0.4, 1);
      edgeProgressRef.current.set(key, progress);
    }
  });

  return (
    <>
      {sortedEdges.map((edge, i) => {
        const src = nodeIndex[edge.source];
        const tgt = nodeIndex[edge.target];
        if (!src || !tgt) return null;

        const { color, opacity, lineWidth } = getEdgeStyle(edge, src.domain, tgt.domain);

        // Determine if this edge is animating
        const edgeKey =
          edge.source < edge.target
            ? `${edge.source}:${edge.target}`
            : `${edge.target}:${edge.source}`;
        const isNewEdge = newEdgeKeys?.has(edgeKey) ?? false;

        if (
          isNewEdge &&
          edgeAnimationStartTime !== undefined &&
          edgeAnimationStartTime >= 0
        ) {
          const progress = edgeProgressRef.current.get(edgeKey) ?? 0;
          if (progress <= 0) return null; // Not yet started — hide edge

          // D-08: Draw-in — interpolate end point from source toward target
          const endX = src.x + (tgt.x - src.x) * progress;
          const endY = src.y + (tgt.y - src.y) * progress;
          const endZ = src.z + (tgt.z - src.z) * progress;

          return (
            <Line
              key={i}
              points={[
                [src.x, src.y, src.z],
                [endX, endY, endZ],
              ]}
              color={color}
              lineWidth={lineWidth}
              transparent
              opacity={opacity * progress}
            />
          );
        }

        // Existing edge — render normally
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
