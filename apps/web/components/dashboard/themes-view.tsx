"use client";

import { useState } from "react";
import type { LessonPlan } from "@mindmap/llm";
import type { ThemeCluster, ThemeDetail } from "@/lib/dashboard-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getOrGenerateLessonPlan,
  getThemeDetail,
} from "@/actions/themes";
import { LessonPlanCard } from "./lesson-plan-card";

interface ThemesViewProps {
  themes: ThemeCluster[];
  classId: string;
}

/**
 * Root-themes card grid for the Misconceptions tab (Plan 08-04 / DASH-07 / D-20).
 *
 * Ranks themes by studentsAffected DESC, then unresolvedCount DESC — the same
 * ordering used by buildThemeClusters so the parent-supplied array is already
 * in order, but we re-sort defensively in case a future change passes an
 * unsorted array.
 *
 * PARENT-LEVEL STATE (Pitfall 6):
 *
 * `expandedThemeId` and `lessonPlansByTheme` both live in THIS component,
 * not inside individual cards. `LessonPlanCard` owns its OWN local expand
 * state for the plan-body collapse, which is a DIFFERENT concern from
 * "which theme card is drilled down". Two distinct `useState`s by design.
 */
export function ThemesView({ themes, classId }: ThemesViewProps) {
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null);
  const [themeDetails, setThemeDetails] = useState<Record<string, ThemeDetail>>(
    {}
  );
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>(
    {}
  );
  const [lessonPlansByTheme, setLessonPlansByTheme] = useState<
    Record<string, LessonPlan>
  >({});
  const [loadingPlans, setLoadingPlans] = useState<Record<string, boolean>>(
    {}
  );
  const [regeneratingPlans, setRegeneratingPlans] = useState<
    Record<string, boolean>
  >({});
  const [errorByTheme, setErrorByTheme] = useState<Record<string, string>>({});

  if (themes.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[14px] text-[#71717a]">
          No themes detected yet — students need to complete more diagnostic
          sessions.
        </p>
      </div>
    );
  }

  const sorted = [...themes].sort(
    (a, b) =>
      b.studentsAffected - a.studentsAffected ||
      b.unresolvedCount - a.unresolvedCount
  );

  async function handleDrillDown(themeId: string) {
    if (expandedThemeId === themeId) {
      setExpandedThemeId(null);
      return;
    }
    setExpandedThemeId(themeId);
    if (!themeDetails[themeId]) {
      setLoadingDetails((prev) => ({ ...prev, [themeId]: true }));
      try {
        const detail = await getThemeDetail(classId, themeId);
        setThemeDetails((prev) => ({ ...prev, [themeId]: detail }));
      } catch {
        // Non-fatal; leave detail undefined so the UI shows nothing extra.
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [themeId]: false }));
      }
    }
  }

  async function handleGenerate(themeId: string) {
    setErrorByTheme((prev) => ({ ...prev, [themeId]: "" }));
    setLoadingPlans((prev) => ({ ...prev, [themeId]: true }));
    try {
      const plan = await getOrGenerateLessonPlan(classId, themeId);
      setLessonPlansByTheme((prev) => ({ ...prev, [themeId]: plan }));
    } catch {
      setErrorByTheme((prev) => ({
        ...prev,
        [themeId]:
          "Couldn't generate a lesson plan right now. Please try again.",
      }));
    } finally {
      setLoadingPlans((prev) => ({ ...prev, [themeId]: false }));
    }
  }

  async function handleRegenerate(themeId: string) {
    setRegeneratingPlans((prev) => ({ ...prev, [themeId]: true }));
    try {
      const fresh = await getOrGenerateLessonPlan(classId, themeId, {
        forceRegenerate: true,
      });
      setLessonPlansByTheme((prev) => ({ ...prev, [themeId]: fresh }));
    } finally {
      setRegeneratingPlans((prev) => ({ ...prev, [themeId]: false }));
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sorted.map((theme) => {
        const isExpanded = expandedThemeId === theme.themeId;
        const detail = themeDetails[theme.themeId];
        const plan = lessonPlansByTheme[theme.themeId];
        const isLoadingDetail = loadingDetails[theme.themeId] ?? false;
        const isLoadingPlan = loadingPlans[theme.themeId] ?? false;
        const isRegenerating = regeneratingPlans[theme.themeId] ?? false;
        const error = errorByTheme[theme.themeId];

        return (
          <Card key={theme.themeId}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-[16px] font-semibold text-[#18181b]">
                  {theme.themeName}
                </CardTitle>
                <Badge
                  className="bg-[#f4f4f5] text-[#52525b] border-[#e4e4e7] text-[11px] shrink-0"
                  variant="outline"
                >
                  {theme.studentsAffected} students
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Naive theory paragraph */}
              <p className="text-[13px] text-[#52525b] italic">
                {theme.naiveTheory}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-3 text-[13px]">
                <span className="text-[#0d9488] font-medium">
                  {theme.resolvedCount} resolved
                </span>
                <span className="text-[#f97316] font-medium">
                  {theme.unresolvedCount} unresolved
                </span>
                <span className="text-[#71717a]">
                  {theme.constituentMisconceptionIds.length} misconceptions
                </span>
              </div>

              {/* Drill-down toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => handleDrillDown(theme.themeId)}
                  className="text-[13px] text-[#0d9488] hover:underline focus:outline-none"
                >
                  {isExpanded ? "Hide details" : "Drill down"}
                </button>
              </div>

              {isExpanded && (
                <div className="pt-2 border-t border-[#e4e4e7] space-y-3">
                  {isLoadingDetail && (
                    <p className="text-[13px] text-[#71717a]">Loading details…</p>
                  )}
                  {detail && (
                    <>
                      <div>
                        <p className="text-[12px] font-semibold text-[#52525b] uppercase tracking-wide mb-1">
                          Constituent misconceptions
                        </p>
                        <ul className="space-y-1">
                          {detail.constituentMisconceptions.map((m) => (
                            <li
                              key={m.id}
                              className="text-[13px] text-[#18181b] flex items-center justify-between gap-2"
                            >
                              <span>{m.name}</span>
                              <span className="text-[11px] text-[#71717a] shrink-0">
                                {m.studentsAffected} affected · {m.resolvedCount}{" "}
                                resolved
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {detail.affectedStudents.length > 0 && (
                        <div>
                          <p className="text-[12px] font-semibold text-[#52525b] uppercase tracking-wide mb-1">
                            Affected students
                          </p>
                          <p className="text-[13px] text-[#52525b]">
                            {detail.affectedStudents
                              .map((s) => s.studentName)
                              .join(", ")}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Generate lesson plan */}
              {!plan && (
                <div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleGenerate(theme.themeId)}
                    disabled={isLoadingPlan}
                    className="h-8 text-[12px] bg-[#0d9488] hover:bg-[#0f766e] text-white"
                  >
                    {isLoadingPlan ? "Generating…" : "Generate Lesson Plan"}
                  </Button>
                  {error && (
                    <p className="mt-2 text-[13px] text-[#dc2626]">{error}</p>
                  )}
                </div>
              )}

              {plan && (
                <LessonPlanCard
                  plan={plan}
                  onRegenerate={() => handleRegenerate(theme.themeId)}
                  isRegenerating={isRegenerating}
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
