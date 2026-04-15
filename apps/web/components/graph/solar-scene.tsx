"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Html, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { SolarNodes, getNodeRadius } from "./solar-nodes";
import { SolarEdges } from "./solar-edges";
import { useGraphLayout, type LayoutNode } from "./use-graph-layout";
import type { GraphNode, GraphEdge } from "@/actions/graph";

interface SolarSceneProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (nodeId: string) => void;
  onClusterClick?: (clusterId: number) => void;
  highlightNodeId?: string | null;
  reframeTrigger?: number;
  /** Set of node IDs that should animate in (scale from 0) */
  newNodeIds?: Set<string>;
  /** Whether to play the entry animation sequence */
  animateEntry?: boolean;
  /** Called when the entry animation sequence completes */
  onAnimationComplete?: () => void;
}

/**
 * Inner R3F scene — composes nodes, edges, background stars, hover label,
 * and camera fly-to animation.
 *
 * Must be rendered inside a Canvas (see solar-graph.tsx).
 *
 * D-09, D-11, D-12, D-13 compliance:
 * - OrbitControls makeDefault allows useThree access to controls
 * - Html label renders only for hovered node (not all 250 — performance)
 * - useFrame lerp for smooth camera fly-to on double-click
 * - Touch gestures handled by OrbitControls automatically
 *
 * Bridge highlight (D-KEEP-02, D-KEEP-03):
 * - When highlightNodeId changes, starts a 1.5s pulse animation on that node
 * - Pulse: scale factor oscillates via sine wave (3 pulses over 1.5s)
 * - Also triggers camera fly-to so the bridge node comes into view
 *
 * Birth animation (D-07 through D-11):
 * - When animateEntry=true and newNodeIds is provided, orchestrates a staggered
 *   node scale-up, sparkle effects, edge draw-in, and camera framing sequence
 * - All animation state lives in refs (Pitfall 2 — never useState in useFrame)
 */
