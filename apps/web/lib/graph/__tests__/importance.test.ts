import { describe, it, expect } from "vitest";
import {
  computeNodeImportance,
  computeEdgeWeight,
  type NodeInput,
} from "../importance";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<NodeInput> = {}): NodeInput {
  return {
    id: "node-1",
    visitCount: 0,
    isBridge: false,
    degree: 0,
    betweenness: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeNodeImportance
// ---------------------------------------------------------------------------

describe("computeNodeImportance", () => {
  it("returns 0 when all inputs are zero", () => {
    const result = computeNodeImportance(makeNode(), 10, 10);
    expect(result).toBe(0);
  });

  it("applies bridge bonus (0.10 raw weight)", () => {
    const withBridge = computeNodeImportance(
      makeNode({ isBridge: true }),
      10,
      10,
    );
    const withoutBridge = computeNodeImportance(
      makeNode({ isBridge: false }),
      10,
      10,
    );
    // Bridge adds 0.10 to raw score; without bridge raw = 0 → importance = 0
    // With bridge raw = 0.10 → importance = 0.10^0.6
    expect(withBridge).toBeGreaterThan(withoutBridge);
    expect(withBridge).toBeCloseTo(Math.pow(0.10, 0.6), 6);
    expect(withoutBridge).toBe(0);
  });

  it("approaches 1 when all inputs are maxed", () => {
    const node = makeNode({
      degree: 10,
      betweenness: 1,
      visitCount: 20,
      isBridge: true,
    });
    const result = computeNodeImportance(node, 10, 20);
    // raw = 0.35*1 + 0.30*1 + 0.25*1 + 0.10*1 = 1.0
    // importance = 1.0^0.6 = 1.0
    expect(result).toBeCloseTo(1.0, 6);
  });

  it("computes correct power curve (raw 0.5 -> ~0.66)", () => {
    // To get raw = 0.5 exactly:
    //   0.35*(degree/maxDegree) + 0.30*betweenness + 0.25*(visit/maxVisit) + 0.10*bridge
    // Use: degree=1, maxDegree=1 (0.35), betweenness=0.5 (0.15), visit=0, bridge=0
    // raw = 0.35 + 0.15 + 0 + 0 = 0.5
    const node = makeNode({ degree: 1, betweenness: 0.5 });
    const result = computeNodeImportance(node, 1, 10);
    const expected = Math.pow(0.5, 0.6);
    expect(result).toBeCloseTo(expected, 6);
    // Verify the non-linearity: 0.5^0.6 ≈ 0.6598
    expect(result).toBeCloseTo(0.6598, 3);
  });

  it("handles division-by-zero safely (maxDegree=0, maxVisitCount=0)", () => {
    const node = makeNode({ degree: 5, visitCount: 10 });
    // With maxDegree=0 and maxVisitCount=0, should use || 1 fallback
    // normDegree = 5/1 = 5, normVisitCount = 10/1 = 10
    // raw = 0.35*5 + 0.30*0 + 0.25*10 + 0 = 1.75 + 2.5 = 4.25
    // importance = 4.25^0.6
    const result = computeNodeImportance(node, 0, 0);
    expect(result).toBeCloseTo(Math.pow(4.25, 0.6), 6);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("gives higher importance to nodes with more connections", () => {
    const lowDegree = computeNodeImportance(makeNode({ degree: 1 }), 10, 10);
    const highDegree = computeNodeImportance(makeNode({ degree: 10 }), 10, 10);
    expect(highDegree).toBeGreaterThan(lowDegree);
  });

  it("gives higher importance to nodes with more visits", () => {
    const lowVisit = computeNodeImportance(
      makeNode({ visitCount: 1 }),
      10,
      10,
    );
    const highVisit = computeNodeImportance(
      makeNode({ visitCount: 10 }),
      10,
      10,
    );
    expect(highVisit).toBeGreaterThan(lowVisit);
  });

  it("gives higher importance to nodes with higher betweenness", () => {
    const low = computeNodeImportance(makeNode({ betweenness: 0.1 }), 10, 10);
    const high = computeNodeImportance(makeNode({ betweenness: 0.9 }), 10, 10);
    expect(high).toBeGreaterThan(low);
  });

  it("verifies exact formula with known inputs", () => {
    // degree=4, maxDegree=8 → normDegree = 0.5
    // betweenness = 0.3
    // visitCount=6, maxVisitCount=12 → normVisitCount = 0.5
    // isBridge = false → bridgeBonus = 0
    // raw = 0.35*0.5 + 0.30*0.3 + 0.25*0.5 + 0.10*0
    //     = 0.175 + 0.09 + 0.125 + 0 = 0.39
    // importance = 0.39^0.6
    const node = makeNode({
      degree: 4,
      betweenness: 0.3,
      visitCount: 6,
    });
    const result = computeNodeImportance(node, 8, 12);
    expect(result).toBeCloseTo(Math.pow(0.39, 0.6), 6);
  });
});

// ---------------------------------------------------------------------------
// computeEdgeWeight
// ---------------------------------------------------------------------------

describe("computeEdgeWeight", () => {
  it("returns minimum 0.05 when all inputs are zero", () => {
    const result = computeEdgeWeight(0, 0, 0, "related");
    expect(result).toBe(0.05);
  });

  it("clamps to 0.05 for any edge type with zero co-occurrence and zero importance", () => {
    expect(computeEdgeWeight(0, 0, 0, "curiosity_link")).toBe(0.05);
    expect(computeEdgeWeight(0, 0, 0, "related")).toBe(0.05);
  });

  it("adds bridge bonus (typeBonus = 0.3 → 0.20 * (0.3/0.3) = 0.20)", () => {
    const bridge = computeEdgeWeight(0, 0, 0, "bridge");
    // weight = 0.30*0 + 0.50*0 + 0.20*(0.3/0.3) = 0.20
    expect(bridge).toBeCloseTo(0.20, 6);
  });

  it("adds misconception_cluster bonus (typeBonus = 0.15 → 0.20 * (0.15/0.3) = 0.10)", () => {
    const result = computeEdgeWeight(0, 0, 0, "misconception_cluster");
    // weight = 0 + 0 + 0.20*(0.15/0.3) = 0.10
    expect(result).toBeCloseTo(0.10, 6);
  });

  it("gives no type bonus for curiosity_link", () => {
    const result = computeEdgeWeight(0, 0, 0, "curiosity_link");
    // weight = 0 + 0 + 0.20*(0/0.3) = 0 → clamped to 0.05
    expect(result).toBe(0.05);
  });

  it("gives no type bonus for unknown edge types", () => {
    const result = computeEdgeWeight(0, 0, 0, "some_random_type");
    expect(result).toBe(0.05);
  });

  it("clamps to maximum 1 with high inputs", () => {
    // normCoOccurrence=1, sourceImportance=1, targetImportance=1, bridge
    // weight = 0.30*1 + 0.50*1 + 0.20*(0.3/0.3) = 0.30 + 0.50 + 0.20 = 1.0
    const result = computeEdgeWeight(1, 1, 1, "bridge");
    expect(result).toBe(1);
  });

  it("clamps to maximum 1 even when formula would exceed 1", () => {
    // normCoOccurrence=1, very high importance values, bridge
    const result = computeEdgeWeight(1, 2, 2, "bridge");
    // weight = 0.30*1 + 0.50*2 + 0.20*1 = 0.30 + 1.0 + 0.20 = 1.50 → clamped to 1
    expect(result).toBe(1);
  });

  it("computes endpoint average correctly", () => {
    // Only endpoint importance contribution, no co-occurrence, no type bonus
    // sourceImportance=0.6, targetImportance=0.4 → avg = 0.5
    // weight = 0 + 0.50*0.5 + 0 = 0.25
    const result = computeEdgeWeight(0, 0.6, 0.4, "related");
    expect(result).toBeCloseTo(0.25, 6);
  });

  it("verifies exact formula with known inputs", () => {
    // normCoOccurrence = 0.5
    // sourceImportance = 0.8, targetImportance = 0.4 → avg = 0.6
    // edgeType = "misconception_cluster" → typeBonus = 0.15
    //
    // weight = 0.30*0.5 + 0.50*0.6 + 0.20*(0.15/0.3)
    //        = 0.15 + 0.30 + 0.10
    //        = 0.55
    const result = computeEdgeWeight(0.5, 0.8, 0.4, "misconception_cluster");
    expect(result).toBeCloseTo(0.55, 6);
  });

  it("verifies formula with bridge type and partial inputs", () => {
    // normCoOccurrence = 0.3
    // sourceImportance = 0.5, targetImportance = 0.7 → avg = 0.6
    // edgeType = "bridge" → typeBonus = 0.3
    //
    // weight = 0.30*0.3 + 0.50*0.6 + 0.20*(0.3/0.3)
    //        = 0.09 + 0.30 + 0.20
    //        = 0.59
    const result = computeEdgeWeight(0.3, 0.5, 0.7, "bridge");
    expect(result).toBeCloseTo(0.59, 6);
  });

  it("handles symmetric importance correctly", () => {
    const a = computeEdgeWeight(0.5, 0.3, 0.7, "related");
    const b = computeEdgeWeight(0.5, 0.7, 0.3, "related");
    // Endpoint average is commutative: (0.3+0.7)/2 == (0.7+0.3)/2
    expect(a).toBeCloseTo(b, 10);
  });
});
