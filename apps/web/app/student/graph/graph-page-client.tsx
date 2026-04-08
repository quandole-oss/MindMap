"use client";

import { useState } from "react";
import { KnowledgeGraph } from "@/components/graph/knowledge-graph";
import { NodeDetailPanel } from "@/components/graph/node-detail-panel";
import { BridgeToast } from "@/components/graph/bridge-toast";
import type { GraphNode, GraphEdge } from "@/actions/graph";

interface BridgeData {
  bridgeNodeId: string;
  bridgeNodeName: string;
  domainA: string;
  domainB: string;
}

interface GraphPageClientProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  bridgeData: BridgeData | null;
}

export function GraphPageClient({ nodes, edges, bridgeData }: GraphPageClientProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null);

  function handleExplore(nodeId: string) {
    setSelectedNodeId(nodeId);
    setHighlightNodeId(nodeId);
    // Clear pulse highlight after 3 cycles (~1.5s at 500ms per cycle)
    setTimeout(() => setHighlightNodeId(null), 1500);
  }

  return (
    <>
      {bridgeData && (
        <BridgeToast
          bridgeNodeId={bridgeData.bridgeNodeId}
          bridgeNodeName={bridgeData.bridgeNodeName}
          domainA={bridgeData.domainA}
          domainB={bridgeData.domainB}
          onExplore={handleExplore}
        />
      )}
      <KnowledgeGraph
        nodes={nodes}
        edges={edges}
        onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
        highlightNodeId={highlightNodeId}
      />
      <NodeDetailPanel
        conceptId={selectedNodeId}
        open={!!selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
      />
    </>
  );
}
