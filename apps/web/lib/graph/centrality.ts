/**
 * Betweenness centrality computation using Brandes' BFS algorithm.
 *
 * Brandes, U. (2001). A Faster Algorithm for Betweenness Centrality.
 * Journal of Mathematical Sociology, 25(2), 163–177.
 *
 * Complexity: O(V * E) for unweighted undirected graphs.
 * Suitable for per-student concept graphs (<500 nodes) run server-side.
 */

/**
 * Compute betweenness centrality for all nodes in an unweighted, undirected graph.
 *
 * Returns a Map from node ID → centrality score.
 * Scores are divided by 2 to correct for undirected double-counting.
 */
export function computeBetweennessCentrality(
  nodeIds: string[],
  edges: Array<{ source: string; target: string }>
): Map<string, number> {
  // Build adjacency list (undirected: both directions)
  const adj = new Map<string, string[]>();
  for (const nodeId of nodeIds) {
    adj.set(nodeId, []);
  }
  for (const edge of edges) {
    const srcNeighbors = adj.get(edge.source);
    const tgtNeighbors = adj.get(edge.target);
    if (srcNeighbors) srcNeighbors.push(edge.target);
    if (tgtNeighbors) tgtNeighbors.push(edge.source);
  }

  // Initialize centrality scores to 0
  const centrality = new Map<string, number>();
  for (const nodeId of nodeIds) {
    centrality.set(nodeId, 0);
  }

  // Brandes' algorithm: BFS from each source node
  for (const s of nodeIds) {
    // Stack of nodes in order of non-decreasing distance from s
    const stack: string[] = [];
    // Predecessors on shortest paths from s
    const pred = new Map<string, string[]>();
    for (const v of nodeIds) {
      pred.set(v, []);
    }
    // Number of shortest paths from s to each node
    const sigma = new Map<string, number>();
    for (const v of nodeIds) {
      sigma.set(v, 0);
    }
    sigma.set(s, 1);

    // Distance from s to each node (-1 = unvisited)
    const dist = new Map<string, number>();
    for (const v of nodeIds) {
      dist.set(v, -1);
    }
    dist.set(s, 0);

    // BFS queue
    const queue: string[] = [s];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);

      const neighbors = adj.get(v) ?? [];
      for (const w of neighbors) {
        // First time visiting w?
        if (dist.get(w) === -1) {
          queue.push(w);
          dist.set(w, (dist.get(v) ?? 0) + 1);
        }
        // Shortest path to w via v?
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          pred.get(w)!.push(v);
        }
      }
    }

    // Back-propagation: accumulate dependency (delta)
    const delta = new Map<string, number>();
    for (const v of nodeIds) {
      delta.set(v, 0);
    }

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w) ?? []) {
        const sigmaV = sigma.get(v) ?? 0;
        const sigmaW = sigma.get(w) ?? 0;
        const deltaW = delta.get(w) ?? 0;
        const deltaV = delta.get(v) ?? 0;
        delta.set(v, deltaV + (sigmaV / sigmaW) * (1 + deltaW));
      }
      if (w !== s) {
        centrality.set(w, (centrality.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  // Divide by 2 for undirected graphs (each path counted twice)
  for (const [nodeId, score] of centrality) {
    centrality.set(nodeId, score / 2);
  }

  return centrality;
}

/**
 * Find the top bridge node: the highest-centrality node that connects
 * at least two different subject domains.
 *
 * Returns the bridge node ID and the two most prominent connected domain names,
 * or null if no meaningful cross-domain bridge exists.
 */
export function findTopBridgeNode(
  nodes: Array<{ id: string; domain: string }>,
  edges: Array<{ source: string; target: string }>
): { nodeId: string; connectedDomains: [string, string] } | null {
  // Need at least 3 nodes and 2 edges for a meaningful bridge
  if (nodes.length < 3 || edges.length < 2) {
    return null;
  }

  const nodeIds = nodes.map((n) => n.id);
  const domainById = new Map<string, string>();
  for (const node of nodes) {
    domainById.set(node.id, node.domain);
  }

  const centrality = computeBetweennessCentrality(nodeIds, edges);

  // Build adjacency list to find each node's neighbor domains
  const adj = new Map<string, string[]>();
  for (const nodeId of nodeIds) {
    adj.set(nodeId, []);
  }
  for (const edge of edges) {
    const srcNeighbors = adj.get(edge.source);
    const tgtNeighbors = adj.get(edge.target);
    if (srcNeighbors) srcNeighbors.push(edge.target);
    if (tgtNeighbors) tgtNeighbors.push(edge.source);
  }

  // Find the best cross-domain bridge node
  let bestNodeId: string | null = null;
  let bestScore = -1;
  let bestDomains: [string, string] | null = null;

  for (const node of nodes) {
    const score = centrality.get(node.id) ?? 0;
    if (score <= bestScore) continue;

    // Collect neighbor domains (exclude the node's own domain for bridge logic)
    const neighbors = adj.get(node.id) ?? [];
    const neighborDomains = new Map<string, number>(); // domain → count
    for (const neighborId of neighbors) {
      const neighborDomain = domainById.get(neighborId);
      if (neighborDomain) {
        neighborDomains.set(neighborDomain, (neighborDomains.get(neighborDomain) ?? 0) + 1);
      }
    }

    // A bridge node connects at least 2 different domains via its neighbors
    const uniqueDomains = Array.from(neighborDomains.keys());
    if (uniqueDomains.length < 2) continue;

    // Pick the two most common domains as the "connected" pair
    const sortedDomains = uniqueDomains.sort(
      (a, b) => (neighborDomains.get(b) ?? 0) - (neighborDomains.get(a) ?? 0)
    );
    const domainA = sortedDomains[0];
    const domainB = sortedDomains[1];

    bestScore = score;
    bestNodeId = node.id;
    bestDomains = [domainA, domainB];
  }

  if (!bestNodeId || !bestDomains) {
    return null;
  }

  return { nodeId: bestNodeId, connectedDomains: bestDomains };
}
