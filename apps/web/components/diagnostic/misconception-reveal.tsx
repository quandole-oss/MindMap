"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";

interface MisconceptionRevealProps {
  misconceptionName: string;
  resolved: boolean;
}

export function MisconceptionReveal({ misconceptionName, resolved }: MisconceptionRevealProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          {resolved ? (
            <CheckCircle2 className="size-6 text-emerald-500" />
          ) : (
            <AlertCircle className="size-6 text-amber-500" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[18px] font-semibold text-foreground">
            {resolved ? "Understanding Achieved" : "Keep Exploring"}
          </h3>

          <p className="text-[15px] leading-[1.6] text-foreground">
            You were exploring a topic connected to the{" "}
            <strong>{misconceptionName}</strong> misconception. Many curious
            minds have thought the same thing.
          </p>

          {resolved ? (
            <p className="text-[14px] text-muted-foreground">
              Your thinking has shifted — your knowledge graph node has turned
              teal.
            </p>
          ) : (
            <p className="text-[14px] text-muted-foreground">
              This is a tricky concept. Your node stays coral — revisit anytime
              to try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
