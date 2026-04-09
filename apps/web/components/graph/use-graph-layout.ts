"use client";

import { useMemo } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force-3d";
import type { GraphNode, GraphEdge } from "@/actions/graph";

export interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  z: number;
}

/**
 * Computes 3D force-directed layout positions for graph nodes.
 *
 * Uses d3-force-3d to run a physics simulation synchronously to convergence
 * (300 ticks) before returning. This avoids per-frame simulation updates and
 * React re-renders.
 *
 * IMPORTANT: Always import from "d3-force-3d", NOT from "d3" — avoids
 * TypeScript namespace conflicts with @types/d3 (Research Pitfall 7).
 *
 * T-07-02: tick count fixed at 300; empty-array early return prevents
 * simulation on zero nodes.
 */
export function useGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): LayoutNode[] {
  return useMemo(() => {
    if (nodes.length === 0) return [];

    // Deep-clone nodes and edges — d3-force-3d mutates objects in-place
    // (same lesson from 2D graph: D3 mutation must not touch React props)
    const simNodes = nodes.map((n) => ({ ...n })) as Array<GraphNode & { x: number; y: number; z: number }>;
    const simLinks = edges.map((e) => ({ ...e }));

    const simulation = forceSimulation(simNodes, 3) // numDimensions = 3
      .force(
        "link",
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(60)
      )
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(0, 0, 0))
      .force("collide", forceCollide().radius(14))
      .stop();

    // Run synchronously to convergence — produces stable positions without
    // triggering React re-renders
    simulation.tick(300);

    return simNodes as LayoutNode[];
  }, [nodes, edges]);
}
