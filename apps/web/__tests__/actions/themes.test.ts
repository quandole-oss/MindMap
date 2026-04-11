import { describe, it, expect } from "vitest";
import {
  buildStudentThemeProfile,
  gradeLevelToBand,
  type ThemeAggregatableSession,
} from "../../lib/theme-aggregation";
import {
  computeDataHash,
  sha256Hex,
} from "../../lib/theme-cache-hash";
import type { MisconceptionEntry } from "@mindmap/misconceptions";

// ---------------------------------------------------------------------------
// Tests for apps/web/actions/themes.ts — via the pure helper layer.
//
// Per the existing convention in apps/web/lib/graph/__tests__/clusters.test.ts
// we do NOT import the "use server" module directly (would pull DB + auth
// into Vitest's Node runtime). Auth + class-ownership enforcement in
// themes.ts::getThemeDetail / getStudentThemeProfile / getOrGenerateLessonPlan
// is copied VERBATIM from dashboard.ts:70–76 (which already ships) and is
// covered by integration coverage at the route layer.
//
// The critical boundary THIS test suite must enforce is PRIV-01 / D-13: the
// return value of buildStudentThemeProfile (which is what getStudentThemeProfile
// returns unchanged) contains EXACTLY the four anonymized fields — nothing
// more. Test 4 is the structural Object.keys guard that fails the build on
// any future addition of an identifier field.
//
// For Plan 08-04 (LSPL-02) we add unit tests for the pure cache-hash helpers
// — computeDataHash + sha256Hex — which are the deterministic core of
// getOrGenerateLessonPlan's cache key. The server action's cache hit / miss
// / regenerate row-count semantics are verified end-to-end in the Plan 08-04
// human-verify checkpoint (Task 3) since the test runtime cannot spin up
// Postgres.
// ---------------------------------------------------------------------------

const library: MisconceptionEntry[] = [
  {
    id: "phys-001",
    name: "Heavier objects fall faster",
    domain: "physics",
    grade_band: "6-8",
    description: "Students believe mass determines fall speed in a vacuum.",
    citation: "Halloun & Hestenes (1985)",
    probe_questions: ["Which falls faster?"],
    confrontation_scenarios: ["Galileo's tower"],
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
    probe_questions: ["What keeps a puck sliding?"],
    confrontation_scenarios: ["Frictionless surfaces"],
    themes: ["continuous-force-required-for-motion"],
  },
];

function session(
  userId: string,
  misconceptionId: string,
  outcome: ThemeAggregatableSession["outcome"]
): ThemeAggregatableSession {
  return { userId, misconceptionId, outcome };
}

describe("gradeLevelToBand", () => {
  it("maps K-5 (0-5) correctly", () => {
    expect(gradeLevelToBand(0)).toBe("K-5");
    expect(gradeLevelToBand(3)).toBe("K-5");
    expect(gradeLevelToBand(5)).toBe("K-5");
  });
  it("maps 6-8 correctly", () => {
    expect(gradeLevelToBand(6)).toBe("6-8");
    expect(gradeLevelToBand(8)).toBe("6-8");
  });
  it("maps 9-12 correctly", () => {
    expect(gradeLevelToBand(9)).toBe("9-12");
    expect(gradeLevelToBand(12)).toBe("9-12");
  });
});

