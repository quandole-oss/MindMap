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
  totals: {
    totalStudents: number;
    totalQuestions: number;
    activeMisconceptions: number;
    avgBreadthScore: number;
  };
}
