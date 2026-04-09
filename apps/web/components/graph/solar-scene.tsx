"use client";

import { useState, useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import { SolarNodes } from "./solar-nodes";
import { SolarEdges } from "./solar-edges";
import { useGraphLayout, type LayoutNode } from "./use-graph-layout";
import type { GraphNode, GraphEdge } from "@/actions/graph";

/**
 * 3D sphere radius in world units — duplicated here so SolarScene can position
 * the Html tooltip correctly without importing internal implementation from solar-nodes.
 */
function getNodeRadius(node: GraphNode): number {
  return Math.min(3 + node.visitCount * 0.8, 10);
}

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

  const { camera } = useThree();
  const controls = useThree((state) => state.controls) as any;

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
   * Handle click on a node — single click opens side panel,
   * double-click (same node within 300ms) triggers fly-to.
   */
  const handleClick = useCallback(
    (nodeId: string) => {
      const now = Date.now();
      const isSameNode = lastClickNodeId.current === nodeId;
      const isDoubleClick = isSameNode && now - lastClickTime.current < 300;

      lastClickTime.current = now;
      lastClickNodeId.current = nodeId;

      if (isDoubleClick) {
        const node = layoutNodes.find((n) => n.id === nodeId);
        if (node) flyToNode(node);
      } else {
        onNodeClick(nodeId);
      }
    },
    [layoutNodes, flyToNode, onNodeClick]
  );

  // Lerp camera toward fly-to target each frame
  useFrame(() => {
    if (!isFlying.current) return;

    camera.position.lerp(targetPosition.current, 0.06);

    if (controls) {
      controls.target.lerp(targetLookAt.current, 0.06);
      controls.update();
    }

    if (camera.position.distanceTo(targetPosition.current) < 0.5) {
      isFlying.current = false;
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
      />
      <SolarEdges layoutNodes={layoutNodes} edges={edges} />
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
