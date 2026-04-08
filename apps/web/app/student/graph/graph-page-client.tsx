"use client";

import { useState } from "react";
import { KnowledgeGraph } from "@/components/graph/knowledge-graph";
import { NodeDetailPanel } from "@/components/graph/node-detail-panel";
import type { GraphNode, GraphEdge } from "@/actions/graph";

interface GraphPageClientProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function GraphPageClient({ nodes, edges }: GraphPageClientProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  return (
    <>
      <KnowledgeGraph
        nodes={nodes}
        edges={edges}
        onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
      />
      <NodeDetailPanel
        conceptId={selectedNodeId}
        open={!!selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
      />
    </>
  );
}
