"use client";

import { useState } from "react";

import type { MisconceptionCluster } from "@/lib/dashboard-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MisconceptionsTabProps {
  clusters: MisconceptionCluster[];
}

export function MisconceptionsTab({ clusters }: MisconceptionsTabProps) {
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