describe("buildStudentThemeProfile (PRIV-01 / D-13)", () => {
  // Test 4 in the plan — THE PRIV-01 STRUCTURAL GUARD.
  it("returns ONLY the four anonymized keys {gradeBand, misconceptionIds, sessionOutcomes, themeCounts}", () => {
    const sessions = [
      session("lila-user-id", "phys-001", "resolved"),
      session("lila-user-id", "phys-002", "unresolved"),
    ];
    const result = buildStudentThemeProfile(sessions, 7, library);
    // Canonical PRIV-01 check — any future addition of studentId / userId /
    // name / email to the return literal will fail this assertion.
    expect(Object.keys(result).sort()).toEqual([
      "gradeBand",
      "misconceptionIds",
      "sessionOutcomes",
      "themeCounts",
    ]);
    // Double-check: no identifier fields sneaked in via type coercion.
    const asUnknown = result as unknown as Record<string, unknown>;
    expect(asUnknown.studentId).toBeUndefined();
    expect(asUnknown.userId).toBeUndefined();
    expect(asUnknown.name).toBeUndefined();
    expect(asUnknown.email).toBeUndefined();
  });

  it("does NOT leak the input userId anywhere in the serialized return value", () => {
    // Paranoia test: a downstream LLM call could stringify the object; make
    // sure the student's id does not appear in any field value either.
    const sessions = [
      session("super-secret-user-id-xyz", "phys-001", "resolved"),
      session("super-secret-user-id-xyz", "phys-003", "incomplete"),
    ];
    const result = buildStudentThemeProfile(sessions, 7, library);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("super-secret-user-id-xyz");
  });

  it("aggregates themeCounts correctly for 3 sessions across 2 misconceptions sharing a theme", () => {
    // phys-001 and phys-002 both live under "substance-based-reasoning".
    const sessions = [
      session("u1", "phys-001", "resolved"),
      session("u1", "phys-002", "unresolved"),
      session("u1", "phys-002", "incomplete"),
    ];
    const result = buildStudentThemeProfile(sessions, 7, library);
    // 3 sessions × 1 theme each = 3 counts under substance-based-reasoning
    expect(result.themeCounts["substance-based-reasoning"]).toBe(3);
    expect(
      result.themeCounts["continuous-force-required-for-motion"]
    ).toBeUndefined();
  });

  it("accumulates counts across multiple themes", () => {
    const sessions = [
      session("u1", "phys-001", "resolved"), // substance-based
      session("u1", "phys-003", "unresolved"), // continuous-force
      session("u1", "phys-003", "unresolved"), // continuous-force again
    ];
    const result = buildStudentThemeProfile(sessions, 10, library);
    expect(result.gradeBand).toBe("9-12");
    expect(result.themeCounts["substance-based-reasoning"]).toBe(1);
    expect(result.themeCounts["continuous-force-required-for-motion"]).toBe(2);
  });

  it("deduplicates misconceptionIds but keeps one outcome per session row", () => {
    const sessions = [
      session("u1", "phys-001", "resolved"),
      session("u1", "phys-001", "unresolved"),
      session("u1", "phys-002", "incomplete"),
    ];
    const result = buildStudentThemeProfile(sessions, 7, library);
    expect(result.misconceptionIds.sort()).toEqual(["phys-001", "phys-002"]);
    expect(result.sessionOutcomes).toEqual([
      "resolved",
      "unresolved",
      "incomplete",
    ]);
  });

  it("normalizes null outcome to 'incomplete'", () => {
    const sessions = [session("u1", "phys-001", null)];
    const result = buildStudentThemeProfile(sessions, 4, library);
    expect(result.gradeBand).toBe("K-5");
    expect(result.sessionOutcomes).toEqual(["incomplete"]);
  });

  it("returns empty aggregates when the student has no sessions", () => {
    const result = buildStudentThemeProfile([], 7, library);
    expect(result.gradeBand).toBe("6-8");
    expect(result.themeCounts).toEqual({});
    expect(result.misconceptionIds).toEqual([]);
    expect(result.sessionOutcomes).toEqual([]);
    // Structural guard holds even on empty input.
    expect(Object.keys(result).sort()).toEqual([
      "gradeBand",
      "misconceptionIds",
      "sessionOutcomes",
      "themeCounts",
    ]);
  });

  it("silently ignores sessions whose misconceptionId is not in the library (no theme contribution)", () => {
    const sessions = [
      session("u1", "phys-001", "resolved"),
      session("u1", "unknown-misc-999", "unresolved"),
    ];
    const result = buildStudentThemeProfile(sessions, 7, library);
    expect(result.themeCounts["substance-based-reasoning"]).toBe(1);
    // misconceptionIds still records the raw session (it's a library ID the
    // session claimed, even if we can't find it); the caller's session table
    // is the source of truth for "what the student was diagnosed with".
    expect(result.misconceptionIds).toContain("unknown-misc-999");
    // Both sessions contribute an outcome.
    expect(result.sessionOutcomes.length).toBe(2);
  });
});

