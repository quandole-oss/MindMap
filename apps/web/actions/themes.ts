"use server";

import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  getThemeById,
  getMisconceptionsByTheme,
  loadLibrary,
} from "@mindmap/misconceptions";
import {
  generateLessonPlan,
  analyzeStudentThemes,
  type LessonPlan,
} from "@mindmap/llm";
import { getMisconceptionById } from "@mindmap/misconceptions";
import type {
  ThemeDetail,
  StudentThemeProfile,
} from "@/lib/dashboard-types";
import {
  buildStudentThemeProfile,
  gradeLevelToBand,
} from "@/lib/theme-aggregation";
import { computeDataHash } from "@/lib/theme-cache-hash";

// ─── getThemeDetail (DASH-07 drill-down / D-08) ───────────────────────────────

/**
 * Drill-down: theme metadata + constituent misconceptions + affected students
 * for a single class.
 *
 * Access control (T-08-05): caller must be the teacher who owns `classId`.
 * Pattern copied from dashboard.ts:70–76.
 */
export async function getThemeDetail(
  classId: string,
  themeId: string
): Promise<ThemeDetail> {
  // ── 1. Auth + class ownership check ─────────────────────────────────────
  if (!classId || !themeId) {
    throw new Error("classId and themeId are required");
  }

  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const teacherId = session.user.id;

  const targetClass = await db.query.classes.findFirst({
    where: and(
      eq(schema.classes.id, classId),
      eq(schema.classes.teacherId, teacherId)
    ),
  });
  if (!targetClass) throw new Error("Class not found or not owned");

  // ── 2. Look up theme metadata from the hand-authored registry ───────────
  const theme = getThemeById(themeId);
  if (!theme) throw new Error(`Theme not found: ${themeId}`);

  // ── 3. Library join — constituent misconceptions for this theme ─────────
  const constituents = getMisconceptionsByTheme(themeId);
  const constituentIds = constituents.map((m) => m.id);

  // ── 4. Load enrollments (for student name binding) + sessions ───────────
  const enrollments = await db
    .select({
      studentId: schema.classEnrollments.studentId,
      studentName: schema.users.name,
      studentEmail: schema.users.email,
    })
    .from(schema.classEnrollments)
    .innerJoin(
      schema.users,
      eq(schema.classEnrollments.studentId, schema.users.id)
    )
    .where(eq(schema.classEnrollments.classId, classId));

  if (enrollments.length === 0 || constituentIds.length === 0) {
    return {
      themeId,
      themeName: theme.name,
      naiveTheory: theme.naive_theory,
      description: theme.description,
      citation: theme.citation,
      constituentMisconceptions: constituents.map((m) => ({
        id: m.id,
        name: m.name,
        domain: m.domain,
        studentsAffected: 0,
        resolvedCount: 0,
      })),
      affectedStudents: [],
    };
  }

  const studentIds = enrollments.map((e) => e.studentId);

  const sessions = await db
    .select({
      userId: schema.diagnosticSessions.userId,
      misconceptionId: schema.diagnosticSessions.misconceptionId,
      outcome: schema.diagnosticSessions.outcome,
    })
    .from(schema.diagnosticSessions)
    .where(
      and(
        inArray(schema.diagnosticSessions.userId, studentIds),
        inArray(schema.diagnosticSessions.misconceptionId, constituentIds)
      )
    );

  // ── 5. Per-misconception stats (intersect sessions with constituent set) ─
  const perMiscStats = new Map<
    string,
    { affectedUserIds: Set<string>; resolvedUserIds: Set<string> }
  >();
  for (const m of constituents) {
    perMiscStats.set(m.id, {
      affectedUserIds: new Set<string>(),
      resolvedUserIds: new Set<string>(),
    });
  }
  for (const s of sessions) {
    const stat = perMiscStats.get(s.misconceptionId);
    if (!stat) continue;
    stat.affectedUserIds.add(s.userId);
    if (s.outcome === "resolved") stat.resolvedUserIds.add(s.userId);
  }

  const constituentMisconceptions = constituents.map((m) => {
    const stat = perMiscStats.get(m.id)!;
    return {
      id: m.id,
      name: m.name,
      domain: m.domain,
      studentsAffected: stat.affectedUserIds.size,
      resolvedCount: stat.resolvedUserIds.size,
    };
  });

  // ── 6. Affected students list (student name binding happens HERE, in the
  //       server action — never inside the prompt / LLM input path) ────────
  const studentNameMap = new Map(
    enrollments.map((e) => [
      e.studentId,
      e.studentName ?? e.studentEmail ?? e.studentId,
    ])
  );

  const studentMiscMap = new Map<string, Set<string>>();
  for (const s of sessions) {
    const existing = studentMiscMap.get(s.userId) ?? new Set<string>();
    existing.add(s.misconceptionId);
    studentMiscMap.set(s.userId, existing);
  }

  const affectedStudents = [...studentMiscMap.entries()].map(
    ([userId, miscIds]) => ({
      studentId: userId,
      studentName: studentNameMap.get(userId) ?? userId,
      misconceptionIds: [...miscIds],
    })
  );

  return {
    themeId,
    themeName: theme.name,
    naiveTheory: theme.naive_theory,
    description: theme.description,
    citation: theme.citation,
    constituentMisconceptions,
    affectedStudents,
  };
}

