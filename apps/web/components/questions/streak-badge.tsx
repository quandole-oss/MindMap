"use client";

import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) return null;

  return (
    <div aria-label={`Current streak: ${streak} days`}>
      <Badge
        variant="secondary"
        className="h-7 gap-1.5 text-[14px] font-normal border-transparent"
      >
        <Flame className="size-3.5 text-[#f97316]" />
        {streak} day streak
      </Badge>
    </div>
  );
}
