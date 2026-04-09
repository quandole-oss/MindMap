import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getGraphData, getBridgeConnection } from "@/actions/graph";
import { GraphPageClient } from "./graph-page-client";

export default async function GraphPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Fetch graph data and bridge connection in parallel
  const [graphData, bridgeData] = await Promise.all([
    getGraphData(),
    getBridgeConnection(),
  ]);

  return (
    <div className="relative">
      {graphData.nodes.length === 0 ? (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center text-center bg-[#050510]"
          style={{ height: "calc(100vh - 56px)" }}
        >
          <h2 className="text-[20px] font-semibold text-white mb-2">
            Your knowledge universe is empty
          </h2>
          <p className="text-[16px] text-white/60 max-w-[400px]">
            Ask your first curiosity question to plant a star.
          </p>
        </div>
      ) : (
        <GraphPageClient
          nodes={graphData.nodes}
          edges={graphData.edges}
          bridgeData={bridgeData}
        />
      )}
    </div>
  );
}
