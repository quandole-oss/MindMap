import { describe, it, expect } from "vitest";
import {
  buildThemeClusters,
  type ThemeAggregatableSession,
} from "../../lib/theme-aggregation";
import type {
  MisconceptionEntry,
  Theme,
} from "@mindmap/misconceptions";

// ---------------------------------------------------------------------------
// buildThemeClusters — DASH-07 / THME-03
//
// Follows the existing test-isolation convention from
// apps/web/lib/graph/__tests__/clusters.test.ts: we import the pure helper
// only, never the "use server" dashboard action (which would pull in DB +
// auth and break Vitest's Node runtime).
//
// The dashboard.ts server action calls buildThemeClusters after its
// existing section-9 diagnosticSessions batch query; this test suite
// verifies the JS-side join / ranking contract without any DB round-trip.
// ---------------------------------------------------------------------------

// Minimal fixtures — just enough structure for the aggregator
const themes: Theme[] = [
  {
    id: "substance-based-reasoning",
    name: "Substance-based reasoning",
    naive_theory: "Abstract properties are treated as tangible stuff.",
    description:
      "Students reify abstract properties as material that can be contained, moved, or used up.",
    citation: "Chi (2005); Reiner et al. (2000)",
  },
  {
    id: "continuous-force-required-for-motion",
    name: "Continuous force required for motion",
    naive_theory: "Objects only move while a force is continuously applied.",
    description:
      "Pre-Newtonian impetus reasoning: motion requires sustained force.",
    citation: "Vosniadou (1994)",
  },
  {
    id: "whole-number-overgeneralization",
    name: "Whole-number overgeneralization",
    naive_theory: "Fractions and decimals follow whole-number intuitions.",
    description:
      "Students apply whole-number rules to rational numbers incorrectly.",
    citation: "Ni & Zhou (2005)",
  },
];

const library: MisconceptionEntry[] = [
  {
    id: "phys-001",
    name: "Heavier objects fall faster",
    domain: "physics",
    grade_band: "6-8",
    description: "Students believe mass determines fall speed in a vacuum.",
    citation: "Halloun & Hestenes (1985)",
    probe_questions: ["Which falls faster, a bowling ball or a feather?"],
    confrontation_scenarios: ["Galileo's Leaning Tower thought experiment"],
    themes: ["substance-based-reasoning"],
  },
  {
    id: "phys-002",
    name: "Heat is a substance",
    domain: "physics",
    grade_band: "6-8",
    description: "Heat is imagined as an invisible fluid.",
    citation: "Reiner et al. (2000)",
    probe_questions: ["Where does heat go?"],
    confrontation_scenarios: ["Rubbing hands together"],
    themes: ["substance-based-reasoning"],
  },
  {
    id: "phys-003",
    name: "No force, no motion",
    domain: "physics",
    grade_band: "6-8",
    description: "A moving object must be continuously pushed.",
    citation: "McCloskey (1983)",
    probe_questions: ["What keeps a puck sliding on ice?"],
    confrontation_scenarios: ["Frictionless surfaces"],
    themes: ["continuous-force-required-for-motion"],
  },
  {
    id: "math-001",
    name: "Longer decimal = larger",
    domain: "math",
    grade_band: "6-8",
    description: "0.125 > 0.5 because it has more digits.",
    citation: "Resnick et al. (1989)",
    probe_questions: ["Which is larger, 0.125 or 0.5?"],
    confrontation_scenarios: ["Number-line placement"],
    themes: ["whole-number-overgeneralization"],
  },
];

function session(
  userId: string,
  misconceptionId: string,
  outcome: ThemeAggregatableSession["outcome"]
): ThemeAggregatableSession {
  return { userId, misconceptionId, outcome };
}