// ─── Plan 08-04 — cache hash core for getOrGenerateLessonPlan (LSPL-02) ──────

describe("sha256Hex (Plan 08-04 / LSPL-02)", () => {
  it("produces a 64-character lowercase hex digest", async () => {
    const hash = await sha256Hex("hello");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic — same input yields same hash", async () => {
    const a = await sha256Hex("canonical-input");
    const b = await sha256Hex("canonical-input");
    expect(a).toBe(b);
  });

  it("is sensitive — different input yields different hash", async () => {
    const a = await sha256Hex("abc");
    const b = await sha256Hex("abd");
    expect(a).not.toBe(b);
  });

  it("matches the well-known SHA-256 digest for 'abc'", async () => {
    // RFC 6234 reference vector — if this fails, Web Crypto is wrong.
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("computeDataHash (Plan 08-04 / LSPL-02 / D-17)", () => {
  // Test 4 from the plan: deterministic — call twice with tuples in
  // different orders, get the same hash.
  it("is deterministic regardless of input order (sorts before hashing)", async () => {
    const tuplesA = [
      { misconceptionId: "phys-002", studentCount: 3, unresolvedCount: 1 },
      { misconceptionId: "phys-001", studentCount: 5, unresolvedCount: 2 },
      { misconceptionId: "phys-003", studentCount: 1, unresolvedCount: 1 },
    ];
    const tuplesB = [
      { misconceptionId: "phys-001", studentCount: 5, unresolvedCount: 2 },
      { misconceptionId: "phys-003", studentCount: 1, unresolvedCount: 1 },
      { misconceptionId: "phys-002", studentCount: 3, unresolvedCount: 1 },
    ];
    const hashA = await computeDataHash(tuplesA);
    const hashB = await computeDataHash(tuplesB);
    expect(hashA).toBe(hashB);
  });

  // Test 5 from the plan: sensitive to value changes — change studentCount
  // on one tuple, get a different hash (natural cache invalidation).
  it("changes when any studentCount changes", async () => {
    const base = [
      { misconceptionId: "phys-001", studentCount: 5, unresolvedCount: 2 },
      { misconceptionId: "phys-002", studentCount: 3, unresolvedCount: 1 },
    ];
    const mutated = [
      { misconceptionId: "phys-001", studentCount: 6, unresolvedCount: 2 },
      { misconceptionId: "phys-002", studentCount: 3, unresolvedCount: 1 },
    ];
    expect(await computeDataHash(base)).not.toBe(
      await computeDataHash(mutated)
    );
  });

  it("changes when any unresolvedCount changes", async () => {
    const base = [
      { misconceptionId: "phys-001", studentCount: 5, unresolvedCount: 2 },
    ];
    const mutated = [
      { misconceptionId: "phys-001", studentCount: 5, unresolvedCount: 3 },
    ];
    expect(await computeDataHash(base)).not.toBe(
      await computeDataHash(mutated)
    );
  });

  it("changes when a misconceptionId is added or removed", async () => {
    const small = [
      { misconceptionId: "phys-001", studentCount: 5, unresolvedCount: 2 },
    ];
    const large = [
      { misconceptionId: "phys-001", studentCount: 5, unresolvedCount: 2 },
      { misconceptionId: "phys-002", studentCount: 3, unresolvedCount: 1 },
    ];
    expect(await computeDataHash(small)).not.toBe(
      await computeDataHash(large)
    );
  });

  it("does not mutate the caller's tuple array", async () => {
    const tuples = [
      { misconceptionId: "phys-002", studentCount: 3, unresolvedCount: 1 },
      { misconceptionId: "phys-001", studentCount: 5, unresolvedCount: 2 },
    ];
    const snapshot = JSON.parse(JSON.stringify(tuples));
    await computeDataHash(tuples);
    expect(tuples).toEqual(snapshot);
  });

  it("handles an empty tuple array without throwing", async () => {
    const hash = await computeDataHash([]);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
