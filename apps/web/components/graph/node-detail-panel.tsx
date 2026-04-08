"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { getNodeDetails } from "@/actions/graph";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type ConceptStatus = "unprobed" | "healthy" | "misconception";

interface ConceptDetails {
  concept: { name: string; domain: string; status: string; visitCount: number };
  exchanges: Array<{ questionText: string; aiResponse: string | null; createdAt: Date | null }>;
}

interface NodeDetailPanelProps {
  conceptId: string | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  unprobed: "Not yet explored",
  healthy: "Understood",
  misconception: "Needs review",
};

const STATUS_COLORS: Record<string, string> = {
  unprobed: "#71717a",
  healthy: "#0d9488",
  misconception: "#dc2626",
};

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ExchangeEntry({
  exchange,
  isLast,
}: {
  exchange: { questionText: string; aiResponse: string | null; createdAt: Date | null };
  isLast: boolean;
}) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div>
      <p className="text-[16px] font-normal text-[#18181b] leading-[1.5]">
        {exchange.questionText}
      </p>
      <p className="text-[14px] text-[#71717a] mt-1">{formatDate(exchange.createdAt)}</p>

      {exchange.aiResponse && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowAnswer((v) => !v)}
            className="text-[14px] font-normal text-[#18181b] underline underline-offset-2 hover:text-[#52525b] transition-colors"
          >
            {showAnswer ? "Hide answer" : "See answer"}
          </button>

          {showAnswer && (
            <div className="mt-2 bg-[#f4f4f5] rounded-lg p-3">
              <p className="text-[14px] font-normal text-[#52525b] mb-1">
                MindMap&apos;s answer
              </p>
              <p className="text-[16px] font-normal text-[#18181b] leading-[1.5] whitespace-pre-wrap">
                {exchange.aiResponse}
              </p>
            </div>
          )}
        </div>
      )}

      {!isLast && <Separator className="mt-4" />}
    </div>
  );
}

export function NodeDetailPanel({ conceptId, open, onClose }: NodeDetailPanelProps) {
  const [details, setDetails] = useState<ConceptDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!conceptId) {
      setDetails(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getNodeDetails(conceptId)
      .then((data) => {
        if (!cancelled) {
          setDetails(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetails(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conceptId]);

  // Focus the heading when panel opens
  useEffect(() => {
    if (open && headingRef.current) {
      // Small delay to let the panel animation start
      const timer = setTimeout(() => {
        headingRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const status = (details?.concept.status ?? "unprobed") as ConceptStatus;
  const statusLabel = STATUS_LABELS[status] ?? "Not yet explored";
  const statusColor = STATUS_COLORS[status] ?? "#71717a";

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="p-0 flex flex-col"
        style={{ width: "360px", maxWidth: "100vw" }}
      >
        {/* Panel header */}
        <div
          className="flex items-start justify-between gap-3 border-b border-[#e4e4e7]"
          style={{
            backgroundColor: "#f4f4f5",
            padding: "24px",
          }}
        >
          <div className="flex flex-col gap-2 min-w-0">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-[20px] font-semibold text-[#18181b] leading-[1.2] truncate outline-none"
            >
              {loading ? "Loading…" : (details?.concept.name ?? "Concept")}
            </h2>
            {details && (
              <Badge
                className="w-fit text-white border-0"
                style={{ backgroundColor: statusColor }}
              >
                {statusLabel}
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close concept detail"
            className="flex items-center justify-center size-8 rounded-md hover:bg-[#e4e4e7] transition-colors shrink-0 mt-0.5"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "16px" }}>
          {loading && (
            <p className="text-[14px] text-[#71717a]">Loading concept details…</p>
          )}

          {!loading && details && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] font-normal text-[#71717a]">
                Questions that shaped this idea
              </p>

              {details.exchanges.length === 0 ? (
                <p className="text-[16px] text-[#71717a]">No exchanges recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {details.exchanges.map((exchange, index) => (
                    <ExchangeEntry
                      key={index}
                      exchange={exchange}
                      isLast={index === details.exchanges.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !details && conceptId && (
            <p className="text-[14px] text-[#71717a]">
              Could not load concept details. Please try again.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
