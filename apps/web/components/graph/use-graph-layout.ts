"use client";

import { useMemo } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  forceZ,
} from "d3-force-3d";
import type { GraphNode, GraphEdge } from "@/actions/graph";

export interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  z: number;
}

/**
 * Distributes N domain positions evenly on a sphere using Fibonacci/golden-spiral.
 * Deterministic: sorted alphabetically so same domains always get same positions.
 */
function computeDomainPositions(
  domains: string[]
): Map<string, [number, number, number]> {
  const sorted = [...new Set(domains)].sort();
  const map = new Map<string, [number, number, number]>();
  const n = sorted.length;

  if (n === 0) return map;
  if (n === 1) {
    map.set(sorted[0], [0, 0, 0]);
    return map;
  }

  const R = 120;
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < n; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / n);
    const phi = (2 * Math.PI * i) / goldenRatio;
    map.set(sorted[i], [
      R * Math.sin(theta) * Math.cos(phi),
      R * Math.sin(theta) * Math.sin(phi),
      R * Math.cos(theta),
    ]);
  }

  return map;
}

/**
 * Computes 3D force-directed layout positions for graph nodes.
 *
 * Domain spatial clustering ("domain galaxies"): each unique domain is assigned
 * a target position on a sphere (radius 120). Weak forceX/Y/Z (strength 0.15)
 * pulls each node toward its domain's position, grouping same-domain nodes into
 * the same spatial region. Edge forces (link distance 60) still handle local
 * "topic constellation" clustering within each domain. Bridge edges use longer
 * distance (100) so they stretch between domains naturally.
 *
 * IMPORTANT: Always import from "d3-force-3d", NOT from "d3" — avoids
 * TypeScript namespace conflicts with @types/d3 (Research Pitfall 7).
 */
export function useGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): LayoutNode[] {
  return useMemo(() => {
    if (nodes.length === 0) return [];

    // Deep-clone nodes and edges — d3-force-3d mutates objects in-place
    const simNodes = nodes.map((n) => ({ ...n })) as Array<
      GraphNode & { x: number; y: number; z: number }
    >;
    const simLinks = edges.map((e) => ({ ...e }));

    // Compute deterministic domain positions on a sphere
    const domainPositions = computeDomainPositions(nodes.map((n) => n.domain));

    const simulation = forceSimulation(simNodes, 3)
      .force(
        "link",
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance((link: any) =>
            link.edgeType === "bridge" ? 100 : 60
          )
      )
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(0, 0, 0))
      .force("collide", forceCollide().radius(14))
      // Domain galaxy forces — pull each node toward its domain's region
      .force(
        "domainX",
        forceX((d: any) => domainPositions.get(d.domain)?.[0] ?? 0).strength(0.15)
      )
      .force(
        "domainY",
        forceY((d: any) => domainPositions.get(d.domain)?.[1] ?? 0).strength(0.15)
      )
      .force(
        "domainZ",
        forceZ((d: any) => domainPositions.get(d.domain)?.[2] ?? 0).strength(0.15)
      )
      .stop();

    // Run synchronously to convergence
    simulation.tick(300);

    return simNodes as LayoutNode[];
  }, [nodes, edges]);
}
