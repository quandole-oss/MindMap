"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";

import { MiniGraphSvg } from "@/components/graph/mini-graph-svg";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StudentSummary } from "@/lib/dashboard-types";
import { StudentNarrativeDialog } from "./student-narrative-dialog";

interface StudentsTabProps {
  students: StudentSummary[];
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function StudentsTab({ students }: StudentsTabProps) {
  const [narrativeStudent, setNarrativeStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);

  if (students.length === 0) {
    return (
      <div className="bg-[#f4f4f5] rounded-xl p-6 mt-6">
        <p className="text-[16px] font-semibold text-[#18181b]">No students enrolled yet</p>
        <p className="text-[14px] text-[#71717a] mt-1">
          Share your class join code to invite students.
        </p>
      </div>
    );
  }

  // Sort: inactive first, then by last question date descending
  const sorted = [...students].sort((a, b) => {
    if (a.isInactive && !b.isInactive) return -1;
    if (!a.isInactive && b.isInactive) return 1;
    const aTime = a.lastQuestionDate?.getTime() ?? 0;
    const bTime = b.lastQuestionDate?.getTime() ?? 0;
    return bTime - aTime;
  });

  return (
    <>
      <div className="mt-6 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Graph</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead>Streak</TableHead>
              <TableHead>Breadth</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead className="w-[160px]">Diagnostic Narrative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((student) => {
              const name =
                student.studentName ?? student.studentEmail ?? "Unknown";
              const relativeTime = formatRelativeTime(student.lastQuestionDate);
              const breadthPct = Math.round(student.breadthScore * 100);

              return (
                <TableRow key={student.studentId}>
                  <TableCell>
                    <MiniGraphSvg
                      nodes={student.graph.nodes}
                      edges={student.graph.edges}
                      width={80}
                      height={60}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-[14px] font-medium text-[#18181b]">
                      {name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-[#52525b]">
                        {relativeTime}
                      </span>
                      {student.isInactive && (
                        <Badge
                          className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]"
                          variant="outline"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[14px] text-[#52525b]">
                      {student.streak > 0 ? `🔥 ${student.streak}` : student.streak} days
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-[#52525b] w-8">
                        {breadthPct}%
                      </span>
                      <div className="w-[60px] h-[6px] bg-[#e4e4e7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0d9488] rounded-full"
                          style={{ width: `${breadthPct}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[14px] text-[#52525b]">
                      {student.totalQuestions}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() =>
                        setNarrativeStudent({
                          id: student.studentId,
                          name,
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-[13px] text-[#0d9488] hover:underline focus:outline-none"
                    >
                      <MessageSquareText className="h-4 w-4" />
                      View narrative
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {narrativeStudent && (
        <StudentNarrativeDialog
          studentId={narrativeStudent.id}
          studentName={narrativeStudent.name}
          open={true}
          onClose={() => setNarrativeStudent(null)}
        />
      )}
    </>
  );
}
