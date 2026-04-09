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
  highlightNodeId?: string | null;
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
  highlightNodeId,
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

  // Nebula clusters: group nodes by domain and compute cluster center + radius
  const nebulae = useMemo(() => {
    if (layoutNodes.length === 0) return [];
    const groups: Record<string, LayoutNode[]> = {};
    for (const node of layoutNodes) {
      const d = node.domain || "unknown";
      (groups[d] ??= []).push(node);
    }
    return Object.entries(groups)
      .filter(([, nodes]) => nodes.length >= 2)
      .map(([domain, nodes]) => {
        const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
        const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
        const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;
        // Radius = max distance from center to any node in cluster + padding
        const maxDist = Math.max(
          ...nodes.map((n) =>
            Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2 + (n.z - cz) ** 2)
          )
        );
        return { domain, center: [cx, cy, cz] as [number, number, number], radius: maxDist + 20, count: nodes.length };
      });
  }, [layoutNodes]);

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
      <ambientLight intensity={0.15} />
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
      />
      <SolarEdges layoutNodes={layoutNodes} edges={edges} />
      {/* Nebula domain labels use nebulae data but no cloud spheres */}
      {/* Nebula domain labels — shown at cluster centers */}
      {nebulae.map((neb) => (
        <Html
          key={`label-${neb.domain}`}
          position={[neb.center[0], neb.center[1] + neb.radius + 5, neb.center[2]]}
          center
          distanceFactor={150}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {neb.domain}
          </div>
        </Html>
      ))}
      {/* Proximity labels — visible for nearby nodes (within 100 units) */}
      {nearbyNodes
        .filter((n) => !hoveredNode || n.id !== hoveredNode.id)
        .map((node) => (
        <Html
          key={`prox-${node.id}`}
          position={[node.x, node.y + getNodeRadius(node) + 3, node.z]}
          center
          distanceFactor={60}
        >
          <div
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "11px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              userSelect: "none",
              textShadow: "0 0 6px rgba(0,0,0,0.8)",
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
          distanceFactor={80}
        >
          <div
            style={{
              background: "#18181b",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "13px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {hoveredNode.name} &middot;{" "}
            {hoveredNode.visitCount} visit
            {hoveredNode.visitCount !== 1 ? "s" : ""}
          </div>
        </Html>
      )}
    </>
  );
}
