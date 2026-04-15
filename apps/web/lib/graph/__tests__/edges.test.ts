import { describe, it, expect } from "vitest";
import { generateEdgePairs } from "../edges";
import type { EdgePair } from "../edges";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a deterministic UUID-v4-shaped string for realistic test data. */
function fakeUuid(n: number): string {
  const hex = n.toString(16).padStart(8, "0");
  return `${hex}-0000-4000-8000-000000000000`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateEdgePairs", () => {
  // ---- Empty / degenerate inputs ----

  it("returns no pairs for an empty array", () => {
    const result = generateEdgePairs([]);
    expect(result).toEqual([]);
  });

  it("returns no pairs for a single concept ID", () => {
    const result = generateEdgePairs(["abc"]);
    expect(result).toEqual([]);
  });

  // ---- Basic pair generation ----

  it("returns one pair for two concept IDs", () => {
    const result = generateEdgePairs(["a", "b"]);
    expect(result).toHaveLength(1);
  });

  it("returns three pairs for three concept IDs (n*(n-1)/2)", () => {
    const result = generateEdgePairs(["a", "b", "c"]);
    expect(result).toHaveLength(3);
  });

  it("returns six pairs for four concept IDs", () => {
    const result = generateEdgePairs(["a", "b", "c", "d"]);
    expect(result).toHaveLength(6);
  });

  it("returns ten pairs for five concept IDs", () => {
    const result = generateEdgePairs(["a", "b", "c", "d", "e"]);
    expect(result).toHaveLength(10);
  });

  // Generalized formula check
  it("produces exactly n*(n-1)/2 pairs for n IDs", () => {
    for (const n of [0, 1, 2, 3, 5, 8]) {
      const ids = Array.from({ length: n }, (_, i) => `id-${i}`);
      const pairs = generateEdgePairs(ids);
      expect(pairs).toHaveLength((n * (n - 1)) / 2);
    }
  });

  // ---- Lexicographic ordering ----

  it("orders the pair so source < target when IDs are already sorted", () => {
    const result = generateEdgePairs(["alpha", "beta"]);
    expect(result[0].sourceConceptId).toBe("alpha");
    expect(result[0].targetConceptId).toBe("beta");
  });

  it("orders the pair so source < target when IDs are reverse-sorted", () => {
    const result = generateEdgePairs(["beta", "alpha"]);
    expect(result[0].sourceConceptId).toBe("alpha");
    expect(result[0].targetConceptId).toBe("beta");
  });

  it("produces the same pairs regardless of input order", () => {
    const forward = generateEdgePairs(["a", "b", "c"]);
    const reversed = generateEdgePairs(["c", "b", "a"]);
    const shuffled = generateEdgePairs(["b", "c", "a"]);

    // Sort each result set to compare them order-independently
    const sortPairs = (pairs: EdgePair[]) =>
      [...pairs].sort((x, y) =>
        x.sourceConceptId.localeCompare(y.sourceConceptId) ||
        x.targetConceptId.localeCompare(y.targetConceptId)
      );

    expect(sortPairs(forward)).toEqual(sortPairs(reversed));
    expect(sortPairs(forward)).toEqual(sortPairs(shuffled));
  });

  it("always satisfies source < target for every generated pair", () => {
    const ids = ["z", "a", "m", "b", "y", "c"];
    const pairs = generateEdgePairs(ids);

    for (const pair of pairs) {
      expect(pair.sourceConceptId < pair.targetConceptId).toBe(true);
    }
  });

  // ---- No self-edges ----

  it("never generates a self-edge (source === target)", () => {
    const ids = ["a", "b", "c", "d"];
    const pairs = generateEdgePairs(ids);

    for (const pair of pairs) {
      expect(pair.sourceConceptId).not.toBe(pair.targetConceptId);
    }
  });

  // ---- No duplicate pairs ----

  it("generates no duplicate pairs", () => {
    const ids = ["x", "y", "z", "w"];
    const pairs = generateEdgePairs(ids);

    const keys = pairs.map(
      (p) => `${p.sourceConceptId}:${p.targetConceptId}:${p.edgeType}`
    );
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  // ---- Edge type ----

  it("defaults edgeType to 'curiosity_link'", () => {
    const pairs = generateEdgePairs(["a", "b"]);
    expect(pairs[0].edgeType).toBe("curiosity_link");
  });

  it("passes through a custom edgeType", () => {
    const pairs = generateEdgePairs(["a", "b"], "bridge");
    expect(pairs[0].edgeType).toBe("bridge");
  });

  it("applies the same edgeType to all generated pairs", () => {
    const pairs = generateEdgePairs(["a", "b", "c"], "misconception_cluster");
    for (const pair of pairs) {
      expect(pair.edgeType).toBe("misconception_cluster");
    }
  });

  // ---- Realistic UUID inputs ----

  it("handles UUID-shaped concept IDs correctly", () => {
    const id1 = fakeUuid(1);
    const id2 = fakeUuid(2);
    const id3 = fakeUuid(3);
    const pairs = generateEdgePairs([id1, id2, id3]);

    expect(pairs).toHaveLength(3);

    // Every pair should still satisfy lexicographic ordering
    for (const pair of pairs) {
      expect(pair.sourceConceptId < pair.targetConceptId).toBe(true);
    }

    // All three input IDs should appear across the pairs
    const allIds = new Set(
      pairs.flatMap((p) => [p.sourceConceptId, p.targetConceptId])
    );
    expect(allIds).toContain(id1);
    expect(allIds).toContain(id2);
    expect(allIds).toContain(id3);
  });

  it("correctly orders real-looking UUIDs that differ only in the first segment", () => {
    // UUIDs where lexicographic order matters: 0000... < ffff...
    const low = "00000001-0000-4000-8000-000000000000";
    const high = "ffffffff-0000-4000-8000-000000000000";
    const pairs = generateEdgePairs([high, low]);

    expect(pairs[0].sourceConceptId).toBe(low);
    expect(pairs[0].targetConceptId).toBe(high);
  });

  // ---- Return type shape ----

  it("returns objects with exactly sourceConceptId, targetConceptId, edgeType", () => {
    const pairs = generateEdgePairs(["a", "b"]);
    const pair = pairs[0];
    const keys = Object.keys(pair).sort();
    expect(keys).toEqual(["edgeType", "sourceConceptId", "targetConceptId"]);
  });

  // ---- Duplicate input IDs (edge case) ----

  it("treats duplicate input IDs as separate entries (caller responsibility to dedupe)", () => {
    // If the caller passes ["a", "a"], the algorithm produces a pair ("a", "a")
    // — which is a self-edge. This tests that the function does not crash;
    // deduplication is the caller's responsibility.
    const pairs = generateEdgePairs(["a", "a"]);
    expect(pairs).toHaveLength(1);
    // Both IDs are "a", so source === target (degenerate but doesn't crash)
    expect(pairs[0].sourceConceptId).toBe("a");
    expect(pairs[0].targetConceptId).toBe("a");
  });
});
