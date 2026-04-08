import { Users, MessageSquare, AlertCircle, Compass } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { ClassDashboardData } from "@/lib/dashboard-types";

interface OverviewTabProps {
  totals: ClassDashboardData["totals"];
}

export function OverviewTab({ totals }: OverviewTabProps) {
  const cards = [
    {
      label: "Students",
      value: totals.totalStudents,
      icon: Users,
      highlight: false,
    },
    {
      label: "Questions Asked",
      value: totals.totalQuestions,
      icon: MessageSquare,
      highlight: false,
    },
    {
      label: "Active Misconceptions",
      value: totals.activeMisconceptions,
      icon: AlertCircle,
      highlight: totals.activeMisconceptions > 0,
    },
    {
      label: "Avg. Breadth",
      value: `${Math.round(totals.avgBreadthScore * 100)}%`,
      icon: Compass,
      highlight: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {cards.map(({ label, value, icon: Icon, highlight }) => (
        <Card key={label} className="p-5">
          <div className="flex flex-col gap-2">
            <Icon
              className={`size-4 ${highlight ? "text-[#dc2626]" : "text-[#71717a]"}`}
            />
            <p
              className={`text-[20px] font-semibold ${highlight ? "text-[#dc2626]" : "text-[#18181b]"}`}
            >
              {value}
            </p>
            <p className="text-[12px] text-[#71717a]">{label}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