export function SolarScene({
  nodes,
  edges,
  onNodeClick,
  onClusterClick,
  highlightNodeId,
  reframeTrigger,
  newNodeIds,
  animateEntry,
  onAnimationComplete,
}: SolarSceneProps) {
  const layoutNodes = useGraphLayout(nodes, edges);
  const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);

  // Camera fly-to state
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const isFlying = useRef(false);

  // Double-click detection
  const lastClickTime = useRef<number>(0);
  const lastClickNodeId = useRef<string | null>(null);

  // Pulse animation state: tracks which node is pulsing and when it started
  const pulseRef = useRef<{ nodeIndex: number; startTime: number } | null>(null);

  // Reusable Object3D for matrix updates during pulse and birth animation
  const pulseDummy = useRef(new THREE.Object3D());

  // InstancedMesh ref shared between SolarNodes and SolarScene
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  // Proximity labels: track which nodes are close enough to show labels
  const [nearbyNodes, setNearbyNodes] = useState<LayoutNode[]>([]);

  // === Birth animation refs (D-07 through D-11, Pitfall 2: all refs, no useState) ===
  const isAnimating = useRef(false);
  const animationStartTime = useRef<number>(-1);
  // D-16: instanceIndex -> birth clock time (negative = pending with stagger index)
  const birthTimestamps = useRef<Map<number, number>>(new Map());
  const edgeAnimationStart = useRef<number>(-1);
  const animationCompleteRef = useRef(false);

  // Sparkle positions — stored separately for rendering (one setState at start/end only)
  const [sparklePositions, setSparklePositions] = useState<
    Array<{ x: number; y: number; z: number; scale: number }>
  >([]);

  // Compute which edge keys are new (connect to at least one new node)
  const newEdgeKeys = useMemo(() => {
    if (!newNodeIds || newNodeIds.size === 0) return undefined;
    const keys = new Set<string>();
    for (const edge of edges) {
      if (newNodeIds.has(edge.source) || newNodeIds.has(edge.target)) {
        const key =
          edge.source < edge.target
            ? `${edge.source}:${edge.target}`
            : `${edge.target}:${edge.source}`;
        keys.add(key);
      }
    }
    return keys;
  }, [edges, newNodeIds]);

  // Cluster labels: find connected components via edges, label each with dominant domain
  const nebulae = useMemo(() => {
    if (layoutNodes.length === 0) return [];

    // Build adjacency list and find connected components via BFS
    const nodeIdx = new Map(layoutNodes.map((n, i) => [n.id, i]));
    const adj: number[][] = layoutNodes.map(() => []);
    for (const e of edges) {
      const si = nodeIdx.get(e.source);
      const ti = nodeIdx.get(e.target);
      if (si !== undefined && ti !== undefined) {
        adj[si].push(ti);
        adj[ti].push(si);
      }
    }

    const visited = new Uint8Array(layoutNodes.length);
    const components: number[][] = [];
    for (let i = 0; i < layoutNodes.length; i++) {
      if (visited[i]) continue;
      const comp: number[] = [];
      const queue = [i];
      visited[i] = 1;
      while (queue.length > 0) {
        const cur = queue.shift()!;
        comp.push(cur);
        for (const nb of adj[cur]) {
          if (!visited[nb]) {
            visited[nb] = 1;
            queue.push(nb);
          }
        }
      }
      components.push(comp);
    }

    // For each component with >= 2 nodes, compute center, radius, and check for misconception clusters
    return components
      .filter((comp) => comp.length >= 2)
      .map((comp, idx) => {
        const nodes = comp.map((i) => layoutNodes[i]);
        const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
        const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
        const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;
        const maxDist = Math.max(
          ...nodes.map((n) =>
            Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2 + (n.z - cz) ** 2)
          )
        );

        // Red alert: does this component contain misconception nodes within 2 hops of each other?
        const misconceptionIdxs = comp.filter((i) => layoutNodes[i].status === "misconception");
        let isRedAlert = false;
        if (misconceptionIdxs.length >= 2) {
          for (const startIdx of misconceptionIdxs) {
            const dist = new Map<number, number>([[startIdx, 0]]);
            const queue: number[] = [startIdx];
            while (queue.length > 0) {
              const cur = queue.shift()!;
              const curDist = dist.get(cur)!;
              if (curDist >= 2) continue;
              for (const nb of adj[cur]) {
                if (!dist.has(nb)) {
                  dist.set(nb, curDist + 1);
                  queue.push(nb);
                }
              }
            }
            const foundOther = misconceptionIdxs.some(
              (mi) => mi !== startIdx && dist.has(mi) && dist.get(mi)! <= 2
            );
            if (foundOther) {
              isRedAlert = true;
              break;
            }
          }
        }

        const sorted = [...nodes].sort((a, b) => b.visitCount - a.visitCount);
        const topNames = sorted.slice(0, 2).map((n) => n.name);
        const label = topNames.join(" & ");
        return {
          id: idx,
          label,
          center: [cx, cy, cz] as [number, number, number],
          radius: maxDist + 20,
          count: nodes.length,
          isRedAlert,
        };
      });
  }, [layoutNodes, edges]);

  const { camera } = useThree();
  const controls = useThree((state) => state.controls) as any;

  /**
   * Birth animation initialization (D-07 through D-11).
   * Sets up staggered birth timestamps and camera framing for new nodes.
   */
  useEffect(() => {
    if (!animateEntry || !newNodeIds || newNodeIds.size === 0) return;
    if (layoutNodes.length === 0) return;

    isAnimating.current = true;
    animationStartTime.current = -1; // Will be set on first useFrame
    animationCompleteRef.current = false;

    // Find instance indices for new nodes and set up staggered birth times
    const newIndices: number[] = [];
    const sparkles: Array<{ x: number; y: number; z: number; scale: number }> = [];

    layoutNodes.forEach((node, idx) => {
      if (newNodeIds.has(node.id)) {
        newIndices.push(idx);
        sparkles.push({
          x: node.x,
          y: node.y,
          z: node.z,
          scale: getNodeRadius(node) * 2,
        });
      }
    });

    // Store indices for birth timestamp setup in the first useFrame call
    birthTimestamps.current.clear();
    newIndices.forEach((idx, i) => {
      // Negative value = "pending, stagger index i" — resolved on first frame
      birthTimestamps.current.set(idx, -(i + 1));
    });

    edgeAnimationStart.current = -1;

    // D-10: Set sparkle positions (one setState — start of animation only)
    setSparklePositions(sparkles);

    // D-09: Camera framing — compute bounding sphere of new nodes
    const newNodes = layoutNodes.filter((n) => newNodeIds.has(n.id));
    if (newNodes.length > 0) {
      let cx = 0,
        cy = 0,
        cz = 0;
      for (const n of newNodes) {
        cx += n.x;
        cy += n.y;
        cz += n.z;
      }
      cx /= newNodes.length;
      cy /= newNodes.length;
      cz /= newNodes.length;

      let maxDist = 0;
      for (const n of newNodes) {
        const d = Math.sqrt(
          (n.x - cx) ** 2 + (n.y - cy) ** 2 + (n.z - cz) ** 2
        );
        if (d > maxDist) maxDist = d;
      }

      const fov = (camera as THREE.PerspectiveCamera).fov ?? 60;
      const fovRad = (fov * Math.PI) / 180;
      const dist = Math.max((maxDist + 60) / Math.tan(fovRad / 2), 80);

      targetPosition.current.set(
        cx + dist * 0.3,
        cy + dist * 0.2,
        cz + dist
      );
      targetLookAt.current.set(cx, cy, cz);
      isFlying.current = true;
    }
  }, [animateEntry, newNodeIds, layoutNodes, camera]);

  /**
   * When highlightNodeId changes, find the matching layout node, start the
   * pulse animation, and fly the camera to it.
   */
  useEffect(() => {
    if (!highlightNodeId) {
      pulseRef.current = null;
      return;
    }

    const nodeIndex = layoutNodes.findIndex((n) => n.id === highlightNodeId);
    if (nodeIndex === -1) return;

    // Start pulse
    pulseRef.current = { nodeIndex, startTime: -1 };

    // Fly camera to the highlighted node
    const node = layoutNodes[nodeIndex];
    if (node) {
      targetPosition.current.set(node.x + 30, node.y + 20, node.z + 60);
      targetLookAt.current.set(node.x, node.y, node.z);
      isFlying.current = true;
    }
  }, [highlightNodeId, layoutNodes]);

  // Camera auto-reframe when filters change
  useEffect(() => {
    if (reframeTrigger === undefined || reframeTrigger === 0) return;
    if (layoutNodes.length === 0) return;

    let cx = 0,
      cy = 0,
      cz = 0;
    for (const n of layoutNodes) {
      cx += n.x;
      cy += n.y;
      cz += n.z;
    }
    cx /= layoutNodes.length;
    cy /= layoutNodes.length;
    cz /= layoutNodes.length;

    let maxDist = 0;
    for (const n of layoutNodes) {
      const d = Math.sqrt(
        (n.x - cx) ** 2 + (n.y - cy) ** 2 + (n.z - cz) ** 2
      );
      if (d > maxDist) maxDist = d;
    }

    const fov = (camera as THREE.PerspectiveCamera).fov ?? 60;
    const fovRad = (fov * Math.PI) / 180;
    const dist = Math.max((maxDist + 40) / Math.tan(fovRad / 2), 80);

    targetPosition.current.set(cx + dist * 0.3, cy + dist * 0.2, cz + dist);
    targetLookAt.current.set(cx, cy, cz);
    isFlying.current = true;
  }, [reframeTrigger, layoutNodes, camera]);

  const flyToNode = useCallback((node: LayoutNode) => {
    targetPosition.current.set(node.x + 30, node.y + 20, node.z + 60);
    targetLookAt.current.set(node.x, node.y, node.z);
    isFlying.current = true;
  }, []);

  const handleClick = useCallback(
    (nodeId: string) => {
      onNodeClick(nodeId);
      const node = layoutNodes.find((n) => n.id === nodeId);
      if (node) flyToNode(node);
    },
    [layoutNodes, flyToNode, onNodeClick]
  );

  // Proximity label update: every 10 frames, find nodes within 250 units of camera
  const frameCount = useRef(0);
  const tempVec = useMemo(() => new THREE.Vector3(), []);

  // Main useFrame loop: camera fly-to, birth animation, bridge pulse, proximity labels
  useFrame(({ clock }, delta) => {
    frameCount.current++;

    // === Birth animation loop (D-07, D-16) ===
    if (
      isAnimating.current &&
      meshRef.current &&
      birthTimestamps.current.size > 0
    ) {
      const now = clock.elapsedTime;

      // Initialize birth times on first frame
      if (animationStartTime.current === -1) {
        animationStartTime.current = now;
        const entries = Array.from(birthTimestamps.current.entries());
        birthTimestamps.current.clear();

        for (const [idx, staggerMarker] of entries) {
          // D-07: 300ms stagger between nodes
          const staggerIndex = Math.abs(staggerMarker) - 1;
          const birthTime = now + staggerIndex * 0.3;
          birthTimestamps.current.set(idx, birthTime);
        }
      }

      let allNodesComplete = true;

      for (const [idx, birthTime] of birthTimestamps.current) {
        const node = layoutNodes[idx];
        if (!node) continue;

        const elapsed = now - birthTime;
        if (elapsed < 0) {
          // Not yet born — keep at scale 0
          allNodesComplete = false;
          continue;
        }

        // D-07: 500ms scale-up with ease-out cubic (UI-SPEC)
        const DURATION = 0.5;
        const t = Math.min(elapsed / DURATION, 1);
        // Ease-out cubic: 1 - (1-t)^3
        const eased = 1 - Math.pow(1 - t, 3);

        const targetRadius = getNodeRadius(node);
        const currentScale = targetRadius * eased;

        pulseDummy.current.position.set(node.x, node.y, node.z);
        pulseDummy.current.scale.setScalar(currentScale);
        pulseDummy.current.updateMatrix();
        meshRef.current.setMatrixAt(idx, pulseDummy.current.matrix);

        if (t < 1) allNodesComplete = false;
      }

      meshRef.current.instanceMatrix.needsUpdate = true;

      // D-08: Trigger edge animation after all nodes settled
      if (allNodesComplete && edgeAnimationStart.current === -1) {
        edgeAnimationStart.current = now;
      }

      // Check if entire animation is complete (nodes done + edges had time to draw)
      if (allNodesComplete && edgeAnimationStart.current > 0) {
        const edgeElapsed = now - edgeAnimationStart.current;
        // Allow 1s for edges to draw in (400ms per edge with some overlap)
        if (edgeElapsed > 1.0 && !animationCompleteRef.current) {
          animationCompleteRef.current = true;
          isAnimating.current = false;
          birthTimestamps.current.clear();
          edgeAnimationStart.current = -1;
          // Clear sparkles (one setState at end — Pitfall 2 compliant)
          setSparklePositions([]);
          // Signal completion to parent
          onAnimationComplete?.();
        }
      }
    }

    // Pitfall 13: Suppress proximity label updates during active animation
    if (
      frameCount.current % 10 === 0 &&
      layoutNodes.length > 0 &&
      !isAnimating.current
    ) {
      const nearby: LayoutNode[] = [];
      for (const node of layoutNodes) {
        const dist = camera.position.distanceTo(
          tempVec.set(node.x, node.y, node.z)
        );
        if (dist < 250) nearby.push(node);
      }
      nearby.sort((a, b) => {
        const da = camera.position.distanceTo(tempVec.set(a.x, a.y, a.z));
        const db = camera.position.distanceTo(tempVec.set(b.x, b.y, b.z));
        return da - db;
      });
      setNearbyNodes(nearby.slice(0, 12));
    }

    // Camera fly-to with delta-based damping (Pitfall 10: refresh-rate independent)
    if (isFlying.current) {
      const dampingFactor = 1 - Math.pow(0.001, delta);
      camera.position.lerp(targetPosition.current, dampingFactor);

      if (controls) {
        controls.target.lerp(targetLookAt.current, dampingFactor);
        controls.update();
      }

      if (camera.position.distanceTo(targetPosition.current) < 0.5) {
        isFlying.current = false;
        if (controls) {
          controls.target.copy(targetLookAt.current);
          controls.update();
        }
      }
    }

    // Bridge highlight pulse — updates the highlighted node's scale in the InstancedMesh
    if (pulseRef.current && meshRef.current) {
      const pulse = pulseRef.current;

      if (pulse.startTime === -1) {
        pulse.startTime = clock.elapsedTime;
      }

      const elapsed = clock.elapsedTime - pulse.startTime;

      if (elapsed > 1.5) {
        const node = layoutNodes[pulse.nodeIndex];
        if (node) {
          const baseRadius = getNodeRadius(node);
          pulseDummy.current.position.set(node.x, node.y, node.z);
          pulseDummy.current.scale.setScalar(baseRadius);
          pulseDummy.current.updateMatrix();
          meshRef.current.setMatrixAt(
            pulse.nodeIndex,
            pulseDummy.current.matrix
          );
          meshRef.current.instanceMatrix.needsUpdate = true;
        }
        pulseRef.current = null;
      } else {
        const node = layoutNodes[pulse.nodeIndex];
        if (node) {
          const baseRadius = getNodeRadius(node);
          const scaleFactor =
            1 + 0.3 * Math.abs(Math.sin(elapsed * Math.PI * 4));
          pulseDummy.current.position.set(node.x, node.y, node.z);
          pulseDummy.current.scale.setScalar(baseRadius * scaleFactor);
          pulseDummy.current.updateMatrix();
          meshRef.current.setMatrixAt(
            pulse.nodeIndex,
            pulseDummy.current.matrix
          );
          meshRef.current.instanceMatrix.needsUpdate = true;
        }
      }
    }
  });

  return (
    <>
      <ambientLight intensity={3} />
      {/* Background star field (3000 particles, D-08) */}
      <Stars
        radius={300}
        depth={60}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={0.3}
      />
      <SolarNodes
        layoutNodes={layoutNodes}
        onNodeClick={handleClick}
        onNodeHover={setHoveredNode}
        highlightNodeId={highlightNodeId}
        meshRef={meshRef}
        newNodeIds={newNodeIds}
      />
      <SolarEdges
        layoutNodes={layoutNodes}
        edges={edges}
        newEdgeKeys={newEdgeKeys}
        edgeAnimationStartTime={edgeAnimationStart.current}
      />
      {/* D-10: Sparkle birth effects for new nodes */}
      {sparklePositions.map((sparkle, i) => (
        <Sparkles
          key={`birth-sparkle-${i}`}
          position={[sparkle.x, sparkle.y, sparkle.z]}
          count={12}
          size={0.4}
          color="#ffffff"
          scale={sparkle.scale}
          speed={0.8}
          opacity={0.8}
        />
      ))}
      {/* Nebula domain labels — font scales with cluster size */}
      {(() => {
        const maxCount = Math.max(...nebulae.map((n) => n.count), 1);
        return nebulae.map((neb) => {
          const t = neb.count / maxCount;
          const fontSize = Math.round(11 + t * 7);
          const fontWeight = t > 0.5 ? 700 : 600;
          return (
            <Html
              key={`label-${neb.id}`}
              position={[
                neb.center[0],
                neb.center[1] + neb.radius + 12,
                neb.center[2],
              ]}
              center
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onClusterClick?.(neb.id);
                }}
                style={{
                  color: neb.isRedAlert
                    ? "#fca5a5"
                    : "rgba(255,255,255,0.95)",
                  fontSize: `${fontSize}px`,
                  fontWeight,
                  letterSpacing: "0.05em",
                  textTransform: "capitalize",
                  whiteSpace: "nowrap",
                  pointerEvents: onClusterClick ? "auto" : "none",
                  userSelect: "none",
                  cursor: onClusterClick ? "pointer" : "default",
                  textShadow: neb.isRedAlert
                    ? "0 0 12px rgba(220,38,38,0.8), 0 0 30px rgba(0,0,0,0.9)"
                    : "0 0 12px rgba(100,100,255,0.5), 0 0 30px rgba(0,0,0,0.9)",
                  background: neb.isRedAlert
                    ? "rgba(127,29,29,0.4)"
                    : "rgba(0,0,0,0.3)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  border: neb.isRedAlert
                    ? "1px solid rgba(220,38,38,0.5)"
                    : "1px solid rgba(255,255,255,0.1)",
                  transition: "background 0.2s, border-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!onClusterClick) return;
                  const color = neb.isRedAlert ? "220,38,38" : "99,102,241";
                  e.currentTarget.style.background = `rgba(${color},0.35)`;
                  e.currentTarget.style.borderColor = `rgba(${color},0.6)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = neb.isRedAlert
                    ? "rgba(127,29,29,0.4)"
                    : "rgba(0,0,0,0.3)";
                  e.currentTarget.style.borderColor = neb.isRedAlert
                    ? "rgba(220,38,38,0.5)"
                    : "rgba(255,255,255,0.1)";
                }}
              >
                {neb.label}
              </div>
            </Html>
          );
        });
      })()}
      {/* Proximity labels — visible for nearby nodes (within 100 units) */}
      {nearbyNodes
        .filter((n) => !hoveredNode || n.id !== hoveredNode.id)
        .map((node) => (
          <Html
            key={`prox-${node.id}`}
            position={[node.x, node.y + getNodeRadius(node) + 3, node.z]}
            center
            distanceFactor={80}
          >
            <div
              style={{
                color: "rgba(255,255,255,0.95)",
                fontSize: "16px",
                fontWeight: 500,
                whiteSpace: "nowrap",
                pointerEvents: "none",
                userSelect: "none",
                textShadow:
                  "0 0 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)",
              }}
            >
              {node.name}
            </div>
          </Html>
        ))}
      {/* Hover label — only rendered for the hovered node, never for all nodes (D-11) */}
      {hoveredNode && (
        <Html
          position={[
            hoveredNode.x,
            hoveredNode.y + getNodeRadius(hoveredNode) + 2,
            hoveredNode.z,
          ]}
          center
          distanceFactor={120}
        >
          <div
            style={{
              background: "#18181b",
              color: "#fff",
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "14px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {hoveredNode.name} &middot;{" "}
            {hoveredNode.degree} connection
            {hoveredNode.degree !== 1 ? "s" : ""} &middot;{" "}
            {hoveredNode.visitCount} visit
            {hoveredNode.visitCount !== 1 ? "s" : ""}
          </div>
        </Html>
      )}
    </>
  );
}
