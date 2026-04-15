"use client";

import { useMemo, useRef } from "react";
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
 * D-17/D-18: Incremental layout mode preserves existing node positions when new
 * nodes are added. Existing nodes are pinned for the first 50 ticks, then released
 * for 50 more ticks. Initial layout (first render) still runs full 300 ticks.
 *
 * IMPORTANT: Always import from "d3-force-3d", NOT from "d3" — avoids
 * TypeScript namespace conflicts with @types/d3 (Research Pitfall 7).
 */
export function useGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[]
): LayoutNode[] {
  // D-17: Store previous layout positions for incremental updates
  const prevPositionsRef = useRef<Map<string, { x: number; y: number; z: number }>>(
    new Map()
  );

  return useMemo(() => {
    if (nodes.length === 0) return [];

    const prevPositions = prevPositionsRef.current;
    const isIncremental = prevPositions.size > 0;

    // Deep-clone nodes and edges — d3-force-3d mutates objects in-place
    const simNodes = nodes.map((n) => ({
      ...n,
    })) as Array<
      GraphNode & {
        x: number;
        y: number;
        z: number;
        fx?: number | null;
        fy?: number | null;
        fz?: number | null;
      }
    >;
    const simLinks = edges.map((e) => ({ ...e }));

    // Compute deterministic domain positions on a sphere
    const domainPositions = computeDomainPositions(nodes.map((n) => n.domain));

    if (isIncremental) {
      // D-17: Preserve existing node positions, pin them
      // Compute centroid of existing nodes for new node initial placement
      let cx = 0,
        cy = 0,
        cz = 0,
        existingCount = 0;

      for (const node of simNodes) {
        const prev = prevPositions.get(node.id);
        if (prev) {
          // Existing node: restore position and pin
          node.x = prev.x;
          node.y = prev.y;
          node.z = prev.z;
          node.fx = prev.x;
          node.fy = prev.y;
          node.fz = prev.z;
          cx += prev.x;
          cy += prev.y;
          cz += prev.z;
          existingCount++;
        }
      }

      if (existingCount > 0) {
        cx /= existingCount;
        cy /= existingCount;
        cz /= existingCount;
      }

      // Place new nodes near connected existing neighbors or at centroid
      for (const node of simNodes) {
        if (prevPositions.has(node.id)) continue;

        // New node: place near connected existing nodes or at centroid + random offset
        let nearX = cx,
          nearY = cy,
          nearZ = cz;
        let foundNeighbor = false;

        for (const edge of edges) {
          const neighborId =
            edge.source === node.id
              ? edge.target
              : edge.target === node.id
                ? edge.source
                : null;
          if (neighborId) {
            const neighborPrev = prevPositions.get(neighborId);
            if (neighborPrev) {
              nearX = neighborPrev.x;
              nearY = neighborPrev.y;
              nearZ = neighborPrev.z;
              foundNeighbor = true;
              break;
            }
          }
        }

        // Add random jitter so new nodes don't overlap
        const jitter = foundNeighbor ? 30 : 60;
        node.x = nearX + (Math.random() - 0.5) * jitter;
        node.y = nearY + (Math.random() - 0.5) * jitter;
        node.z = nearZ + (Math.random() - 0.5) * jitter;
      }
    }

    const simulation = forceSimulation(simNodes, 3)
      .force(
        "link",
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance((link: any) => (link.edgeType === "bridge" ? 100 : 60))
          .strength((link: any) => 0.3 + (link.weight ?? 0.5) * 0.7)
      )
      .force("charge", forceManyBody().strength(-180))
      .force("center", forceCenter(0, 0, 0))
      .force("collide", forceCollide().radius(16))
      // Domain galaxy forces — pull each node toward its domain's region
      .force(
        "domainX",
        forceX((d: any) => domainPositions.get(d.domain)?.[0] ?? 0).strength(
          0.15
        )
      )
      .force(
        "domainY",
        forceY((d: any) => domainPositions.get(d.domain)?.[1] ?? 0).strength(
          0.15
        )
      )
      .force(
        "domainZ",
        forceZ((d: any) => domainPositions.get(d.domain)?.[2] ?? 0).strength(
          0.15
        )
      )
      .stop();

    if (isIncremental) {
      // D-18: Incremental — 50 ticks with pins, then 50 without
      simulation.tick(50);

      // Release all pins
      for (const node of simNodes) {
        node.fx = null;
        node.fy = null;
        node.fz = null;
      }

      simulation.tick(50);
    } else {
      // Initial layout — full 300 ticks
      simulation.tick(300);
    }

    // Store positions for next incremental update
    const newPositions = new Map<
      string,
      { x: number; y: number; z: number }
    >();
    for (const node of simNodes) {
      newPositions.set(node.id, { x: node.x, y: node.y, z: node.z });
    }
    prevPositionsRef.current = newPositions;

    return simNodes as LayoutNode[];
  }, [nodes, edges]);
}