// ─── getStudentThemeProfile (D-09 / PRIV-01) ──────────────────────────────────

/**
 * Returns an ANONYMIZED aggregate profile of a single student's diagnostic
 * history, grouped by theme. This is the input shape the Plan 08-03
 * analyzeStudentThemes LLM prompt consumes.
 *
 * PRIV-01 / D-13 BOUNDARY (non-negotiable):
 *   The return value contains EXACTLY four keys — gradeBand, themeCounts,
 *   misconceptionIds, sessionOutcomes. No studentId, userId, name, email,
 *   or raw session rows. Test 4 in themes.test.ts enforces this with an
 *   Object.keys structural assertion that fails the build on any future
 *   accidental addition of an identifier field.
 *
 * Access control (T-08-05 / V4): the calling teacher must own a class that
 * contains this student.
 */
export async function getStudentThemeProfile(
  studentId: string
): Promise<StudentThemeProfile> {
  if (!studentId) throw new Error("studentId is required");

  // ── 1. Auth + teacher-owns-student-via-class check ───────────────────────
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const teacherId = session.user.id;

  const ownedEnrollments = await db
    .select({
      gradeLevel: schema.classEnrollments.gradeLevel,
    })
    .from(schema.classEnrollments)
    .innerJoin(
      schema.classes,
      eq(schema.classEnrollments.classId, schema.classes.id)
    )
    .where(
      and(
        eq(schema.classEnrollments.studentId, studentId),
        eq(schema.classes.teacherId, teacherId)
      )
    )
    .limit(1);

  if (ownedEnrollments.length === 0) {
    throw new Error("Student not found or not in your class");
  }
  const gradeLevel = ownedEnrollments[0].gradeLevel;

  // ── 2. Fetch this student's diagnostic sessions ─────────────────────────
  const sessions = await db
    .select({
      userId: schema.diagnosticSessions.userId,
      misconceptionId: schema.diagnosticSessions.misconceptionId,
      outcome: schema.diagnosticSessions.outcome,
    })
    .from(schema.diagnosticSessions)
    .where(eq(schema.diagnosticSessions.userId, studentId));

  // ── 3. Build anonymized profile — delegated to the pure helper so the
  //       PRIV-01 structural guarantee is covered by unit tests ───────────
  return buildStudentThemeProfile(sessions, gradeLevel, loadLibrary());
}

// ─── getOrGenerateLessonPlan (LSPL-02 / D-16 / D-17 / D-18) ───────────────────

