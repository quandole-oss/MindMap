import Link from "next/link";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStudentEnrollments } from "@/actions/class";
import { hasAskedToday, getTodayQuestion, getStudentGradeLevel } from "@/actions/questions";
import { Badge } from "@/components/ui/badge";
import { QuestionForm } from "@/components/questions/question-form";

function formatGrade(gradeLevel: number): string {
  return gradeLevel === 0 ? "K" : String(gradeLevel);
}

export default async function StudentDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Load question state in parallel with enrollments
  const [enrollments, askedToday, todayQuestion, gradeLevel] = await Promise.all([
    getStudentEnrollments(),
    hasAskedToday(),
    getTodayQuestion(),
    getStudentGradeLevel(),
  ]);

  return (
    <div className="pt-8 pb-8">
      {/* Question panel — primary CTA, centered at max-w-[680px] */}
      <div className="max-w-[680px] mx-auto mb-10">
        <h2 className="text-[20px] font-semibold text-[#18181b] mb-4">
          Today&apos;s Question
        </h2>
        <QuestionForm
          hasAskedToday={askedToday}
          todayQuestion={
            todayQuestion
              ? { text: todayQuestion.text, aiResponse: todayQuestion.aiResponse }
              : null
          }
          gradeLevel={gradeLevel}
        />
      </div>

      {/* Classes section — below the question panel */}
      <div className="max-w-[680px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[20px] font-semibold text-[#18181b]">My Classes</h1>
          <Link
            href="/student/join"
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-[#18181b] text-white text-[14px] font-medium transition-colors hover:bg-[#27272a]"
          >
            Join a class
          </Link>
        </div>

        {enrollments.length === 0 ? (
          <div className="bg-[#f4f4f5] rounded-xl p-6">
            <p className="text-[16px] font-semibold text-[#18181b]">
              You haven&apos;t joined a class
            </p>
            <p className="text-[14px] text-[#71717a] mt-1">
              Ask your teacher for the 6-character class code, then tap Join a class.
            </p>
            <Link
              href="/student/join"
              className="inline-flex items-center justify-center mt-4 h-11 px-6 rounded-lg bg-[#18181b] text-white text-[14px] font-medium transition-colors hover:bg-[#27272a]"
            >
              Join a class
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.enrollmentId}
                className="bg-white border border-[#e4e4e7] rounded-xl p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[20px] font-semibold text-[#18181b]">
                      {enrollment.className}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[14px] border-transparent"
                      >
                        Grade {formatGrade(enrollment.gradeLevel)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
