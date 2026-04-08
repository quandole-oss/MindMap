"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import { removeStudentAction } from "@/actions/class"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Student {
  enrollmentId: string
  studentId: string
  gradeLevel: number
  enrolledAt: Date | null
  studentName: string | null
  studentEmail: string | null
}

interface ClassRosterProps {
  students: Student[]
  className: string
  classId: string
}

function formatGrade(gradeLevel: number): string {
  return gradeLevel === 0 ? "K" : String(gradeLevel)
}

function RemoveStudentButton({
  enrollmentId,
  studentName,
  className,
}: {
  enrollmentId: string
  studentName: string
  className: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRemove() {
    startTransition(async () => {
      await removeStudentAction(enrollmentId)
      router.refresh()
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-lg px-3 h-8 text-[14px] text-[#ef4444] hover:bg-red-50 transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        Remove from class
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove student?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove {studentName} from {className}. They can rejoin with the class code.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            className="bg-[#ef4444] text-white hover:bg-red-600"
          >
            Remove student
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ClassRoster({ students, className, classId }: ClassRosterProps) {
  return (
    <div className="rounded-xl border border-[#e4e4e7] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f4f4f5]">
            <TableHead className="text-[14px] font-medium text-[#52525b]">
              Student
            </TableHead>
            <TableHead className="text-[14px] font-medium text-[#52525b]">
              Grade
            </TableHead>
            <TableHead className="text-right text-[14px] font-medium text-[#52525b]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.enrollmentId}>
              <TableCell className="text-[14px] text-[#18181b]">
                <div>
                  <p className="font-medium">
                    {student.studentName ?? "Unknown"}
                  </p>
                  {student.studentEmail && (
                    <p className="text-[12px] text-[#71717a]">
                      {student.studentEmail}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-[14px] text-[#52525b]">
                {formatGrade(student.gradeLevel)}
              </TableCell>
              <TableCell className="text-right">
                <RemoveStudentButton
                  enrollmentId={student.enrollmentId}
                  studentName={student.studentName ?? "this student"}
                  className={className}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
