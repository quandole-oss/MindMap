"use client";

import { useState } from "react";

import type { ClassDashboardData } from "@/lib/dashboard-types";
import { OverviewTab } from "@/components/dashboard/overview-tab";
import { StudentsTab } from "@/components/dashboard/students-tab";
import { ConceptsTab } from "./concepts-tab";
import { MisconceptionsTab } from "./misconceptions-tab";

interface DashboardTabsProps {
  data: ClassDashboardData;
}

type TabId = "overview" | "concepts" | "misconceptions" | "students";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "concepts", label: "Concepts" },
  { id: "misconceptions", label: "Misconceptions" },
  { id: "students", label: "Students" },
];

export function DashboardTabs({ data }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div>
      {/* Tab bar — overflow-x-auto so tabs scroll horizontally at 375px */}
      <div className="flex gap-1 border-b border-[#e4e4e7] mb-6 overflow-x-auto flex-nowrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[14px] font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
              activeTab === tab.id
                ? "bg-[#18181b] text-white border-[#18181b]"
                : "text-[#52525b] hover:bg-[#e4e4e7] hover:text-[#18181b] border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab totals={data.totals} />}
      {activeTab === "concepts" && (
        <ConceptsTab heatmap={data.conceptHeatmap} />
      )}
      {activeTab === "misconceptions" && (
        <MisconceptionsTab
          clusters={data.misconceptionClusters}
          themeClusters={data.themeClusters}
          classId={data.classInfo.id}
        />
      )}
      {activeTab === "students" && <StudentsTab students={data.students} />}
    </div>
  );
}
