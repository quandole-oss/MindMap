import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getGraphData } from "@/actions/graph";
import { HealthLegend } from "@/components/graph/health-legend";
import { GraphPageClient } from "./graph-page-client";

export default async function GraphPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const graphData = await getGraphData();

  return (
    <div className="pt-6 pb-8">
      <div className="mb-2">
        <h1 className="text-[20px] font-semibold text-[#18181b]">My Knowledge Graph</h1>
      </div>
      <div className="mb-4">
        <HealthLegend />
      </div>

      {graphData.nodes.length === 0 ? (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ height: "calc(100vh - 200px)" }}
        >
          <h2 className="text-[20px] font-semibold text-[#18181b] mb-2">
            Your graph is empty
          </h2>
          <p className="text-[16px] text-[#71717a] max-w-[400px]">
            Ask your first curiosity question from the dashboard to start building your knowledge map.
          </p>
        </div>
      ) : (
        <GraphPageClient nodes={graphData.nodes} edges={graphData.edges} />
      )}
    </div>
  );
}
