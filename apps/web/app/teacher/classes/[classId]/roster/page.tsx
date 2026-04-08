import { notFound } from "next/navigation"

import { getClassRoster } from "@/actions/class"
import { ClassRoster } from "@/components/class/class-roster"
import { JoinCodeDisplay } from "@/components/class/join-code-display"

interface RosterPageProps {
  params: Promise<{ classId: string }>
}

export default async function RosterPage({ params }: RosterPageProps) {
  const { classId } = await params
  const result = await getClassRoster(classId)

  if ("error" in result) {
    notFound()
  }

  const { class: cls, students } = result

  return (
    <div className="pt-8 pb-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-[20px] font-semibold text-[#18181b]">
          {cls.name} — Roster
        </h1>
        <JoinCodeDisplay joinCode={cls.joinCode} className="shrink-0" />
      </div>

      {students.length === 0 ? (
        <div className="bg-[#f4f4f5] rounded-xl p-6">
          <p className="text-[16px] font-semibold text-[#18181b]">No students yet</p>
          <p className="text-[14px] text-[#71717a] mt-1">
            Share the join code{" "}
            <span className="font-mono font-semibold">{cls.joinCode}</span>{" "}
            with your students to get started.
          </p>
        </div>
      ) : (
        <ClassRoster
          students={students}
          className={cls.name}
          classId={classId}
        />
      )}
    </div>
  )
}