/**
 * Computes the per-misconception fingerprint that feeds computeDataHash.
 *
 * Queries diagnostic_sessions for all enrolled students in the class, filters
 * to sessions whose misconceptionId is a constituent of the theme, and groups
 * by misconceptionId in JS. Returns tuples ordered by misconceptionId so the
 * server-side tuple order matches what computeDataHash canonicalizes.
 *
 * No new DB index is added — THME-03 / D-07 mandates "no new per-theme DB
 * query; aggregation is a JS-side join over already-loaded session rows".
 */
async function getThemeFingerprint(
  classId: string,
  themeId: string
): Promise<
  Array<{
    misconceptionId: string;
    studentCount: number;
    unresolvedCount: number;
  }>
> {
  const constituents = getMisconceptionsByTheme(themeId);
  const constituentIds = constituents.map((m) => m.id);
  if (constituentIds.length === 0) return [];

  // Enrolled students for the class
  const enrollments = await db
    .select({ studentId: schema.classEnrollments.studentId })
    .from(schema.classEnrollments)
    .where(eq(schema.classEnrollments.classId, classId));
  const studentIds = enrollments.map((e) => e.studentId);
  if (studentIds.length === 0) {
    // Still return a row per constituent so the fingerprint is stable
    // ("no students affected" is a meaningful cache key).
    return constituentIds
      .slice()
      .sort()
      .map((misconceptionId) => ({
        misconceptionId,
        studentCount: 0,
        unresolvedCount: 0,
      }));
  }

  const sessions = await db
    .select({
      userId: schema.diagnosticSessions.userId,
      misconceptionId: schema.diagnosticSessions.misconceptionId,
      outcome: schema.diagnosticSessions.outcome,
    })
    .from(schema.diagnosticSessions)
    .where(
      and(
        inArray(schema.diagnosticSessions.userId, studentIds),
        inArray(schema.diagnosticSessions.misconceptionId, constituentIds)
      )
    );

  // Group by misconceptionId in JS
  const perMisc = new Map<
    string,
    { studentUserIds: Set<string>; unresolvedUserIds: Set<string> }
  >();
  for (const id of constituentIds) {
    perMisc.set(id, {
      studentUserIds: new Set<string>(),
      unresolvedUserIds: new Set<string>(),
    });
  }
  for (const s of sessions) {
    const bucket = perMisc.get(s.misconceptionId);
    if (!bucket) continue;
    bucket.studentUserIds.add(s.userId);
    if (s.outcome !== "resolved") {
      bucket.unresolvedUserIds.add(s.userId);
    }
  }

  return [...perMisc.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([misconceptionId, counts]) => ({
      misconceptionId,
      studentCount: counts.studentUserIds.size,
      unresolvedCount: counts.unresolvedUserIds.size,
    }));
}

/**
 * Lesson-plan cache with optional force-regenerate.
 *
 * Cache semantics (D-16 / D-17 / D-18):
 *   1. Auth + class-ownership check (T-08-15).
 *   2. Compute a deterministic dataHash from the current per-misconception
 *      counts for this theme in this class.
 *   3. On cache hit (same class, same theme, same hash), return the stored
 *      LessonPlan row unchanged.
 *   4. On cache miss or `forceRegenerate`, call @mindmap/llm generateLessonPlan
 *      and INSERT a NEW row — never UPDATE. Previous rows stay in the table
 *      as an audit trail of what a teacher saw historically.
 *
 * PRIV-01 (T-08-17 / D-13): the LLM call receives only four anonymized
 * fields — theme library metadata, an aggregate student count, a coarse
 * grade band, and constituent misconception library entries. No userId,
 * studentId, email, name, or enrollment row ever crosses this boundary.
 */
