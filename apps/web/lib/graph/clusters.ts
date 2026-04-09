import type { GraphNode, GraphEdge } from "@/actions/graph";

export interface Cluster {
  id: number;
  label: string;
  nodeIds: Set<string>;
  count: number;
}

/**
 * Computes connected components via BFS on the edge list.
 * Returns clusters with >= 2 nodes, labeled by the top 2 most-visited concepts.
 *
 * This is the same algorithm used in solar-scene.tsx for nebula labels,
 * extracted here so filter state can use it without layout positions.
 */
export function computeClusters(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Cluster[] {
  if (nodes.length === 0) return [];

  const nodeIdx = new Map(nodes.map((n, i) => [n.id, i]));
  const adj: number[][] = nodes.map(() => []);

  for (const e of edges) {
    const si = nodeIdx.get(e.source);
    const ti = nodeIdx.get(e.target);
    if (si !== undefined && ti !== undefined) {
      adj[si].push(ti);
      adj[ti].push(si);
    }
  }

  const visited = new Uint8Array(nodes.length);
  const components: number[][] = [];

  for (let i = 0; i < nodes.length; i++) {
    if (visited[i]) continue;
    const comp: number[] = [];
    const queue = [i];
    visited[i] = 1;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const nb of adj[cur]) {
        if (!visited[nb]) {
          visited[nb] = 1;
          queue.push(nb);
        }
      }
    }
    components.push(comp);
  }

  let clusterId = 0;
  return components
    .filter((comp) => comp.length >= 2)
    .map((comp) => {
      const compNodes = comp.map((i) => nodes[i]);
      const sorted = [...compNodes].sort(
        (a, b) => b.visitCount - a.visitCount
      );
      const topNames = sorted.slice(0, 2).map((n) => n.name);
      const label = topNames.join(" & ");
      const nodeIds = new Set(compNodes.map((n) => n.id));

      return { id: clusterId++, label, nodeIds, count: comp.length };
    });
}
