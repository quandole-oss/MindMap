"use client";

import { useRef } from "react";
import { Search, ChevronDown, ChevronUp, X, Loader2 } from "lucide-react";
import { useState } from "react";
import { getDomainColor } from "@/lib/graph/domain-colors";

import type { GraphFilters } from "./use-graph-filters";
import type { Cluster } from "@/lib/graph/clusters";

const STATUS_OPTIONS = [
  { key: "healthy", label: "Understood", color: "var(--color-healthy, #0d9488)" },
  { key: "misconception", label: "Needs Review", color: "var(--color-misconception, #dc2626)" },
  { key: "unprobed", label: "Not Explored", color: "var(--color-unprobed, #71717a)" },
  { key: "bridge", label: "Bridge", color: "var(--color-bridge, #7c3aed)" },
];

interface GraphFilterBarProps {
  availableDomains: string[];
  filters: GraphFilters;
  clusters: Cluster[];
  hasActiveFilters: boolean;
  searching: boolean;
  onToggleDomain: (domain: string) => void;
  onToggleStatus: (status: string) => void;
  onClearCluster: () => void;
  onClearAll: () => void;
  onSearchTextChange: (text: string) => void;
  onSearch: (query: string) => void;
}

export function GraphFilterBar({
  availableDomains,
  filters,
  clusters,
  hasActiveFilters,
  searching,
  onToggleDomain,
  onToggleStatus,
  onClearCluster,
  onClearAll,
  onSearchTextChange,
  onSearch,
}: GraphFilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCluster =
    filters.activeClusterId !== null
      ? clusters.find((c) => c.id === filters.activeClusterId)
      : null;

  const activeCount =
    filters.domains.size +
    filters.statuses.size +
    (activeCluster ? 1 : 0) +
    (filters.searchNodeIds !== null ? 1 : 0);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = filters.searchText.trim();
    if (q) onSearch(q);
  }

  function handleClearSearch() {
    onSearchTextChange("");
    inputRef.current?.focus();
  }

  const hasText = filters.searchText.length > 0;
  const hasAiResults = filters.searchNodeIds !== null;

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-[420px]">
      {/* Search bar — always visible */}
      <div
        className={`bg-black/50 backdrop-blur-md border rounded-lg overflow-hidden ${
          hasText || hasAiResults ? "border-indigo-500/40" : "border-white/10"
        }`}
      >
        <form onSubmit={handleSearchSubmit} className="flex items-center px-3 py-2 gap-2">
          {searching ? (
            <Loader2 size={14} className="text-indigo-400 animate-spin flex-shrink-0" />
          ) : (
            <Search size={14} className="text-white/40 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={filters.searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            placeholder="Search concepts..."
            className="bg-transparent text-[13px] text-white placeholder:text-white/30 outline-none flex-1 min-w-0"
          />
          {(hasText || hasAiResults) && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-white/40 hover:text-white transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </form>
        {hasAiResults && (
          <div className="px-3 pb-2 text-[11px] text-indigo-300/70">
            {filters.searchNodeIds!.size} concept{filters.searchNodeIds!.size !== 1 ? "s" : ""} found by AI
          </div>
        )}
        {hasText && !hasAiResults && !searching && (
          <div className="px-3 pb-2 text-[11px] text-white/25">
            Press Enter for AI-powered search
          </div>
        )}
      </div>

      {/* Filters dropdown */}
      <div
        className={`bg-black/50 backdrop-blur-md border rounded-lg overflow-hidden ${
          hasActiveFilters && !hasText && !hasAiResults
            ? "border-indigo-500/40"
            : "border-white/10"
        }`}
      >
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center justify-between w-full px-4 py-2.5 text-white/80 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium">Filters</span>
            {activeCount > 0 && (
              <span className="bg-indigo-500/30 text-indigo-200 text-[11px] font-medium rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {activeCount}
              </span>
            )}
          </div>
          {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {filtersOpen && (
          <div className="px-4 pb-3 flex flex-col gap-3 border-t border-white/10 pt-3">
            {activeCluster && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-white/40 font-medium">
                  Cluster
                </span>
                <div className="flex items-center gap-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-full px-2.5 py-0.5">
                  <span className="text-[12px] text-indigo-200 capitalize truncate max-w-[180px]">
                    {activeCluster.label}
                  </span>
                  <button
                    onClick={onClearCluster}
                    className="text-indigo-300 hover:text-white transition-colors"
                    aria-label="Clear cluster filter"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            {availableDomains.length > 1 && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-white/40 font-medium block mb-1.5">
                  Subject
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableDomains.map((domain) => {
                    const active = filters.domains.has(domain);
                    const color = getDomainColor(domain);
                    return (
                      <button
                        key={domain}
                        onClick={() => onToggleDomain(domain)}
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] capitalize transition-all ${
                          active
                            ? "bg-white/15 border-white/30 text-white"
                            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
                        } border`}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        {domain}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <span className="text-[11px] uppercase tracking-wider text-white/40 font-medium block mb-1.5">
                Status
              </span>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map(({ key, label, color }) => {
                  const active = filters.statuses.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => onToggleStatus(key)}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition-all ${
                        active
                          ? "bg-white/15 border-white/30 text-white"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
                      } border`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={onClearAll}
                className="text-[12px] text-indigo-300 hover:text-white transition-colors self-start mt-0.5"
              >
                Show All
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
