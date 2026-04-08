"use server";

import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { eq, and, inArray, or, desc } from "drizzle-orm";
import type {
  ClassDashboardData,
  StudentSummary,
  ConceptHeatmapEntry,
  MisconceptionCluster,
  StudentGraphData,
} from "@/lib/dashboard-types";

// ─── Streak Helper ────────────────────────────────────────────────────────────

/**
 * Calculate consecutive-day streak from a list of question creation timestamps.
 * Questions should be in descending order (most recent first).
 * Streak counts backward from today or yesterday (if today has no question yet).
 */
function calculateStreak(dates: (Date | null)[]): number {
  const validDates = dates
    .filter((d): d is Date => d !== null)
    .map((d) => {
      // Normalize to local midnight (date-only comparison)
      const normalized = new Date(d);
      normalized.setHours(0, 0, 0, 0);
      return normalized.getTime();
    });

  if (validDates.length === 0) return 0;

  // Deduplicate: one question per day counts as "active that day"
  const uniqueDays = [...new Set(validDates)].sort((a, b) => b - a);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const yesterdayMs = todayMs - 86400000;

  // Streak must start from today or yesterday (matches existing student streak logic)
  if (uniqueDays[0] !== todayMs && uniqueDays[0] !== yesterdayMs) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const diff = uniqueDays[i - 1] - uniqueDays[i];
    if (diff === 86400000) {
      // exactly one day apart
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Main Server Action ────────────────────────────────────────────────────────

export async function getClassDashboardData(
  classId: string
): Promise<ClassDashboardData | { error: string }> {
  // ── 1. Auth + class ownership check (T-05-01) ──────────────────────────────
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const teacherId = session.user.id;

  const targetClass = await db.query.classes.findFirst({
    where: and(
      eq(schema.classes.id, classId),
      eq(schema.classes.teacherId, teacherId)
    ),
  });
  if (!targetClass) return { error: "Not authorized" };

  // ── 2. Get enrolled students (T-05-02: only students in teacher's class) ───
  const enrollments = await db
    .select({
      studentId: schema.classEnrollments.studentId,
      gradeLevel: schema.classEnrollments.gradeLevel,
      studentName: schema.users.name,
      studentEmail: schema.users.email,
    })
    .from(schema.classEnrollments)
    .innerJoin(
      schema.users,
      eq(schema.classEnrollments.studentId, schema.users.id)
    )
    .where(eq(schema.classEnrollments.classId, classId));

  if (enrollments.length === 0) {
    return {
      classInfo: {
        id: targetClass.id,
        name: targetClass.name,
        joinCode: targetClass.joinCode,
        gradeLevel: targetClass.gradeLevel,
      },
      students: [],
      conceptHeatmap: [],
      misconceptionClusters: [],
      totals: {
        totalStudents: 0,
        totalQuestions: 0,
        activeMisconceptions: 0,
        avgBreadthScore: 0,
      },
    };
  }

  const studentIds = enrollments.map((e) => e.studentId);

  // Build a lookup map for student info
  const studentInfoMap = new Map(
    enrollments.map((e) => [
      e.studentId,
      {
        studentName: e.studentName,
        studentEmail: e.studentEmail,
        gradeLevel: e.gradeLevel,
      },
    ])
  );

  // ── 3. Batch fetch all concepts for all students (single query, not N+1) ───
  const allConcepts = await db
    .select({
      id: schema.concepts.id,
      userId: schema.concepts.userId,
      name: schema.concepts.name,
      domain: schema.concepts.domain,
      status: schema.concepts.status,
      visitCount: schema.concepts.visitCount,
    })
    .from(schema.concepts)
    .where(inArray(schema.concepts.userId, studentIds));

  // Partition concepts by userId
  const conceptsByStudent = new Map<
    string,
    Array<{
      id: string;
      userId: string;
      name: string;
      domain: string;
      status: string;
      visitCount: number;
    }>
  >();
  for (const sid of studentIds) {
    conceptsByStudent.set(sid, []);
  }
  for (const concept of allConcepts) {
    conceptsByStudent.get(concept.userId)?.push(concept);
  }

  // ── 4. Batch fetch all edges for all student concepts ─────────────────────
  const allConceptIds = allConcepts.map((c) => c.id);
  const allEdges =
    allConceptIds.length > 0
      ? await db
          .select({
            id: schema.conceptEdges.id,
            sourceConceptId: schema.conceptEdges.sourceConceptId,
            targetConceptId: schema.conceptEdges.targetConceptId,
          })
          .from(schema.conceptEdges)
          .where(
            or(
              inArray(schema.conceptEdges.sourceConceptId, allConceptIds),
              inArray(schema.conceptEdges.targetConceptId, allConceptIds)
            )
          )
      : [];

  // Build per-student concept ID set for edge partitioning
  const studentConceptIdSet = new Map<string, Set<string>>();
  for (const [sid, concepts] of conceptsByStudent) {
    studentConceptIdSet.set(sid, new Set(concepts.map((c) => c.id)));
  }

  // ── 5. Batch fetch all questions for all students ─────────────────────────
  const allQuestions = await db
    .select({
      userId: schema.questions.userId,
      createdAt: schema.questions.createdAt,
    })
    .from(schema.questions)
    .where(inArray(schema.questions.userId, studentIds))
    .orderBy(desc(schema.questions.createdAt));

  // Partition questions by userId
  const questionsByStudent = new Map<string, (Date | null)[]>();
  for (const sid of studentIds) {
    questionsByStudent.set(sid, []);
  }
  for (const q of allQuestions) {
    questionsByStudent.get(q.userId)?.push(q.createdAt);
  }

  // ── 6. Compute total unique domains across ALL students (for breadth score) ─
  const allDomainsAcrossClass = new Set(allConcepts.map((c) => c.domain));
  const totalDomains = allDomainsAcrossClass.size;

  // ── 7. Build per-student summaries ────────────────────────────────────────
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const students: StudentSummary[] = studentIds.map((sid) => {
    const info = studentInfoMap.get(sid)!;
    const studentConcepts = conceptsByStudent.get(sid) ?? [];
    const studentConceptIds = studentConceptIdSet.get(sid) ?? new Set();
    const questionDates = questionsByStudent.get(sid) ?? [];

    // Graph data: filter edges where both endpoints are in this student's concepts
    const studentEdges = allEdges.filter(
      (e) =>
        studentConceptIds.has(e.sourceConceptId) ||
        studentConceptIds.has(e.targetConceptId)
    );

    const graphData: StudentGraphData = {
      nodes: studentConcepts.map((c) => ({
        id: c.id,
        name: c.name,
        domain: c.domain,
        status: c.status as "unprobed" | "healthy" | "misconception",
        visitCount: c.visitCount,
      })),
      edges: studentEdges.map((e) => ({
        source: e.sourceConceptId,
        target: e.targetConceptId,
      })),
    };

    // Last question date (first element since sorted desc)
    const lastQuestionDate = questionDates.length > 0 ? questionDates[0] : null;

    // Streak
    const streak = calculateStreak(questionDates);

    // Total questions
    const totalQuestions = questionDates.length;

    // Breadth score
    const studentDomains = new Set(studentConcepts.map((c) => c.domain));
    const uniqueDomains = studentDomains.size;
    const breadthScore = totalDomains > 0 ? uniqueDomains / totalDomains : 0;

    // Inactivity
    const isInactive =
      lastQuestionDate === null ||
      now - lastQuestionDate.getTime() > THREE_DAYS_MS;

    return {
      studentId: sid,
      studentName: info.studentName,
      studentEmail: info.studentEmail,
      gradeLevel: info.gradeLevel,
      lastQuestionDate,
      streak,
      totalQuestions,
      uniqueDomains,
      totalDomains,
      breadthScore,
      isInactive,
      graph: graphData,
    };
  });

  // ── 8. Concept heatmap: aggregate across all students ─────────────────────
  // Group by lower-cased concept name; accumulate studentCount and totalVisits
  const heatmapMap = new Map<
    string,
    { conceptName: string; domain: string; studentCount: number; totalVisits: number }
  >();

  for (const concept of allConcepts) {
    const key = concept.name.toLowerCase();
    const existing = heatmapMap.get(key);
    if (existing) {
      existing.studentCount += 1;
      existing.totalVisits += concept.visitCount;
    } else {
      heatmapMap.set(key, {
        conceptName: concept.name,
        domain: concept.domain,
        studentCount: 1,
        totalVisits: concept.visitCount,
      });
    }
  }

  const conceptHeatmap: ConceptHeatmapEntry[] = [...heatmapMap.values()].sort(
    (a, b) => b.studentCount - a.studentCount
  );

  // ── 9. Misconception clusters ─────────────────────────────────────────────
  const allSessions =
    studentIds.length > 0
      ? await db
          .select({
            userId: schema.diagnosticSessions.userId,
            misconceptionId: schema.diagnosticSessions.misconceptionId,
            misconceptionName: schema.diagnosticSessions.misconceptionName,
            outcome: schema.diagnosticSessions.outcome,
          })
          .from(schema.diagnosticSessions)
          .where(inArray(schema.diagnosticSessions.userId, studentIds))
      : [];

  // Group by misconceptionId
  const clusterMap = new Map<
    string,
    {
      misconceptionName: string;
      affectedUserIds: Set<string>;
      resolvedUserIds: Set<string>;
    }
  >();

  for (const session of allSessions) {
    const existing = clusterMap.get(session.misconceptionId);
    if (existing) {
      existing.affectedUserIds.add(session.userId);
      if (session.outcome === "resolved") {
        existing.resolvedUserIds.add(session.userId);
      }
    } else {
      clusterMap.set(session.misconceptionId, {
        misconceptionName: session.misconceptionName,
        affectedUserIds: new Set([session.userId]),
        resolvedUserIds:
          session.outcome === "resolved" ? new Set([session.userId]) : new Set(),
      });
    }
  }

  // Build student name lookup
  const studentNameMap = new Map(
    enrollments.map((e) => [e.studentId, e.studentName ?? e.studentEmail ?? e.studentId])
  );

  const misconceptionClusters: MisconceptionCluster[] = [
    ...clusterMap.entries(),
  ].map(([misconceptionId, cluster]) => {
    const totalAffected = cluster.affectedUserIds.size;
    const resolvedCount = cluster.resolvedUserIds.size;
    const unresolvedCount = totalAffected - resolvedCount;
    const affectedStudentNames = [...cluster.affectedUserIds].map(
      (uid) => studentNameMap.get(uid) ?? uid
    );

    return {
      misconceptionId,
      misconceptionName: cluster.misconceptionName,
      totalAffected,
      resolvedCount,
      unresolvedCount,
      affectedStudentNames,
    };
  });

  // ── 10. Totals ─────────────────────────────────────────────────────────────
  const totalStudents = students.length;
  const totalQuestions = students.reduce((sum, s) => sum + s.totalQuestions, 0);
  const activeMisconceptions = misconceptionClusters.filter(
    (c) => c.unresolvedCount > 0
  ).length;
  const avgBreadthScore =
    totalStudents > 0
      ? students.reduce((sum, s) => sum + s.breadthScore, 0) / totalStudents
      : 0;

  return {
    classInfo: {
      id: targetClass.id,
      name: targetClass.name,
      joinCode: targetClass.joinCode,
      gradeLevel: targetClass.gradeLevel,
    },
    students,
    conceptHeatmap,
    misconceptionClusters,
    totals: {
      totalStudents,
      totalQuestions,
      activeMisconceptions,
      avgBreadthScore,
    },
  };
}
