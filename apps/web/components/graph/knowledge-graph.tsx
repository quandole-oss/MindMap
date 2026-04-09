"use client";

import dynamic from "next/dynamic";
import type { GraphNode, GraphEdge } from "@/actions/graph";

/**
 * SSR-safe dynamic import bridge for the 3D SolarGraph.
 *
 * ssr: false is CRITICAL — three.js uses browser-only APIs (window, WebGL
 * context) that are not available in Node.js. Without ssr: false, Next.js
 * server-side rendering crashes with "window is not defined" or WebGL errors.
 *
 * The loading fallback uses the same dark background (#050510) as SolarGraph
 * so the transition from loading to rendered is seamless.
 *
 * This file preserves the original export name (KnowledgeGraph) and props
 * interface so graph-page-client.tsx works without any modification.
 */
const SolarGraph = dynamic(
  () => import("./solar-graph").then((m) => m.SolarGraph),
  {
    ssr: false,
    loading: () => (
      <div
        className="relative w-full flex items-center justify-center"
        style={{ height: "calc(100vh - 120px)", background: "#050510" }}
      >
        <p className="text-sm text-[#71717a]">Loading 3D graph...</p>
      </div>
    ),
  }
);

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (nodeId: string) => void;
  onClusterClick?: (clusterId: number) => void;
  highlightNodeId?: string | null;
  reframeTrigger?: number;
}

export function KnowledgeGraph(props: KnowledgeGraphProps) {
  return <SolarGraph {...props} />;
}
