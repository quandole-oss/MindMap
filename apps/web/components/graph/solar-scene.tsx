"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Html } from "@react-three/drei";
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

  // Reusable Object3D for matrix updates during pulse
  const pulseDummy = useRef(new THREE.Object3D());

  // InstancedMesh ref shared between SolarNodes and SolarScene for pulse updates
  // We pass a callback down via onNodeHover to access the mesh — but SolarNodes
  // owns the meshRef. Instead, we'll handle pulse via a separate overlay approach:
  // track the pulse node index and inject it so SolarNodes can apply it in useFrame.
  // Since SolarNodes owns the InstancedMesh, we communicate via a shared ref.
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  // Proximity labels: track which nodes are close enough to show labels
  const [nearbyNodes, setNearbyNodes] = useState<LayoutNode[]>([]);

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
          // BFS from each misconception node, check if another misconception is within 2 hops
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
            // Check if any other misconception node is reachable within 2 hops
            const foundOther = misconceptionIdxs.some(
              (mi) => mi !== startIdx && dist.has(mi) && dist.get(mi)! <= 2
            );
            if (foundOther) {
              isRedAlert = true;
              break;
            }
          }
        }

        // Build a descriptive label from the most-visited concept names in this cluster
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
    pulseRef.current = { nodeIndex, startTime: -1 }; // -1 = use clock on first frame

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

    // Compute bounding sphere center of all visible nodes
    let cx = 0, cy = 0, cz = 0;
    for (const n of layoutNodes) {
      cx += n.x; cy += n.y; cz += n.z;
    }
    cx /= layoutNodes.length;
    cy /= layoutNodes.length;
    cz /= layoutNodes.length;

    let maxDist = 0;
    for (const n of layoutNodes) {
      const d = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2 + (n.z - cz) ** 2);
      if (d > maxDist) maxDist = d;
    }

    // Position camera to encompass all nodes with margin
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 60;
    const fovRad = (fov * Math.PI) / 180;
    const dist = Math.max((maxDist + 40) / Math.tan(fovRad / 2), 80);

    targetPosition.current.set(cx + dist * 0.3, cy + dist * 0.2, cz + dist);
    targetLookAt.current.set(cx, cy, cz);
    isFlying.current = true;
  }, [reframeTrigger, layoutNodes, camera]);

  /**
   * Fly camera smoothly to a node. Sets target position and look-at so that
   * the useFrame lerp loop animates the camera there over ~1 second.
   */
  const flyToNode = useCallback(
    (node: LayoutNode) => {
      targetPosition.current.set(node.x + 30, node.y + 20, node.z + 60);
      targetLookAt.current.set(node.x, node.y, node.z);
      isFlying.current = true;
    },
    []
  );

  /**
   * Handle click on a node — opens side panel AND flies camera to the node.
   */
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

  // Camera fly-to lerp + bridge pulse animation + proximity labels
  useFrame(({ clock }) => {
    // Update proximity labels every 10 frames (perf: avoid per-frame sort)
    frameCount.current++;
    if (frameCount.current % 10 === 0 && layoutNodes.length > 0) {
      const nearby: LayoutNode[] = [];
      for (const node of layoutNodes) {
        const dist = camera.position.distanceTo(
          tempVec.set(node.x, node.y, node.z)
        );
        if (dist < 250) nearby.push(node);
      }
      // Cap at 12 labels to avoid clutter
      nearby.sort((a, b) => {
        const da = camera.position.distanceTo(tempVec.set(a.x, a.y, a.z));
        const db = camera.position.distanceTo(tempVec.set(b.x, b.y, b.z));
        return da - db;
      });
      setNearbyNodes(nearby.slice(0, 12));
    }
    // Camera fly-to
    if (isFlying.current) {
      camera.position.lerp(targetPosition.current, 0.06);

      if (controls) {
        controls.target.lerp(targetLookAt.current, 0.06);
        controls.update();
      }

      if (camera.position.distanceTo(targetPosition.current) < 0.5) {
        isFlying.current = false;
        // Snap controls target so OrbitControls orbits around the correct center
        if (controls) {
          controls.target.copy(targetLookAt.current);
          controls.update();
        }
      }
    }

    // Bridge highlight pulse — updates the highlighted node's scale in the InstancedMesh
    if (pulseRef.current && meshRef.current) {
      const pulse = pulseRef.current;

      // Initialize startTime on first frame of pulse
      if (pulse.startTime === -1) {
        pulse.startTime = clock.elapsedTime;
      }

      const elapsed = clock.elapsedTime - pulse.startTime;

      if (elapsed > 1.5) {
        // Pulse complete — restore normal scale then clear
        const node = layoutNodes[pulse.nodeIndex];
        if (node) {
          const baseRadius = getNodeRadius(node);
          pulseDummy.current.position.set(node.x, node.y, node.z);
          pulseDummy.current.scale.setScalar(baseRadius);
          pulseDummy.current.updateMatrix();
          meshRef.current.setMatrixAt(pulse.nodeIndex, pulseDummy.current.matrix);
          meshRef.current.instanceMatrix.needsUpdate = true;
        }
        pulseRef.current = null;
      } else {
        // Active pulse: 3 cycles over 1.5s via sine wave
        const node = layoutNodes[pulse.nodeIndex];
        if (node) {
          const baseRadius = getNodeRadius(node);
          // sin(elapsed * PI * 4) gives 2 full cycles in 0.5s each = 3 pulses over 1.5s
          const scaleFactor = 1 + 0.3 * Math.abs(Math.sin(elapsed * Math.PI * 4));
          pulseDummy.current.position.set(node.x, node.y, node.z);
          pulseDummy.current.scale.setScalar(baseRadius * scaleFactor);
          pulseDummy.current.updateMatrix();
          meshRef.current.setMatrixAt(pulse.nodeIndex, pulseDummy.current.matrix);
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
      <SolarEdges layoutNodes={layoutNodes} edges={edges} />
      {/* Nebula domain labels — font scales with cluster size */}
      {(() => {
        const maxCount = Math.max(...nebulae.map((n) => n.count), 1);
        return nebulae.map((neb) => {
          // Scale font: smallest clusters get 11px, largest get 18px
          const t = neb.count / maxCount;
          const fontSize = Math.round(11 + t * 7);
          const fontWeight = t > 0.5 ? 700 : 600;
          return (
        <Html
          key={`label-${neb.id}`}
          position={[neb.center[0], neb.center[1] + neb.radius + 12, neb.center[2]]}
          center
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              onClusterClick?.(neb.id);
            }}
            style={{
              color: neb.isRedAlert ? "#fca5a5" : "rgba(255,255,255,0.95)",
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
              background: neb.isRedAlert ? "rgba(127,29,29,0.4)" : "rgba(0,0,0,0.3)",
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
              e.currentTarget.style.background = neb.isRedAlert ? "rgba(127,29,29,0.4)" : "rgba(0,0,0,0.3)";
              e.currentTarget.style.borderColor = neb.isRedAlert ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.1)";
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
              textShadow: "0 0 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)",
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
