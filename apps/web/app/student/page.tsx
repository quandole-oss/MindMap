import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasAskedToday, getTodayQuestion, getStudentGradeLevel, getTodayQuestionConcepts } from "@/actions/questions";
import { getTodayDiagnosticSession } from "@/actions/diagnostic";
import { QuestionForm } from "@/components/questions/question-form";
import { SpiralBackground } from "@/components/ui/spiral-background";

export default async function StudentDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [askedToday, todayQuestion, gradeLevel, todayConcepts, todayDiagnostic] = await Promise.all([
    hasAskedToday(),
    getTodayQuestion(),
    getStudentGradeLevel(),
    getTodayQuestionConcepts(),
    getTodayDiagnosticSession(),
  ]);

  return (
    <div className="relative min-h-[calc(100vh-56px)] bg-black overflow-hidden">
      {/* Spiral background — fills the whole dashboard area */}
      <SpiralBackground />

      {/* Content centered over spiral */}
      <div className="relative z-10 min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[640px] flex flex-col items-center text-center gap-6">
          <h1 className="text-[32px] font-bold text-white leading-tight">
            What are you curious about today?
          </h1>
          <p className="text-[14px] text-white/60">
            Ask your one question and explore your knowledge map.
          </p>

          {/* Question input */}
          <div className="w-full mt-2">
            <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
              <QuestionForm
                hasAskedToday={askedToday}
                todayQuestion={
                  todayQuestion
                    ? { text: todayQuestion.text, aiResponse: todayQuestion.aiResponse }
                    : null
                }
                gradeLevel={gradeLevel}
                todayConcepts={todayConcepts}
                todayDiagnostic={
                  todayDiagnostic
                    ? {
                        id: todayDiagnostic.id,
                        stage: todayDiagnostic.stage,
                        outcome: todayDiagnostic.outcome,
                        misconceptionName: todayDiagnostic.misconceptionName,
                      }
                    : null
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
