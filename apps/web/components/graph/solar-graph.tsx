"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { SolarScene } from "./solar-scene";
import type { GraphNode, GraphEdge } from "@/actions/graph";

interface SolarGraphProps {
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
 * Full 3D knowledge graph with WebGL Canvas, post-processing Bloom, and
 * OrbitControls for rotate/zoom/pan (mouse and touch — D-09, D-13).
 *
 * Must be dynamically imported with ssr: false (see knowledge-graph.tsx).
 * Never import this directly in a server component — three.js uses browser
 * APIs not available in Node.js.
 *
 * Design decisions:
 * - dpr={[1, 2]} balances pixel density vs GPU load (Research recommendation)
 * - OrbitControls makeDefault exposes controls to useThree() inside SolarScene,
 *   enabling the camera fly-to lerp loop (D-12)
 * - Bloom luminanceThreshold=0.8 + material toneMapped=false + emissiveIntensity=1.5
 *   produces the star-glow effect (Research Pitfall 1)
 * - Suspense fallback=null prevents flash of unrelated content during R3F startup
 */
export function SolarGraph({
  nodes,
  edges,
  onNodeClick,
  onClusterClick,
  highlightNodeId,
  reframeTrigger,
  newNodeIds,
  animateEntry,
  onAnimationComplete,
}: SolarGraphProps) {
  return (
    <div
      className="relative w-full"
      style={{ height: "calc(100vh - 56px)", background: "#050510" }}
    >
      <Canvas
        camera={{ position: [0, 0, 200], fov: 60, near: 0.1, far: 2000 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <SolarScene
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            onClusterClick={onClusterClick}
            highlightNodeId={highlightNodeId}
            reframeTrigger={reframeTrigger}
            newNodeIds={newNodeIds}
            animateEntry={animateEntry}
            onAnimationComplete={onAnimationComplete}
          />
        </Suspense>
        {/* makeDefault exposes controls to useThree() in child components */}
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} maxDistance={1500} />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.7}
            luminanceSmoothing={0.9}
            intensity={1.5}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
