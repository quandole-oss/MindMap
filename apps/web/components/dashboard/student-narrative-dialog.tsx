"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import {
  generateStudentNarrative,
  type StudentNarrativeResult,
} from "@/actions/themes";
import { cn } from "@/lib/utils";

interface StudentNarrativeDialogProps {
  studentId: string;
  studentName: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Per-student Diagnostic Narrative modal (Plan 08-04 / DASH-08 / D-19 / D-13).
 *
 * PRIV-01 BOUNDARY (T-08-17 / D-13):
 * The dialog title reads `Diagnostic Narrative for ${studentName}` — the
 * student's name comes from PROPS, NOT from the LLM output. The analysis
 * result is rendered unmodified, but the body should never contain the
 * student's name because `analyzeStudentThemes` was never given one (the
 * server action `generateStudentNarrative` does not accept a name param).
 *
 * NO CACHE (D-19):
 * The narrative is generated fresh every time the dialog opens. This is
 * intentional — diagnostic narratives evolve as students answer more
 * questions, and a stale cached narrative is worse than a 3-second loader.
 */
export function StudentNarrativeDialog({
  studentId,
  studentName,
  open,
  onClose,
}: StudentNarrativeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StudentNarrativeResult | null>(null);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const analysis = await generateStudentNarrative(studentId);
        if (!cancelled) setResult(analysis);
      } catch {
        if (!cancelled) {
          setError("Couldn't generate a narrative right now. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [open, studentId]);

  async function handleRetry() {
    setError(null);
    setLoading(true);
    try {
      const analysis = await generateStudentNarrative(studentId);
      setResult(analysis);
    } catch {
      setError("Couldn't generate a narrative right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-150"
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-2xl",
            "translate-x-[-50%] translate-y-[-50%]",
            "bg-white rounded-xl border border-[#e4e4e7] shadow-lg",
            "p-6 max-h-[85vh] overflow-y-auto",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "transition-all duration-150"
          )}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <DialogPrimitive.Title className="text-[18px] font-semibold text-[#18181b]">
              Diagnostic Narrative for {studentName}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="text-[#71717a] hover:text-[#18181b] focus:outline-none"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {loading && <NarrativeSkeleton />}

          {error && !loading && (
            <div className="py-6">
              <p className="text-[14px] text-[#dc2626] mb-3">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="text-[13px] text-[#0d9488] hover:underline focus:outline-none"
              >
                Retry
              </button>
            </div>
          )}

          {result && !loading && !error && (
            <NarrativeBody result={result} />
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function NarrativeSkeleton() {
  return (
    <div className="space-y-3 py-2">
      <div className="h-4 bg-[#f4f4f5] rounded animate-pulse w-3/4" />
      <div className="h-4 bg-[#f4f4f5] rounded animate-pulse w-full" />
      <div className="h-4 bg-[#f4f4f5] rounded animate-pulse w-5/6" />
      <div className="h-4 bg-[#f4f4f5] rounded animate-pulse w-2/3" />
      <div className="pt-3">
        <div className="h-3 bg-[#f4f4f5] rounded animate-pulse w-1/3 mb-2" />
        <div className="h-3 bg-[#f4f4f5] rounded animate-pulse w-4/5" />
        <div className="h-3 bg-[#f4f4f5] rounded animate-pulse w-3/4 mt-1" />
      </div>
    </div>
  );
}

function NarrativeBody({ result }: { result: StudentNarrativeResult }) {
  return (
    <div className="space-y-4">
      {result.dominantThemes.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-[#0d9488] uppercase tracking-wide mb-1">
            Dominant themes
          </p>
          <div className="flex flex-wrap gap-2">
            {result.dominantThemes.map((theme) => (
              <span
                key={theme}
                className="text-[12px] text-[#18181b] bg-[#f4f4f5] border border-[#e4e4e7] px-2 py-1 rounded-md"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[12px] font-semibold text-[#0d9488] uppercase tracking-wide mb-1">
          Narrative
        </p>
        <p className="text-[14px] text-[#18181b] whitespace-pre-wrap leading-relaxed">
          {result.narrative}
        </p>
      </div>

      {result.supportingMisconceptions.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-[#0d9488] uppercase tracking-wide mb-1">
            Supporting misconceptions
          </p>
          <ul className="space-y-1 list-disc list-inside">
            {result.supportingMisconceptions.map((m) => (
              <li key={m.id} className="text-[13px] text-[#52525b]">
                {m.name}{" "}
                <span className="text-[11px] text-[#71717a]">({m.id})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
