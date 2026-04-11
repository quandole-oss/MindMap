"use client";

import { useState } from "react";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import type { LessonPlan } from "@mindmap/llm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LessonPlanCardProps {
  plan: LessonPlan;
  onRegenerate: () => Promise<void>;
  isRegenerating?: boolean;
}

/**
 * Teacher-facing printable lesson plan card (Plan 08-04 / LSPL-02 / D-22 / D-24).
 *
 * Collapsed by default — click the header to expand all six sections.
 * Expand state is LOCAL to the card (Pitfall 6: do NOT collide with the
 * parent ThemesView's drill-down state).
 *
 * Print support is inline via Tailwind v4 `print:*` utilities (D-24). This
 * is the first user of `print:*` in the app. If you add more print-styled
 * components later, keep them colocated with their component — do NOT add
 * a global print stylesheet.
 *
 * Error state: if `onRegenerate` throws, a non-crashing "couldn't generate"
 * message is shown inline above the body. Phase 6 INFR-05 pattern.
 */
export function LessonPlanCard({
  plan,
  onRegenerate,
  isRegenerating = false,
}: LessonPlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    try {
      await onRegenerate();
    } catch {
      setError(
        "Couldn't generate a lesson plan right now. Please try again."
      );
    }
  }

  // Truncate commonMisunderstanding for the collapsed preview
  const previewSummary =
    plan.commonMisunderstanding.length > 140
      ? plan.commonMisunderstanding.slice(0, 140).trimEnd() + "…"
      : plan.commonMisunderstanding;

  return (
    <Card
      className="
        mt-4 border-[#e4e4e7]
        print:shadow-none print:border print:border-black
        print:break-inside-avoid print:mb-4 print:bg-white
        print:text-[14pt]
      "
    >
      <CardHeader
        className="pb-3 cursor-pointer select-none print:pb-2"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-[16px] font-semibold text-[#18181b] print:text-[14pt]">
              Lesson plan: {plan.theme}
            </CardTitle>
            {!expanded && (
              <p className="mt-1 text-[13px] text-[#71717a] line-clamp-2 print:text-[11pt]">
                {previewSummary}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="h-8 text-[12px] gap-1"
            >
              <RefreshCw
                className={`h-3 w-3 ${isRegenerating ? "animate-spin" : ""}`}
              />
              {isRegenerating ? "Regenerating" : "Regenerate"}
            </Button>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-[#71717a]" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#71717a]" aria-hidden />
            )}
          </div>
        </div>
      </CardHeader>

      {error && (
        <div className="px-6 pb-3">
          <div className="text-[13px] text-[#dc2626]">{error}</div>
        </div>
      )}

      {expanded && (
        <CardContent className="space-y-4 print:space-y-2">
          <section>
            <h4 className="text-[13px] font-semibold text-[#0d9488] uppercase tracking-wide mb-1 print:text-[11pt]">
              Common Misunderstanding
            </h4>
            <p className="text-[14px] text-[#18181b] print:text-[12pt]">
              {plan.commonMisunderstanding}
            </p>
          </section>

          <section>
            <h4 className="text-[13px] font-semibold text-[#0d9488] uppercase tracking-wide mb-1 print:text-[11pt]">
              Target Understanding
            </h4>
            <p className="text-[14px] text-[#18181b] print:text-[12pt]">
              {plan.targetUnderstanding}
            </p>
          </section>

          <section>
            <h4 className="text-[13px] font-semibold text-[#0d9488] uppercase tracking-wide mb-2 print:text-[11pt]">
              Suggested Activities
            </h4>
            <ol className="space-y-3 list-decimal list-inside">
              {plan.suggestedActivities.map((activity, i) => (
                <li key={i} className="text-[14px] text-[#18181b] print:text-[12pt]">
                  <span className="font-semibold">{activity.title}</span>
                  <p className="mt-1 ml-5 text-[13px] text-[#52525b] print:text-[11pt]">
                    {activity.description}
                  </p>
                  {activity.referencedMisconceptionIds.length > 0 && (
                    <p className="mt-1 ml-5 text-[11px] text-[#71717a] italic print:text-[9pt]">
                      Addresses:{" "}
                      {activity.referencedMisconceptionIds.join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h4 className="text-[13px] font-semibold text-[#0d9488] uppercase tracking-wide mb-1 print:text-[11pt]">
              Discussion Prompts
            </h4>
            <ul className="space-y-1 list-disc list-inside">
              {plan.discussionPrompts.map((prompt, i) => (
                <li
                  key={i}
                  className="text-[14px] text-[#18181b] print:text-[12pt]"
                >
                  {prompt}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="text-[13px] font-semibold text-[#0d9488] uppercase tracking-wide mb-1 print:text-[11pt]">
              Confrontation Approaches
            </h4>
            <ul className="space-y-1 list-disc list-inside">
              {plan.confrontationApproaches.map((approach, i) => (
                <li
                  key={i}
                  className="text-[14px] text-[#18181b] print:text-[12pt]"
                >
                  {approach}
                </li>
              ))}
            </ul>
          </section>
        </CardContent>
      )}
    </Card>
  );
}
