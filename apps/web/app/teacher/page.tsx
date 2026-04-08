import Link from "next/link"

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTeacherClasses } from "@/actions/class"
import { Badge } from "@/components/ui/badge"

function formatGrade(gradeLevel: number): string {
  return gradeLevel === 0 ? "K" : String(gradeLevel)
}

export default async function TeacherDashboard() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const classes = await getTeacherClasses()

  return (
    <div className="pt-8 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-[#18181b]">
          My Classes
        </h1>
        <Link
          href="/teacher/classes/new"
          className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-[#18181b] text-white text-[14px] font-medium transition-colors hover:bg-[#27272a]"
        >
          Create a class
        </Link>
      </div>

      {classes.length === 0 ? (
        <div className="bg-[#f4f4f5] rounded-xl p-6">
          <p className="text-[16px] font-semibold text-[#18181b]">No classes yet</p>
          <p className="text-[14px] text-[#71717a] mt-1">
            Create your first class and share the join code with your students.
          </p>
          <Link
            href="/teacher/classes/new"
            className="inline-flex items-center justify-center mt-4 h-11 px-6 rounded-lg bg-[#18181b] text-white text-[14px] font-medium transition-colors hover:bg-[#27272a]"
          >
            Create a class
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-white border border-[#e4e4e7] rounded-xl p-5 hover:border-[#71717a] transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <Link
                  href={`/teacher/classes/${cls.id}/dashboard`}
                  className="flex flex-col gap-1.5 flex-1 min-w-0"
                >
                  <p className="text-[20px] font-semibold text-[#18181b]">
                    {cls.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#18181b] text-white font-mono tracking-wider text-[14px] border-transparent">
                      {cls.joinCode}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-[14px] border-transparent"
                    >
                      Grade {formatGrade(cls.gradeLevel)}
                    </Badge>
                  </div>
                  <span className="text-[12px] text-[#71717a]">Open dashboard</span>
                </Link>
                <Link
                  href={`/teacher/classes/${cls.id}/roster`}
                  className="text-[14px] text-[#71717a] shrink-0 hover:text-[#18181b] transition-colors"
                >
                  View roster →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
