import { describe, it, expect } from 'vitest'
import { computeClusters } from '../clusters'
import type { Cluster } from '../clusters'

// ---------------------------------------------------------------------------
// Local type mirrors — avoids importing the "use server" actions/graph module
// which pulls in DB/auth dependencies incompatible with Vitest's Node runtime.
// The shapes are identical to GraphNode / GraphEdge in actions/graph.ts.
// ---------------------------------------------------------------------------
interface GraphNode {
  id: string
  name: string
  domain: string
  status: 'unprobed' | 'healthy' | 'misconception'
  visitCount: number
  isBridge: boolean
}

interface GraphEdge {
  source: string
  target: string
  edgeType: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function node(
  id: string,
  name: string,
  visitCount = 1,
  overrides: Partial<GraphNode> = {}
): GraphNode {
  return {
    id,
    name,
    domain: 'science',
    status: 'unprobed',
    visitCount,
    isBridge: false,
    ...overrides,
  }
}

function edge(source: string, target: string, edgeType = 'related'): GraphEdge {
  return { source, target, edgeType }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeClusters', () => {
  // 1. Empty nodes → empty result
  it('returns empty array when nodes array is empty', () => {
    const result = computeClusters([], [])
    expect(result).toEqual([])
  })

  // Empty nodes with edges provided — still empty
  it('returns empty array when nodes array is empty even with edges', () => {
    const result = computeClusters([], [edge('a', 'b')])
    expect(result).toEqual([])
  })

  // 2. Single node (no edges) → no clusters (< 2 nodes per cluster)
  it('returns empty array for a single node with no edges', () => {
    const result = computeClusters([node('a', 'Gravity')], [])
    expect(result).toEqual([])
  })

  // Two isolated nodes (no edges) → each forms its own component of size 1 → filtered out
  it('returns empty array for two nodes that share no edges', () => {
    const result = computeClusters(
      [node('a', 'Gravity'), node('b', 'Photosynthesis')],
      []
    )
    expect(result).toEqual([])
  })

  // 3. Two connected nodes → one cluster with correct shape
  it('produces one cluster for two connected nodes', () => {
    const nodes = [node('a', 'Gravity', 5), node('b', 'Light', 3)]
    const edges = [edge('a', 'b')]

    const result = computeClusters(nodes, edges)

    expect(result).toHaveLength(1)
    const cluster = result[0]
    expect(cluster.count).toBe(2)
    expect(cluster.nodeIds).toEqual(new Set(['a', 'b']))
  })

  // Label for two connected nodes: both names joined with " & " (higher visitCount first)
  it('labels a two-node cluster with the names joined by " & " (highest visitCount first)', () => {
    const nodes = [node('a', 'Gravity', 5), node('b', 'Light', 3)]
    const edges = [edge('a', 'b')]

    const [cluster] = computeClusters(nodes, edges)

    expect(cluster.label).toBe('Gravity & Light')
  })

  // Label is sorted by visitCount descending — lower visitCount node appears second
  it('puts the node with the higher visitCount first in the label', () => {
    const nodes = [node('a', 'Alpha', 1), node('b', 'Beta', 10)]
    const edges = [edge('a', 'b')]

    const [cluster] = computeClusters(nodes, edges)

    expect(cluster.label).toBe('Beta & Alpha')
  })

  // 4. Two disconnected pairs → two separate clusters
  it('returns two clusters for two disconnected pairs', () => {
    const nodes = [
      node('a', 'Gravity', 4),
      node('b', 'Orbit', 2),
      node('c', 'Cell', 5),
      node('d', 'DNA', 3),
    ]
    const edges = [edge('a', 'b'), edge('c', 'd')]

    const result = computeClusters(nodes, edges)

    expect(result).toHaveLength(2)

    const labels = result.map((c: Cluster) => c.label)
    expect(labels).toContain('Gravity & Orbit')
    expect(labels).toContain('Cell & DNA')
  })

  // 4b. Disconnected pair + isolated node → only one cluster (size-1 component filtered)
  it('filters out isolated nodes when a connected pair is also present', () => {
    const nodes = [
      node('a', 'Gravity', 4),
      node('b', 'Orbit', 2),
      node('c', 'Loner', 9),
    ]
    const edges = [edge('a', 'b')]

    const result = computeClusters(nodes, edges)

    expect(result).toHaveLength(1)
    expect(result[0].nodeIds.has('c')).toBe(false)
  })

  // 5. Label generation: top 2 most-visited concepts joined with " & "
  it('uses the top 2 visitCount nodes for the label in a larger cluster', () => {
    const nodes = [
      node('a', 'Low', 1),
      node('b', 'Medium', 5),
      node('c', 'High', 10),
      node('d', 'VeryLow', 0),
    ]
    // All connected in a chain: a-b-c-d
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')]

    const [cluster] = computeClusters(nodes, edges)

    // Top 2 by visitCount are "High" (10) and "Medium" (5)
    expect(cluster.label).toBe('High & Medium')
    expect(cluster.count).toBe(4)
  })

  // 6. Label with a single "dominant" node — still joins top 2 if they exist
  //    But when there are exactly 2 nodes, both appear regardless
  it('joins exactly the top two names even when visitCounts are uneven', () => {
    const nodes = [node('x', 'Dominant', 100), node('y', 'Tiny', 1)]
    const edges = [edge('x', 'y')]

    const [cluster] = computeClusters(nodes, edges)

    expect(cluster.label).toBe('Dominant & Tiny')
  })

  // Single high-visitCount node in a three-node cluster still gives top 2 in label
  it('only puts top 2 names in label even in a three-node cluster', () => {
    const nodes = [
      node('a', 'Star', 50),
      node('b', 'Runner-up', 20),
      node('c', 'Tail', 1),
    ]
    const edges = [edge('a', 'b'), edge('b', 'c')]

    const [cluster] = computeClusters(nodes, edges)

    expect(cluster.label).toBe('Star & Runner-up')
  })

  // 7. Large connected component → single cluster with all node IDs
  it('returns one cluster containing all nodes for a fully connected graph', () => {
    const nodes = Array.from({ length: 10 }, (_, i) =>
      node(`n${i}`, `Concept${i}`, i + 1)
    )
    // Build a complete ring to connect all
    const edges = nodes.map((n, i) =>
      edge(n.id, nodes[(i + 1) % nodes.length].id)
    )

    const result = computeClusters(nodes, edges)

    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(10)
    const ids = result[0].nodeIds
    nodes.forEach((n) => expect(ids.has(n.id)).toBe(true))
  })

  // 8. Edge references non-existent node → handled gracefully (skipped, no crash)
  it('ignores edges that reference node IDs not in the nodes array', () => {
    const nodes = [node('a', 'Real', 5), node('b', 'Also Real', 3)]
    const edges = [
      edge('a', 'b'),           // valid
      edge('a', 'ghost'),       // target does not exist
      edge('phantom', 'b'),     // source does not exist
      edge('x', 'y'),           // neither exists
    ]

    // Should not throw; phantom edges are skipped
    expect(() => computeClusters(nodes, edges)).not.toThrow()

    const result = computeClusters(nodes, edges)
    expect(result).toHaveLength(1)
    expect(result[0].nodeIds).toEqual(new Set(['a', 'b']))
  })

  // 9. Cluster IDs are sequential starting from 0
  it('assigns sequential integer IDs starting at 0', () => {
    const nodes = [
      node('a', 'A', 1),
      node('b', 'B', 1),
      node('c', 'C', 1),
      node('d', 'D', 1),
    ]
    const edges = [edge('a', 'b'), edge('c', 'd')]

    const result = computeClusters(nodes, edges)

    expect(result).toHaveLength(2)
    const ids = result.map((c: Cluster) => c.id).sort((x, y) => x - y)
    expect(ids).toEqual([0, 1])
  })

  // IDs remain sequential even when nodes with no edges are mixed in (filtered components)
  it('keeps IDs sequential when isolated nodes are filtered out', () => {
    const nodes = [
      node('a', 'A', 1),
      node('b', 'B', 1),
      node('lone', 'Lone', 1), // will be filtered (size 1)
      node('c', 'C', 1),
      node('d', 'D', 1),
    ]
    const edges = [edge('a', 'b'), edge('c', 'd')]

    const result = computeClusters(nodes, edges)

    expect(result).toHaveLength(2)
    const ids = result.map((c: Cluster) => c.id).sort((x, y) => x - y)
    expect(ids).toEqual([0, 1])
  })

  // Cluster `count` field matches the number of node IDs in the cluster
  it('sets count equal to the number of nodes in the component', () => {
    const nodes = [node('a', 'A', 1), node('b', 'B', 2), node('c', 'C', 3)]
    const edges = [edge('a', 'b'), edge('b', 'c')]

    const [cluster] = computeClusters(nodes, edges)

    expect(cluster.count).toBe(3)
    expect(cluster.nodeIds.size).toBe(3)
  })
})
