import { notFound } from "next/navigation";

import { getClassDashboardData } from "@/actions/dashboard";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";

interface DashboardPageProps {
  params: Promise<{ classId: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { classId } = await params;
  const data = await getClassDashboardData(classId);

  if ("error" in data) {
    notFound();
  }

  return (
    <div className="pt-8 pb-8">
      <h1 className="text-[20px] font-semibold text-[#18181b] mb-6">
        {data.classInfo.name} — Dashboard
      </h1>
      <DashboardTabs data={data} />
    </div>
  );
}
