"use client";

import { useRef, useEffect, useMemo, useCallback, useState } from "react";

import * as THREE from "three";
import type { LayoutNode } from "./use-graph-layout";
import type { GraphNode } from "@/actions/graph";
// Node health state base colors (linear RGB, used with meshBasicMaterial)
// Multipliers computed from BT.709 luminance to exceed bloom threshold (0.7):
//   healthy:       L_base=0.229 × 4.0 = 0.917 → vivid teal glow
//   misconception: L_base=0.166 × 5.0 = 0.832 → vivid red glow
//   unprobed:      L_base=0.160 × 3.0 = 0.481 → faint ghost glow (intentionally dimmer)
//   bridge:        L_base=0.132 × 6.0 = 0.793 → brightest, most prominent
const NODE_COLORS: Record<string, THREE.Color> = {
  healthy: new THREE.Color("#0d9488"),
  misconception: new THREE.Color("#dc2626"),
  unprobed: new THREE.Color("#71717a"),
  bridge: new THREE.Color("#7c3aed"),
};

function getNodeColor(node: GraphNode): THREE.Color {
  if (node.isBridge) return NODE_COLORS.bridge.clone().multiplyScalar(6.0);
  if (node.status === "misconception") return NODE_COLORS.misconception.clone().multiplyScalar(5.0);
  if (node.status === "healthy") return NODE_COLORS.healthy.clone().multiplyScalar(4.0);
  return NODE_COLORS.unprobed.clone().multiplyScalar(3.0);
}

/**
 * 3D sphere radius in world units, driven by pre-computed importance [0..1].
 * Range [3..22] gives dramatic visual differentiation.
 * Linear mapping so low-importance nodes are noticeably small.
 */
export function getNodeRadius(node: GraphNode): number {
  const MIN = 1.5, MAX = 14;
  const t = node.importance ?? 0;
  return MIN + t * t * (MAX - MIN);
}

/** D-15: Over-allocate by this many instances beyond current count */
const GROWTH_BUFFER = 20;

interface SolarNodesProps {
  layoutNodes: LayoutNode[];
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (node: LayoutNode | null) => void;
  highlightNodeId?: string | null;
  /** Optional shared ref — when provided, SolarScene uses it for pulse animation */
  meshRef?: React.MutableRefObject<THREE.InstancedMesh | null>;
  /** Set of node IDs that are newly added and should start at scale 0 */
  newNodeIds?: Set<string>;
}

/**
 * Renders all graph nodes as a single InstancedMesh (one draw call).
 *
 * Each instance has its own matrix (position + scale via getNodeRadius) and
 * color (via getNodeColor). Node scale is fixed — no LOD, so nodes maintain
 * consistent size at all camera distances.
 *
 * D-15: InstancedMesh buffer is over-allocated by GROWTH_BUFFER instances.
 * mesh.count is set to the visible node count. The key prop is based on
 * buffer capacity (not node count), so remounts only happen when the buffer
 * is exhausted — not on every node addition.
 *
 * - Single draw call via InstancedMesh
 * - meshBasicMaterial + toneMapped={false} for Bloom-compatible self-luminous rendering
 * - onClick uses e.instanceId to identify the clicked node
 * - onNodeHover for tooltip display
 */
export function SolarNodes({
  layoutNodes,
  onNodeClick,
  onNodeHover,
  highlightNodeId,
  meshRef: externalMeshRef,
  newNodeIds,
}: SolarNodesProps) {
  const internalMeshRef = useRef<THREE.InstancedMesh>(null!);
  // meshRef always points to the internal ref for internal logic
  const meshRef = internalMeshRef;

  // Stable Object3D for matrix computation — memoized to avoid recreation
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Track when the mesh ref is available so useEffect can depend on it
  const [meshReady, setMeshReady] = useState(false);

  // D-15: Track buffer capacity. Only remount when buffer is exhausted.
  const bufferCapacity = useRef(0);

  // Compute required capacity — only grow, never shrink
  const requiredCapacity = layoutNodes.length + GROWTH_BUFFER;
  if (bufferCapacity.current === 0 || layoutNodes.length > bufferCapacity.current) {
    bufferCapacity.current = requiredCapacity;
  }

  // Initial matrix + color setup whenever layout or mesh changes
  useEffect(() => {
    if (!meshRef.current || layoutNodes.length === 0) return;

    // D-15: Set visible count to actual node count (not buffer size)
    meshRef.current.count = layoutNodes.length;

    layoutNodes.forEach((node, i) => {
      // If this is a new node, start at scale 0 (animation will scale it up in SolarScene)
      const isNew = newNodeIds?.has(node.id) ?? false;
      const scale = isNew ? 0 : getNodeRadius(node);

      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, getNodeColor(node));
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    // Required for raycasting to work on InstancedMesh
    meshRef.current.computeBoundingBox();
    meshRef.current.computeBoundingSphere();
  }, [layoutNodes, dummy, meshReady, newNodeIds]);

  // Callback ref: populates both internalMeshRef and optional externalMeshRef
  // Must be declared before any conditional return (Rules of Hooks)
  const setMeshRef = useCallback(
    (instance: THREE.InstancedMesh | null) => {
      internalMeshRef.current = instance!;
      if (externalMeshRef) {
        externalMeshRef.current = instance;
      }
      if (instance) setMeshReady(true);
    },
    [externalMeshRef]
  );

  // Node scale is set once in useEffect above and stays constant during zoom/pan.
  // No per-frame LOD — nodes maintain consistent size at all camera distances.

  if (layoutNodes.length === 0) return null;

  return (
    <instancedMesh
      key={bufferCapacity.current}
      ref={setMeshRef}
      args={[undefined, undefined, bufferCapacity.current]}
      onClick={(e) => {
        e.stopPropagation();
        const node = layoutNodes[e.instanceId!];
        if (node) onNodeClick(node.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onNodeHover(layoutNodes[e.instanceId!] ?? null);
      }}
      onPointerOut={() => onNodeHover(null)}
    >
      {/* radius=1, scale applied per-instance via dummy.scale.setScalar(radius) */}
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial
        toneMapped={false}
      />
    </instancedMesh>
  );
}
