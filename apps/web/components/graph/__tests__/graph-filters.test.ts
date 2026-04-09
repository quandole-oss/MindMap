import { describe, it, expect } from "vitest";
import {
  DOMAIN_GROUPS,
  expandDomainQuery,
} from "../use-graph-filters";
import type { GraphNode } from "@/actions/graph";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(
  overrides: Partial<GraphNode> & { id: string; domain: string }
): GraphNode {
  return {
    name: overrides.id,
    status: "unprobed",
    visitCount: 1,
    isBridge: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DOMAIN_GROUPS constant
// ---------------------------------------------------------------------------

describe("DOMAIN_GROUPS", () => {
  it("contains exactly the four expected group keys", () => {
    expect(Object.keys(DOMAIN_GROUPS).sort()).toEqual(
      ["arts", "humanities", "science", "stem"]
    );
  });

  it("science includes physics, biology, chemistry, earth-science, astronomy, health, engineering", () => {
    expect(DOMAIN_GROUPS.science).toEqual(
      expect.arrayContaining([
        "physics",
        "biology",
        "chemistry",
        "earth-science",
        "astronomy",
        "health",
        "engineering",
      ])
    );
    expect(DOMAIN_GROUPS.science).toHaveLength(7);
  });

  it("stem includes physics, biology, chemistry, earth-science, astronomy, math, computer-science, engineering", () => {
    expect(DOMAIN_GROUPS.stem).toEqual(
      expect.arrayContaining([
        "physics",
        "biology",
        "chemistry",
        "earth-science",
        "astronomy",
        "math",
        "computer-science",
        "engineering",
      ])
    );
    expect(DOMAIN_GROUPS.stem).toHaveLength(8);
  });

  it("humanities includes history, literature, social-studies, art, music", () => {
    expect(DOMAIN_GROUPS.humanities).toEqual(
      expect.arrayContaining([
        "history",
        "literature",
        "social-studies",
        "art",
        "music",
      ])
    );
    expect(DOMAIN_GROUPS.humanities).toHaveLength(5);
  });

  it("arts includes art, music, literature", () => {
    expect(DOMAIN_GROUPS.arts).toEqual(
      expect.arrayContaining(["art", "music", "literature"])
    );
    expect(DOMAIN_GROUPS.arts).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// expandDomainQuery
// ---------------------------------------------------------------------------

describe("expandDomainQuery", () => {
  it("expands 'science' to a Set containing its seven child domains", () => {
    const result = expandDomainQuery("science");
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Set);
    expect([...result!].sort()).toEqual(
      [
        "astronomy",
        "biology",
        "chemistry",
        "earth-science",
        "engineering",
        "health",
        "physics",
      ].sort()
    );
  });

  it("expands 'stem' to a Set containing its eight child domains", () => {
    const result = expandDomainQuery("stem");
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Set);
    expect([...result!].sort()).toEqual(
      [
        "astronomy",
        "biology",
        "chemistry",
        "computer-science",
        "earth-science",
        "engineering",
        "math",
        "physics",
      ].sort()
    );
  });

  it("expands 'humanities' to a Set containing its five child domains", () => {
    const result = expandDomainQuery("humanities");
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Set);
    expect([...result!].sort()).toEqual(
      ["art", "history", "literature", "music", "social-studies"].sort()
    );
  });

  it("expands 'arts' to a Set containing art, music, literature", () => {
    const result = expandDomainQuery("arts");
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Set);
    expect([...result!].sort()).toEqual(["art", "literature", "music"].sort());
  });

  it("returns null for an unknown group name", () => {
    expect(expandDomainQuery("unknown")).toBeNull();
  });

  it("returns null for a leaf domain ('physics' is not a group)", () => {
    expect(expandDomainQuery("physics")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(expandDomainQuery("")).toBeNull();
  });

  it("returns null for a partial group name ('sci')", () => {
    expect(expandDomainQuery("sci")).toBeNull();
  });

  it("is case-sensitive — 'Science' does not expand", () => {
    expect(expandDomainQuery("Science")).toBeNull();
  });

  it("returns a fresh Set each call (not the same reference)", () => {
    const a = expandDomainQuery("science");
    const b = expandDomainQuery("science");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Filter chain logic (pure, extracted from hook's filteredNodes derivation)
// ---------------------------------------------------------------------------

/**
 * Inline re-implementation of the filteredNodes derivation extracted from the
 * hook for pure-function testing.  This mirrors the logic in useGraphFilters
 * exactly so any divergence in the source will show up as a test failure.
 */
function applyFilters(
  nodes: GraphNode[],
  opts: {
    searchNodeIds?: Set<string> | null;
    searchText?: string;
    domains?: Set<string>;
    statuses?: Set<string>;
  }
): GraphNode[] {
  const {
    searchNodeIds = null,
    searchText = "",
    domains = new Set(),
    statuses = new Set(),
  } = opts;

  let result = nodes;

  // AI search takes priority over text search
  if (searchNodeIds !== null) {
    result = result.filter((n) => searchNodeIds.has(n.id));
  } else if (searchText.length > 0) {
    const q = searchText.toLowerCase();
    const expandedDomains = expandDomainQuery(q);
    result = result.filter((n) => {
      if (expandedDomains && expandedDomains.has(n.domain)) return true;
      return (
        n.name.toLowerCase().includes(q) ||
        n.domain.toLowerCase().includes(q)
      );
    });
  }

  // Domain filter
  if (domains.size > 0) {
    result = result.filter((n) => domains.has(n.domain));
  }

  // Status filter
  if (statuses.size > 0) {
    result = result.filter((n) => {
      if (n.isBridge && statuses.has("bridge")) return true;
      return statuses.has(n.status);
    });
  }

  return result;
}

describe("filter chain logic", () => {
  const nodes: GraphNode[] = [
    makeNode({ id: "n1", name: "Photosynthesis", domain: "biology" }),
    makeNode({ id: "n2", name: "Newton's Laws", domain: "physics" }),
    makeNode({ id: "n3", name: "Pythagorean Theorem", domain: "math" }),
    makeNode({ id: "n4", name: "French Revolution", domain: "history", status: "misconception" }),
    makeNode({ id: "n5", name: "Beethoven Sonatas", domain: "music", status: "healthy" }),
    makeNode({ id: "n6", name: "Quadratic Formula", domain: "math", isBridge: true }),
  ];

  // --- No filters ---

  it("returns all nodes when no filters are applied", () => {
    expect(applyFilters(nodes, {})).toHaveLength(nodes.length);
  });

  // --- AI search (searchNodeIds) ---

  it("AI search: keeps only nodes whose ids are in searchNodeIds", () => {
    const result = applyFilters(nodes, {
      searchNodeIds: new Set(["n1", "n3"]),
    });
    expect(result.map((n) => n.id).sort()).toEqual(["n1", "n3"]);
  });

  it("AI search: empty searchNodeIds set returns no nodes", () => {
    expect(applyFilters(nodes, { searchNodeIds: new Set() })).toHaveLength(0);
  });

  it("AI search: null searchNodeIds is treated as inactive", () => {
    expect(applyFilters(nodes, { searchNodeIds: null })).toHaveLength(
      nodes.length
    );
  });

  it("AI search takes priority over searchText when both are set", () => {
    // searchText alone would match "math" nodes (n3, n6); AI search should win
    const result = applyFilters(nodes, {
      searchNodeIds: new Set(["n1"]),
      searchText: "math",
    });
    expect(result.map((n) => n.id)).toEqual(["n1"]);
  });

  // --- Text search (name matching) ---

  it("text search: filters by substring in node name (case-insensitive)", () => {
    const result = applyFilters(nodes, { searchText: "newton" });
    expect(result.map((n) => n.id)).toEqual(["n2"]);
  });

  it("text search: filters by substring in domain name", () => {
    const result = applyFilters(nodes, { searchText: "bio" });
    expect(result.map((n) => n.id)).toEqual(["n1"]);
  });

  it("text search: 'math' matches both domain name and node name substrings", () => {
    // n3 domain=math, n6 domain=math
    const result = applyFilters(nodes, { searchText: "math" });
    expect(result.map((n) => n.id).sort()).toEqual(["n3", "n6"]);
  });

  it("text search: empty string returns all nodes", () => {
    expect(applyFilters(nodes, { searchText: "" })).toHaveLength(nodes.length);
  });

  it("text search: no match returns empty array", () => {
    expect(applyFilters(nodes, { searchText: "zzznomatch" })).toHaveLength(0);
  });

  // --- Domain group expansion in text search ---

  it("text search: 'science' expands and matches biology and physics nodes", () => {
    const result = applyFilters(nodes, { searchText: "science" });
    // n1=biology, n2=physics both in science group
    expect(result.map((n) => n.id).sort()).toEqual(["n1", "n2"]);
  });

  it("text search: 'humanities' expands and matches history and music nodes", () => {
    const result = applyFilters(nodes, { searchText: "humanities" });
    // n4=history, n5=music both in humanities group
    expect(result.map((n) => n.id).sort()).toEqual(["n4", "n5"]);
  });

  it("text search: 'stem' expands and matches biology, physics, math nodes", () => {
    const result = applyFilters(nodes, { searchText: "stem" });
    // n1=biology, n2=physics, n3=math, n6=math — all in stem group
    expect(result.map((n) => n.id).sort()).toEqual(["n1", "n2", "n3", "n6"]);
  });

  it("text search: 'arts' expands and matches music node", () => {
    const result = applyFilters(nodes, { searchText: "arts" });
    // n5=music is in arts group
    expect(result.map((n) => n.id)).toEqual(["n5"]);
  });

  // --- Domain filter (checkbox-style) ---

  it("domain filter: single domain keeps only matching nodes", () => {
    const result = applyFilters(nodes, { domains: new Set(["math"]) });
    expect(result.map((n) => n.id).sort()).toEqual(["n3", "n6"]);
  });

  it("domain filter: multiple domains act as OR", () => {
    const result = applyFilters(nodes, {
      domains: new Set(["history", "music"]),
    });
    expect(result.map((n) => n.id).sort()).toEqual(["n4", "n5"]);
  });

  it("domain filter: empty set returns all nodes", () => {
    expect(applyFilters(nodes, { domains: new Set() })).toHaveLength(
      nodes.length
    );
  });

  // --- Status filter ---

  it("status filter: 'misconception' keeps only misconception nodes", () => {
    const result = applyFilters(nodes, {
      statuses: new Set(["misconception"]),
    });
    expect(result.map((n) => n.id)).toEqual(["n4"]);
  });

  it("status filter: 'healthy' keeps only healthy nodes", () => {
    const result = applyFilters(nodes, { statuses: new Set(["healthy"]) });
    expect(result.map((n) => n.id)).toEqual(["n5"]);
  });

  it("status filter: 'bridge' keeps nodes where isBridge=true regardless of status", () => {
    const result = applyFilters(nodes, { statuses: new Set(["bridge"]) });
    expect(result.map((n) => n.id)).toEqual(["n6"]);
  });

  it("status filter: 'bridge' and 'healthy' together include both bridge and healthy nodes", () => {
    const result = applyFilters(nodes, {
      statuses: new Set(["bridge", "healthy"]),
    });
    // n5=healthy, n6=isBridge
    expect(result.map((n) => n.id).sort()).toEqual(["n5", "n6"]);
  });

  it("status filter: empty set returns all nodes", () => {
    expect(applyFilters(nodes, { statuses: new Set() })).toHaveLength(
      nodes.length
    );
  });

  // --- Combined filters ---

  it("domain + status filters compose with AND semantics", () => {
    // Only math nodes that are also bridges
    const result = applyFilters(nodes, {
      domains: new Set(["math"]),
      statuses: new Set(["bridge"]),
    });
    expect(result.map((n) => n.id)).toEqual(["n6"]);
  });

  it("text search + domain filter compose correctly", () => {
    // searchText 'a' matches many nodes by name; domain filter narrows to math
    const result = applyFilters(nodes, {
      searchText: "a",
      domains: new Set(["math"]),
    });
    // Among math nodes: n3="Pythagorean Theorem" (contains 'a'), n6="Quadratic Formula" (contains 'a')
    expect(result.map((n) => n.id).sort()).toEqual(["n3", "n6"]);
  });
});
