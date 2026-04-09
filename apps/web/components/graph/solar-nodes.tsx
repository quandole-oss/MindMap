"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { LayoutNode } from "./use-graph-layout";
import type { GraphNode } from "@/actions/graph";

// Node health state colors — exact same hex values as 2D knowledge-graph.tsx
const NODE_COLORS = {
  healthy: new THREE.Color("#0d9488"),
  misconception: new THREE.Color("#dc2626"),
  unprobed: new THREE.Color("#71717a"),
  bridge: new THREE.Color("#7c3aed"),
} as const;

function getNodeColor(node: GraphNode): THREE.Color {
  if (node.isBridge) return NODE_COLORS.bridge;
  return NODE_COLORS[node.status] ?? NODE_COLORS.unprobed;
}

/**
 * 3D sphere radius in world units.
 * Smaller than 2D pixel radius — scaled for WebGL units.
 */
export function getNodeRadius(node: GraphNode): number {
  return Math.min(3 + node.visitCount * 0.8, 10);
}

interface SolarNodesProps {
  layoutNodes: LayoutNode[];
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (node: LayoutNode | null) => void;
  highlightNodeId?: string | null;
  /** Optional shared ref — when provided, SolarScene uses it for pulse animation */
  meshRef?: React.MutableRefObject<THREE.InstancedMesh | null>;
}

/**
 * Renders all graph nodes as a single InstancedMesh (one draw call).
 *
 * Each instance has its own matrix (position + scale via getNodeRadius) and
 * color (via getNodeColor). Health state colors and radius formula match the
 * existing 2D KnowledgeGraph component.
 *
 * LOD (D-15): useFrame checks camera distance per node each frame.
 * Nodes farther than 150 world units from the camera are scaled down 0.3x,
 * making them appear as tiny glowing dots — visual LOD without geometry switching.
 * O(n) per frame; at 250 nodes ~0.1ms — within T-07-06 acceptable range.
 *
 * D-04, D-05, D-06, D-14 compliance:
 * - Single draw call via InstancedMesh
 * - vertexColors + toneMapped={false} required for Bloom (Research Pitfall 1)
 * - onClick uses e.instanceId to identify the clicked node
 * - onNodeHover for tooltip display
 */
export function SolarNodes({
  layoutNodes,
  onNodeClick,
  onNodeHover,
  highlightNodeId,
  meshRef: externalMeshRef,
}: SolarNodesProps) {
  const internalMeshRef = useRef<THREE.InstancedMesh>(null!);
  // meshRef always points to the internal ref for internal logic
  const meshRef = internalMeshRef;

  // Stable Object3D for matrix computation — memoized to avoid recreation
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // Reusable Vector3 for distance checks — avoids per-frame heap allocations
  const tempVec = useMemo(() => new THREE.Vector3(), []);

  const { camera } = useThree();

  // Initial matrix + color setup whenever layout changes
  useEffect(() => {
    if (!meshRef.current || layoutNodes.length === 0) return;

    layoutNodes.forEach((node, i) => {
      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.setScalar(getNodeRadius(node));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, getNodeColor(node));
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [layoutNodes, dummy]);

  // Callback ref: populates both internalMeshRef and optional externalMeshRef
  // Must be declared before any conditional return (Rules of Hooks)
  const setMeshRef = useCallback(
    (instance: THREE.InstancedMesh | null) => {
      internalMeshRef.current = instance!;
      if (externalMeshRef) {
        externalMeshRef.current = instance;
      }
    },
    [externalMeshRef]
  );

  /**
   * LOD: per-frame distance check. Nodes beyond 150 units shrink to 0.3x scale
   * (appear as small glowing points). Nodes within 150 units stay full-size.
   * T-07-06 mitigation: O(n) check; 250 nodes ≈ 0.1ms per frame — acceptable.
   */
  useFrame(() => {
    if (!meshRef.current || layoutNodes.length === 0) return;

    layoutNodes.forEach((node, i) => {
      const dist = camera.position.distanceTo(
        tempVec.set(node.x, node.y, node.z)
      );
      const baseRadius = getNodeRadius(node);
      const lodScale = dist > 150 ? 0.3 : 1;

      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.setScalar(baseRadius * lodScale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (layoutNodes.length === 0) return null;

  return (
    <instancedMesh
      ref={setMeshRef}
      args={[undefined, undefined, layoutNodes.length]}
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
      <meshStandardMaterial
        vertexColors
        emissive={new THREE.Color(1, 1, 1)}
        emissiveIntensity={1.5}
        toneMapped={false}
        roughness={0.3}
        metalness={0.1}
      />
    </instancedMesh>
  );
}
