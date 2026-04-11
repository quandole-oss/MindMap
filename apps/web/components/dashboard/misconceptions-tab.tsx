"use client";

import { useState } from "react";

import type {
  MisconceptionCluster,
  ThemeCluster,
} from "@/lib/dashboard-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemesView } from "./themes-view";

interface MisconceptionsTabProps {
  clusters: MisconceptionCluster[];
  themeClusters: ThemeCluster[];
  classId: string;
}

type ViewMode = "misconception" | "theme";

/**
 * Misconceptions tab with a pill toggle between "By Misconception" (the
 * original view — extracted into MisconceptionCardGrid byte-identically)
 * and "By Root Theme" (DASH-07 / Plan 08-04 / D-20).
 *
 * The pill toggle lives IN THIS tab (D-20: not a new top-level tab) so that
 * teachers flip between two views of the same underlying data without
 * losing their place in the dashboard nav.
 */
export function MisconceptionsTab({
  clusters,
  themeClusters,
  classId,
}: MisconceptionsTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("misconception");

  return (
    <div className="space-y-4">
      {/* View-mode pill toggle */}
      <div className="inline-flex items-center rounded-full bg-[#f4f4f5] border border-[#e4e4e7] p-1 gap-1">
        <button
          type="button"
          onClick={() => setViewMode("misconception")}
          className={`px-4 py-1.5 text-[13px] font-medium rounded-full transition-colors ${
            viewMode === "misconception"
              ? "bg-white text-[#18181b] shadow-sm"
              : "text-[#71717a] hover:text-[#18181b]"
          }`}
        >
          By Misconception
        </button>
        <button
          type="button"
          onClick={() => setViewMode("theme")}
          className={`px-4 py-1.5 text-[13px] font-medium rounded-full transition-colors ${
            viewMode === "theme"
              ? "bg-white text-[#18181b] shadow-sm"
              : "text-[#71717a] hover:text-[#18181b]"
          }`}
        >
          By Root Theme
        </button>
      </div>

      {viewMode === "misconception" ? (
        <MisconceptionCardGrid clusters={clusters} />
      ) : (
        <ThemesView themes={themeClusters} classId={classId} />
      )}
    </div>
  );
}

// ─── MisconceptionCardGrid — byte-equivalent extraction of the original view
// Extracted into a private sub-component so the pill toggle can swap views
// without rewriting the existing misconception rendering. Behavior and class
// names are unchanged from the pre-Plan-08-04 implementation.

interface MisconceptionCardGridProps {
  clusters: MisconceptionCluster[];
}

function MisconceptionCardGrid({ clusters }: MisconceptionCardGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (clusters.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[14px] text-[#71717a]">
          No misconceptions detected in this class yet.
        </p>
      </div>
    );
  }

  const sorted = [...clusters].sort(
    (a, b) => b.unresolvedCount - a.unresolvedCount
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sorted.map((cluster) => {
        const pct =
          cluster.totalAffected > 0
            ? Math.round((cluster.resolvedCount / cluster.totalAffected) * 100)
            : 0;
        const progressWidth =
          cluster.totalAffected > 0
            ? `${(cluster.resolvedCount / cluster.totalAffected) * 100}%`
            : "0%";
        const isExpanded = expandedId === cluster.misconceptionId;

        return (
          <Card key={cluster.misconceptionId}>
            <CardHeader className="pb-3">
              <CardTitle
                className="text-[16px] font-semibold"
              >
                {cluster.misconceptionName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Stats row */}
              <div className="flex items-center gap-3 text-[13px]">
                <span className="text-[#52525b]">
                  {cluster.totalAffected} students affected
                </span>
                <span className="text-[#0d9488] font-medium">
                  {cluster.resolvedCount} resolved
                </span>
                <span className="text-[#f97316] font-medium">
                  {cluster.unresolvedCount} unresolved
                </span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="h-2 w-full bg-[#f4f4f5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0d9488] rounded-full"
                    style={{ width: progressWidth }}
                  />
                </div>
                <p className="text-[12px] text-[#71717a] mt-1">
                  {pct}% resolved
                </p>
              </div>

              {/* Drill-down toggle */}
              <div>
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : cluster.misconceptionId)
                  }
                  className="text-[13px] text-[#0d9488] hover:underline focus:outline-none"
                >
                  {isExpanded ? "Hide" : "Show affected students"}
                </button>
                {isExpanded && cluster.affectedStudentNames.length > 0 && (
                  <p className="mt-2 text-[13px] text-[#52525b]">
                    {cluster.affectedStudentNames.join(", ")}
                  </p>
                )}
                {isExpanded && cluster.affectedStudentNames.length === 0 && (
                  <p className="mt-2 text-[13px] text-[#71717a]">
                    No student names available.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
