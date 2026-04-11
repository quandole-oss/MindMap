"use server";

import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  getThemeById,
  getMisconceptionsByTheme,
  loadLibrary,
} from "@mindmap/misconceptions";
import type {
  ThemeDetail,
  StudentThemeProfile,
} from "@/lib/dashboard-types";
import { buildStudentThemeProfile } from "@/lib/theme-aggregation";

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
