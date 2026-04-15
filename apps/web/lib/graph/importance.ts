// ---------------------------------------------------------------------------
// Pure computation helpers for graph node importance and edge weight.
// Extracted from the `getGraphData` server action (actions/graph.ts) so the
// formulas can be unit-tested without database or auth dependencies.
// ---------------------------------------------------------------------------

export interface NodeInput {
  id: string;
  visitCount: number;
  isBridge: boolean;
  degree: number;
  /** Betweenness centrality, already normalized to [0, 1]. */
  betweenness: number;
}

/**
 * Compute importance score for a single graph node.
 *
 * Formula:
 *   rawImportance = 0.35 * normDegree
 *                 + 0.30 * betweenness
 *                 + 0.25 * normVisitCount
 *                 + 0.10 * bridgeBonus
 *   importance = rawImportance ^ 0.6          (power curve)
 *
 * @param node       - Node metrics (betweenness already normalized 0-1)
 * @param maxDegree  - Maximum degree across all nodes (for normalization)
 * @param maxVisitCount - Maximum visitCount across all nodes
 * @returns importance in [0, 1]
 */
export function computeNodeImportance(
  node: NodeInput,
  maxDegree: number,
  maxVisitCount: number,
): number {
  const normDegree = node.degree / (maxDegree || 1);
  const normVisitCount = node.visitCount / (maxVisitCount || 1);
  const rawImportance =
    0.35 * normDegree +
    0.30 * node.betweenness +
    0.25 * normVisitCount +
    0.10 * (node.isBridge ? 1 : 0);
  return Math.pow(rawImportance, 0.6);
}

/**
 * Compute weight for a single graph edge.
 *
 * Formula:
 *   typeBonus = bridge ? 0.3 : misconception_cluster ? 0.15 : 0
 *   weight = 0.30 * normCoOccurrence
 *          + 0.50 * endpointImportanceAvg
 *          + 0.20 * (typeBonus / 0.3)
 *   clamped to [0.05, 1]
 *
 * @param normCoOccurrence   - Co-occurrence count normalized to [0, 1]
 * @param sourceImportance   - Importance of the source node
 * @param targetImportance   - Importance of the target node
 * @param edgeType           - Edge type string (e.g. "bridge", "misconception_cluster", "related")
 * @returns weight in [0.05, 1]
 */
export function computeEdgeWeight(
  normCoOccurrence: number,
  sourceImportance: number,
  targetImportance: number,
  edgeType: string,
): number {
  const typeBonus =
    edgeType === "bridge"
      ? 0.3
      : edgeType === "misconception_cluster"
        ? 0.15
        : 0;
  const endpointAvg = (sourceImportance + targetImportance) / 2;
  const weight =
    0.30 * normCoOccurrence + 0.50 * endpointAvg + 0.20 * (typeBonus / 0.3);
  return Math.max(Math.min(weight, 1), 0.05);
}
