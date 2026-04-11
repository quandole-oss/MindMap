export interface StudentGraphData {
  nodes: Array<{
    id: string;
    name: string;
    domain: string;
    status: "unprobed" | "healthy" | "misconception";
    visitCount: number;
  }>;
  edges: Array<{ source: string; target: string }>;
}

export interface StudentSummary {
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  gradeLevel: number;
  lastQuestionDate: Date | null; // null = never asked
  streak: number; // consecutive days with a question
  totalQuestions: number;
  uniqueDomains: number; // distinct concept domains explored
  totalDomains: number; // total available domains across class
  breadthScore: number; // uniqueDomains / totalDomains (0-1)
  isInactive: boolean; // no question in 3+ days
  graph: StudentGraphData;
}

export interface ConceptHeatmapEntry {
  conceptName: string;
  domain: string;
  studentCount: number; // how many students have this concept
  totalVisits: number; // sum of visitCount across students
}

export interface MisconceptionCluster {
  misconceptionId: string;
  misconceptionName: string;
  totalAffected: number; // students who had this misconception
  resolvedCount: number; // students who resolved it
  unresolvedCount: number; // students still carrying it
  affectedStudentNames: string[]; // for drill-down
}

// ─── Theme types (Phase 8 — DASH-07 / THME-03) ────────────────────────────────

/**
 * Cluster summary of a single root theme on a class dashboard.
 * Computed at query time by projecting existing diagnostic_sessions rows
 * through the theme index — no denormalized theme column on sessions.
 */
export type ThemeCluster = {
  themeId: string;
  themeName: string;
  naiveTheory: string;
  studentsAffected: number;
  resolvedCount: number;
  unresolvedCount: number;
  constituentMisconceptionIds: string[];
};

/**
 * Drill-down detail for a single theme in a class context.
 * Returned by getThemeDetail(classId, themeId).
 */
export type ThemeDetail = {
  themeId: string;
  themeName: string;
  naiveTheory: string;
  description: string;
  citation: string;
  constituentMisconceptions: Array<{
    id: string;
    name: string;
    domain: string;
    studentsAffected: number;
    resolvedCount: number;
  }>;
  affectedStudents: Array<{
    studentId: string;
    studentName: string;
    misconceptionIds: string[];
  }>;
};

/**
 * PRIV-01 boundary: anonymized aggregate profile for a single student.
 * Returned by getStudentThemeProfile(studentId) and consumed by the
 * analyzeStudentThemes LLM prompt builder (Plan 08-03). Must contain
 * ONLY these four fields — no studentId, name, email, or session row.
 */
export type StudentThemeProfile = {
  gradeBand: "K-5" | "6-8" | "9-12";
  themeCounts: Record<string, number>; // themeId -> count
  misconceptionIds: string[]; // library IDs only
  sessionOutcomes: Array<"resolved" | "unresolved" | "incomplete">;
};

/**
 * Lesson plan shape (mirror of the Zod schema built in Plan 08-03).
 * Declared here so Plan 08-04's jsonb $type<T>() on theme_lesson_plans
 * can reference a single source of truth.
 */
export type LessonPlan = {
  theme: string;
  commonMisunderstanding: string;
  targetUnderstanding: string;
  suggestedActivities: Array<{
    title: string;
    description: string;
    referencedMisconceptionIds: string[];
  }>;
  discussionPrompts: string[];
  confrontationApproaches: string[];
};

export interface ClassDashboardData {
  classInfo: {
    id: string;
    name: string;
    joinCode: string;
    gradeLevel: number;
  };
  students: StudentSummary[];
  conceptHeatmap: ConceptHeatmapEntry[];
  misconceptionClusters: MisconceptionCluster[];
  themeClusters: ThemeCluster[];
  totals: {
    totalStudents: number;
    totalQuestions: number;
    activeMisconceptions: number;
    avgBreadthScore: number;
  };
}