describe("buildThemeClusters (DASH-07 / THME-03)", () => {
  it("returns empty array when there are no sessions", () => {
    expect(buildThemeClusters([], library, themes)).toEqual([]);
  });

  it("filters out themes with zero students affected (v1 behavior)", () => {
    // Only math-001 has sessions; substance-based + continuous-force themes
    // should NOT appear as empty cards.
    const sessions = [session("u1", "math-001", "resolved")];
    const clusters = buildThemeClusters(sessions, library, themes);
    expect(clusters.length).toBe(1);
    expect(clusters[0].themeId).toBe("whole-number-overgeneralization");
  });

  it("produces the expected ThemeCluster shape with all required fields", () => {
    const sessions = [session("u1", "phys-001", "resolved")];
    const [cluster] = buildThemeClusters(sessions, library, themes);
    expect(Object.keys(cluster).sort()).toEqual(
      [
        "constituentMisconceptionIds",
        "naiveTheory",
        "resolvedCount",
        "studentsAffected",
        "themeId",
        "themeName",
        "unresolvedCount",
      ].sort()
    );
    expect(cluster.themeId).toBe("substance-based-reasoning");
    expect(cluster.themeName).toBe("Substance-based reasoning");
    expect(cluster.naiveTheory).toContain("tangible");
    expect(cluster.studentsAffected).toBe(1);
    expect(cluster.resolvedCount).toBe(1);
    expect(cluster.unresolvedCount).toBe(0);
    expect(cluster.constituentMisconceptionIds).toEqual(["phys-001"]);
  });

  it("counts a student only once per theme even when they hold multiple constituent misconceptions", () => {
    // u1 has phys-001 AND phys-002 — both map to substance-based-reasoning.
    // studentsAffected must be 1, not 2.
    const sessions = [
      session("u1", "phys-001", "resolved"),
      session("u1", "phys-002", "unresolved"),
    ];
    const clusters = buildThemeClusters(sessions, library, themes);
    expect(clusters.length).toBe(1);
    expect(clusters[0].themeId).toBe("substance-based-reasoning");
    expect(clusters[0].studentsAffected).toBe(1);
    // If ANY session for that student in the theme is resolved, resolvedUserIds
    // gains the student — match the Set-based semantics from the RESEARCH
    // pattern (resolvedUserIds is a separate set, so unresolvedCount can be 0).
    expect(clusters[0].resolvedCount).toBe(1);
    expect(clusters[0].constituentMisconceptionIds.sort()).toEqual(
      ["phys-001", "phys-002"].sort()
    );
  });

  it("ranks clusters by studentsAffected DESC then unresolvedCount DESC", () => {
    // Theme A (substance): 3 students affected, 1 unresolved
    // Theme B (continuous-force): 2 students affected, 2 unresolved
    // Theme C (whole-number): 2 students affected, 0 unresolved
    const sessions = [
      // substance-based: u1, u2, u3 (u1 resolved, u2/u3 also resolved)
      session("u1", "phys-001", "resolved"),
      session("u2", "phys-002", "resolved"),
      session("u3", "phys-001", "unresolved"),
      // continuous-force: u4, u5 (both unresolved)
      session("u4", "phys-003", "unresolved"),
      session("u5", "phys-003", "unresolved"),
      // whole-number: u6, u7 (both resolved)
      session("u6", "math-001", "resolved"),
      session("u7", "math-001", "resolved"),
    ];
    const clusters = buildThemeClusters(sessions, library, themes);
    expect(clusters.length).toBe(3);
    // Primary sort: studentsAffected DESC → substance(3) first
    expect(clusters[0].themeId).toBe("substance-based-reasoning");
    expect(clusters[0].studentsAffected).toBe(3);
    // Secondary sort: unresolvedCount DESC → continuous-force(2 unresolved) > whole-number(0 unresolved)
    expect(clusters[1].themeId).toBe("continuous-force-required-for-motion");
    expect(clusters[1].studentsAffected).toBe(2);
    expect(clusters[1].unresolvedCount).toBe(2);
    expect(clusters[2].themeId).toBe("whole-number-overgeneralization");
    expect(clusters[2].studentsAffected).toBe(2);
    expect(clusters[2].unresolvedCount).toBe(0);
  });

  it("meets the seed-data sanity target: ≥3 clusters for a 20-student / 40-session fixture", () => {
    // Simulate 20 students × 2 sessions each across the 4 misconceptions.
    const userIds = Array.from({ length: 20 }, (_, i) => `u${i}`);
    const misIds = ["phys-001", "phys-002", "phys-003", "math-001"];
    const sessions: ThemeAggregatableSession[] = [];
    for (let i = 0; i < 20; i++) {
      sessions.push(
        session(userIds[i], misIds[i % 4], i % 3 === 0 ? "resolved" : "unresolved")
      );
      sessions.push(
        session(userIds[i], misIds[(i + 1) % 4], "unresolved")
      );
    }
    const clusters = buildThemeClusters(sessions, library, themes);
    expect(clusters.length).toBeGreaterThanOrEqual(3);
    // Top entry is the one with the most students affected.
    const top = clusters[0];
    const maxAffected = Math.max(...clusters.map((c) => c.studentsAffected));
    expect(top.studentsAffected).toBe(maxAffected);
  });

  it("gracefully skips sessions whose misconceptionId is not in the library", () => {
    const sessions = [
      session("u1", "phys-001", "resolved"),
      session("u2", "unknown-misc-999", "unresolved"),
    ];
    const clusters = buildThemeClusters(sessions, library, themes);
    // Only the known misconception produced a cluster.
    expect(clusters.length).toBe(1);
    expect(clusters[0].themeId).toBe("substance-based-reasoning");
    expect(clusters[0].studentsAffected).toBe(1);
  });
});
