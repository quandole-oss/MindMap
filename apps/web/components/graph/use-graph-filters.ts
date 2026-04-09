"use client";

import { useState, useMemo, useCallback } from "react";
import type { GraphNode, GraphEdge } from "@/actions/graph";
import { computeClusters, type Cluster } from "@/lib/graph/clusters";

// Domain hierarchy — maps parent categories to child domains
const DOMAIN_GROUPS: Record<string, string[]> = {
  science: ["physics", "biology", "chemistry", "earth-science", "astronomy", "health", "engineering"],
  stem: ["physics", "biology", "chemistry", "earth-science", "astronomy", "math", "computer-science", "engineering"],
  humanities: ["history", "literature", "social-studies", "art", "music"],
  arts: ["art", "music", "literature"],
};

/** Expand a search query into matching domains if it's a known group */
function expandDomainQuery(q: string): Set<string> | null {
  const domains = DOMAIN_GROUPS[q];
  return domains ? new Set(domains) : null;
}

export interface GraphFilters {
  domains: Set<string>;
  statuses: Set<string>;
  activeClusterId: number | null;
  searchNodeIds: Set<string> | null; // null = no AI search active
  searchQuery: string;
  searchText: string; // live text for instant client-side filtering
}

export function useGraphFilters(nodes: GraphNode[], edges: GraphEdge[]) {
  const [domains, setDomains] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [activeClusterId, setActiveClusterId] = useState<number | null>(null);
  const [searchNodeIds, setSearchNodeIds] = useState<Set<string> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchText, setSearchTextState] = useState("");

  const clusters = useMemo(() => computeClusters(nodes, edges), [nodes, edges]);

  const availableDomains = useMemo(() => {
    const ds = new Set(nodes.map((n) => n.domain));
    return [...ds].sort();
  }, [nodes]);

  const filters: GraphFilters = useMemo(
    () => ({ domains, statuses, activeClusterId, searchNodeIds, searchQuery, searchText }),
    [domains, statuses, activeClusterId, searchNodeIds, searchQuery, searchText]
  );

  const hasActiveFilters =
    domains.size > 0 ||
    statuses.size > 0 ||
    activeClusterId !== null ||
    searchNodeIds !== null ||
    searchText.length > 0;

  const filteredNodes = useMemo(() => {
    let result = nodes;

    // AI search filter takes priority
    if (searchNodeIds !== null) {
      result = result.filter((n) => searchNodeIds.has(n.id));
    } else if (searchText.length > 0) {
      // Instant client-side text filter
      const q = searchText.toLowerCase();
      // Check if query matches a domain group (e.g., "science" → physics, biology, etc.)
      const expandedDomains = expandDomainQuery(q);
      result = result.filter((n) => {
        if (expandedDomains && expandedDomains.has(n.domain)) return true;
        return (
          n.name.toLowerCase().includes(q) ||
          n.domain.toLowerCase().includes(q)
        );
      });
    }

    // Cluster filter
    if (activeClusterId !== null) {
      const cluster = clusters.find((c) => c.id === activeClusterId);
      if (cluster) {
        result = result.filter((n) => cluster.nodeIds.has(n.id));
      }
    }

    // Domain filter
    if (domains.size > 0) {
      result = result.filter((n) => domains.has(n.domain));
    }

    // Status filter (special case: "bridge" checks isBridge)
    if (statuses.size > 0) {
      result = result.filter((n) => {
        if (n.isBridge && statuses.has("bridge")) return true;
        return statuses.has(n.status);
      });
    }

    return result;
  }, [nodes, clusters, activeClusterId, domains, statuses, searchNodeIds, searchText]);

  const filteredEdges = useMemo(() => {
    if (!hasActiveFilters) return edges;
    const nodeIdSet = new Set(filteredNodes.map((n) => n.id));
    return edges.filter(
      (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
    );
  }, [edges, filteredNodes, hasActiveFilters]);

  const toggleDomain = useCallback((domain: string) => {
    setDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  const toggleStatus = useCallback((status: string) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const setSearchText = useCallback((text: string) => {
    setSearchTextState(text);
    // Clear AI results when user edits text
    if (searchNodeIds !== null) {
      setSearchNodeIds(null);
      setSearchQuery("");
    }
  }, [searchNodeIds]);

  const setSearchResults = useCallback((query: string, nodeIds: string[] | null) => {
    setSearchQuery(query);
    setSearchNodeIds(nodeIds ? new Set(nodeIds) : null);
  }, []);

  const clearAllFilters = useCallback(() => {
    setDomains(new Set());
    setStatuses(new Set());
    setActiveClusterId(null);
    setSearchNodeIds(null);
    setSearchQuery("");
    setSearchTextState("");
  }, []);

  return {
    filters,
    clusters,
    availableDomains,
    filteredNodes,
    filteredEdges,
    hasActiveFilters,
    toggleDomain,
    toggleStatus,
    setActiveCluster: setActiveClusterId,
    setSearchText,
    setSearchResults,
    clearAllFilters,
  };
}