export async function getOrGenerateLessonPlan(
  classId: string,
  themeId: string,
  opts: { forceRegenerate?: boolean } = {}
): Promise<LessonPlan> {
  if (!classId || !themeId) {
    throw new Error("classId and themeId are required");
  }

  // ── 1. Auth + class ownership check (T-08-15) ───────────────────────────
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const teacherId = session.user.id;

  const cls = await db.query.classes.findFirst({
    where: and(
      eq(schema.classes.id, classId),
      eq(schema.classes.teacherId, teacherId)
    ),
  });
  if (!cls) throw new Error("Class not found or not owned");

  // ── 2. Resolve theme library metadata ───────────────────────────────────
  const theme = getThemeById(themeId);
  if (!theme) throw new Error(`Theme not found: ${themeId}`);
  const constituents = getMisconceptionsByTheme(themeId);

  // ── 3. Fingerprint + dataHash (T-08-16: server-side, never client) ──────
  const tuples = await getThemeFingerprint(classId, themeId);
  const dataHash = await computeDataHash(tuples);

  // ── 4. Cache lookup unless forced ───────────────────────────────────────
  if (!opts.forceRegenerate) {
    const cached = await db.query.themeLessonPlans.findFirst({
      where: and(
        eq(schema.themeLessonPlans.classId, classId),
        eq(schema.themeLessonPlans.themeId, themeId),
        eq(schema.themeLessonPlans.dataHash, dataHash)
      ),
    });
    if (cached) return cached.lessonPlan as LessonPlan;
  }

  // ── 5. Cache miss (or forced) — anonymized LLM call (PRIV-01) ───────────
  const studentsAffected = tuples.reduce((sum, t) => sum + t.studentCount, 0);
  const gradeBand = gradeLevelToBand(cls.gradeLevel);
  const fresh = await generateLessonPlan({
    theme: {
      id: theme.id,
      name: theme.name,
      naive_theory: theme.naive_theory,
      description: theme.description,
      citation: theme.citation,
    },
    studentsAffected,
    gradeBand,
    constituentMisconceptions: constituents.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      confrontation_scenarios: c.confrontation_scenarios,
    })),
  });

  // ── 6. Insert NEW row (D-18: never UPDATE — preserves history) ──────────
  await db.insert(schema.themeLessonPlans).values({
    classId,
    themeId,
    dataHash,
    lessonPlan: fresh,
  });

  return fresh;
}

// ─── generateStudentNarrative (DASH-08 / D-13 / D-19) ─────────────────────────

export type StudentNarrativeResult = {
  dominantThemes: string[];
  narrative: string;
  supportingMisconceptions: Array<{ id: string; name: string }>;
};

/**
 * Thin server-action wrapper around analyzeStudentThemes so the LLM SDK
 * AND the YAML library loader stay out of the client bundle.
 *
 * Returns a client-safe projection of the analysis result: dominantThemes
 * and narrative UNMODIFIED, plus supportingMisconceptionIds dereferenced
 * through the YAML library into {id, name} pairs so the dialog component
 * does not need to import @mindmap/misconceptions (which pulls node:fs).
 *
 * Per D-19 the result is NOT cached. Every open regenerates.
 *
 * `studentName` is intentionally NOT a parameter — the LLM is never given
 * a way to reference the student by name. The component layer binds the
 * name into the dialog title after this function returns.
 */
export async function generateStudentNarrative(
  studentId: string
): Promise<StudentNarrativeResult> {
  // getStudentThemeProfile performs the auth + ownership check and returns
  // the PRIV-01 clean four-field profile shape.
  const profile = await getStudentThemeProfile(studentId);
  const analysis = await analyzeStudentThemes(profile);
  const supportingMisconceptions = analysis.supportingMisconceptionIds.map(
    (id) => {
      const entry = getMisconceptionById(id);
      return { id, name: entry?.name ?? id };
    }
  );
  return {
    dominantThemes: analysis.dominantThemes,
    narrative: analysis.narrative,
    supportingMisconceptions,
  };
}
