/**
 * Pure theme aggregation helpers (Phase 8 — DASH-07 / THME-03).
 *
 * These functions are deliberately free of "use server", DB, and auth imports
 * so they can be unit-tested under Vitest's Node runtime (matching the existing
 * test-isolation pattern in apps/web/lib/graph/__tests__/clusters.test.ts).
 *
 * The server actions in apps/web/actions/{dashboard,themes}.ts import these
 * helpers after they have fetched session rows and resolved auth/ownership.
 *
 * Critical constraints enforced here:
 * - THME-03 / D-07: no new DB query; aggregation is a JS-side Map join over
 *   already-loaded session rows.
 * - PRIV-01 / D-13: buildStudentThemeProfile returns a fresh object literal
 *   containing ONLY {gradeBand, themeCounts, misconceptionIds, sessionOutcomes}
 *   — no studentId, userId, name, or email.
 */

import type {
  MisconceptionEntry,
  Theme,
} from "@mindmap/misconceptions";
import type {
  ThemeCluster,
  StudentThemeProfile,
} from "./dashboard-types";

// ─── Shared session row shape ─────────────────────────────────────────────────

/**
 * Minimal session shape used by the theme aggregators. Matches the columns
 * already selected by dashboard.ts's section 9 batch query — no new fields.
 */
export type ThemeAggregatableSession = {
  userId: string;
  misconceptionId: string;
  outcome: "resolved" | "unresolved" | "incomplete" | null;
};

// ─── Class-level theme clusters (DASH-07) ─────────────────────────────────────

/**
 * Projects an array of diagnostic sessions through the misconception library
 * and theme registry, producing a ranked ThemeCluster[] for a class dashboard.
 *
 * Ranking: studentsAffected DESC, then unresolvedCount DESC.
 * Empty themes (zero students affected) are filtered out per 08-RESEARCH.md
 * Open Question 3 for v1.
 */
export function buildThemeClusters(
  sessions: ReadonlyArray<ThemeAggregatableSession>,
  misconceptionLibrary: ReadonlyArray<MisconceptionEntry>,
  themes: ReadonlyArray<Theme>
): ThemeCluster[] {
  const themeByMiscId = new Map<string, string[]>();
  for (const m of misconceptionLibrary) {
    themeByMiscId.set(m.id, m.themes);
  }

  const themeClusterMap = new Map<
    string,
    {
      affectedUserIds: Set<string>;
      resolvedUserIds: Set<string>;
      constituentMisconceptionIds: Set<string>;
    }
  >();

  for (const session of sessions) {
    const miscThemes = themeByMiscId.get(session.misconceptionId) ?? [];
    for (const themeId of miscThemes) {
      const existing = themeClusterMap.get(themeId) ?? {
        affectedUserIds: new Set<string>(),
        resolvedUserIds: new Set<string>(),
        constituentMisconceptionIds: new Set<string>(),
      };
      existing.affectedUserIds.add(session.userId);
      existing.constituentMisconceptionIds.add(session.misconceptionId);
      if (session.outcome === "resolved") {
        existing.resolvedUserIds.add(session.userId);
      }
      themeClusterMap.set(themeId, existing);
    }
  }

  return [...themeClusterMap.entries()]
    .map(([themeId, v]) => {
      const theme = themes.find((t) => t.id === themeId);
      // If a misconception references an unknown theme, the CI orphan check
      // (packages/misconceptions THME-02) would already have failed the build.
      // Defensive fallback: skip unknown themes at runtime rather than throw.
      if (!theme) return null;
      return {
        themeId,
        themeName: theme.name,
        naiveTheory: theme.naive_theory,
        studentsAffected: v.affectedUserIds.size,
        unresolvedCount: v.affectedUserIds.size - v.resolvedUserIds.size,
        resolvedCount: v.resolvedUserIds.size,
        constituentMisconceptionIds: [...v.constituentMisconceptionIds],
      } as ThemeCluster;
    })
    .filter((c): c is ThemeCluster => c !== null && c.studentsAffected > 0)
    .sort(
      (a, b) =>
        b.studentsAffected - a.studentsAffected ||
        b.unresolvedCount - a.unresolvedCount
    );
}

// ─── Per-student anonymized profile (PRIV-01 / D-09 / D-13) ───────────────────

/**
 * Maps a numeric grade level (0=K, 1-12) to the coarse grade-band enum
 * consumed downstream by the LLM prompt builder.
 */
export function gradeLevelToBand(
  gradeLevel: number
): "K-5" | "6-8" | "9-12" {
  if (gradeLevel <= 5) return "K-5";
  if (gradeLevel <= 8) return "6-8";
  return "9-12";
}

/**
 * Builds the anonymized student theme profile that is passed to the
 * analyzeStudentThemes LLM prompt in Plan 08-03.
 *
 * CRITICAL (PRIV-01 / D-13): the return value is a fresh object literal with
 * EXACTLY four keys — {gradeBand, themeCounts, misconceptionIds,
 * sessionOutcomes}. Do NOT add studentId, userId, name, email, or spread a
 * raw session row into the return. Test 4 in themes.test.ts enforces this
 * structurally via Object.keys.
 */
export function buildStudentThemeProfile(
  sessions: ReadonlyArray<ThemeAggregatableSession>,
  gradeLevel: number,
  misconceptionLibrary: ReadonlyArray<MisconceptionEntry>
): StudentThemeProfile {
  const themeByMiscId = new Map<string, string[]>();
  for (const m of misconceptionLibrary) {
    themeByMiscId.set(m.id, m.themes);
  }

  const themeCounts: Record<string, number> = {};
  const misconceptionIdSet = new Set<string>();
  const sessionOutcomes: Array<"resolved" | "unresolved" | "incomplete"> = [];

  for (const session of sessions) {
    misconceptionIdSet.add(session.misconceptionId);
    const themeIds = themeByMiscId.get(session.misconceptionId) ?? [];
    for (const themeId of themeIds) {
      themeCounts[themeId] = (themeCounts[themeId] ?? 0) + 1;
    }
    // null outcome (session never completed) is normalized to "incomplete"
    sessionOutcomes.push(session.outcome ?? "incomplete");
  }

  // Fresh object literal — no spread of session rows. PRIV-01 boundary.
  return {
    gradeBand: gradeLevelToBand(gradeLevel),
    themeCounts,
    misconceptionIds: [...misconceptionIdSet],
    sessionOutcomes,
  };
}
