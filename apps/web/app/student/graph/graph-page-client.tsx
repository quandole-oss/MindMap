"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { KnowledgeGraph } from "@/components/graph/knowledge-graph";
import { NodeDetailPanel } from "@/components/graph/node-detail-panel";
import { BridgeToast } from "@/components/graph/bridge-toast";
import { GraphFilterBar } from "@/components/graph/graph-filter-bar";
import { useGraphFilters } from "@/components/graph/use-graph-filters";
import { searchNodes } from "@/actions/graph";
import type { GraphNode, GraphEdge } from "@/actions/graph";
import { HealthLegend } from "@/components/graph/health-legend";

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
  const searchParams = useSearchParams();
  const initialNodeId = searchParams.get("node");

  // D-03: Parse animation URL params
  const animateEntry = searchParams.get("animate") === "true";
  const newNodeIdsParam = searchParams.get("newNodes");
  const newNodeIds = useMemo(() => {
    if (!animateEntry || !newNodeIdsParam) return undefined;
    return new Set(newNodeIdsParam.split(",").filter(Boolean));
  }, [animateEntry, newNodeIdsParam]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodeId);
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(initialNodeId);
  const [searching, setSearching] = useState(false);

  // Clear initial highlight after animation
  useEffect(() => {
    if (initialNodeId) {
      const timer = setTimeout(() => setHighlightNodeId(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [initialNodeId]);

  const {
    filters,
    clusters,
    availableDomains,
    filteredNodes,
    filteredEdges,
    hasActiveFilters,
    toggleDomain,
    toggleStatus,
    setActiveCluster,
    setSearchText,
    setSearchResults,
    clearAllFilters,
  } = useGraphFilters(nodes, edges);

  // Reframe camera when filters change
  const reframeTrigger = useRef(0);
  const [reframe, setReframe] = useState(0);
  useEffect(() => {
    if (hasActiveFilters || reframeTrigger.current > 0) {
      reframeTrigger.current++;
      setReframe(reframeTrigger.current);
    }
  }, [filteredNodes.length, hasActiveFilters]);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults("", null);
        return;
      }

      setSearching(true);
      try {
        const nodeList = nodes.map((n) => ({ id: n.id, name: n.name, domain: n.domain }));
        const matchedIds = await searchNodes(query, nodeList);
        setSearchResults(query, matchedIds);
      } catch (err) {
        console.error("AI search failed:", err);
      } finally {
        setSearching(false);
      }
    },
    [nodes, setSearchResults]
  );

  function handleExplore(nodeId: string) {
    setSelectedNodeId(nodeId);
    setHighlightNodeId(nodeId);
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
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
        onClusterClick={setActiveCluster}
        highlightNodeId={highlightNodeId}
        reframeTrigger={reframe}
        newNodeIds={newNodeIds}
        animateEntry={animateEntry}
      />
      <GraphFilterBar
        availableDomains={availableDomains}
        filters={filters}
        clusters={clusters}
        hasActiveFilters={hasActiveFilters}
        searching={searching}
        onToggleDomain={toggleDomain}
        onToggleStatus={toggleStatus}
        onClearCluster={() => setActiveCluster(null)}
        onClearAll={clearAllFilters}
        onSearchTextChange={setSearchText}
        onSearch={handleSearch}
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg px-5 py-2.5">
        <HealthLegend />
      </div>
      <NodeDetailPanel
        conceptId={selectedNodeId}
        open={!!selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
      />
    </>
  );
}
