import type { ConceptHeatmapEntry } from "@/lib/dashboard-types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ConceptsTabProps {
  heatmap: ConceptHeatmapEntry[];
}

export function ConceptsTab({ heatmap }: ConceptsTabProps) {
  if (heatmap.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[14px] text-[#71717a]">
          No concepts recorded yet across this class.
        </p>
      </div>
    );
  }

  const sorted = [...heatmap].sort((a, b) => b.studentCount - a.studentCount);
  const maxStudentCount = sorted[0]?.studentCount ?? 1;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Concept</TableHead>
          <TableHead>Domain</TableHead>
          <TableHead>Students</TableHead>
          <TableHead>Total Visits</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((entry) => {
          const intensity =
            maxStudentCount > 0 ? entry.studentCount / maxStudentCount : 0;
          const bgColor = `rgba(20, 184, 166, ${0.05 + intensity * 0.2})`;
          return (
            <TableRow
              key={`${entry.conceptName}-${entry.domain}`}
              style={{ backgroundColor: bgColor }}
            >
              <TableCell className="font-medium text-[14px]">
                {entry.conceptName}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{entry.domain}</Badge>
              </TableCell>
              <TableCell className="text-[14px]">
                {entry.studentCount}
              </TableCell>
              <TableCell className="text-[14px]">{entry.totalVisits}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
