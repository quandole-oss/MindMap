import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getQuestionHistory } from "@/actions/questions";
import { QuestionHistory } from "@/components/questions/question-history";

export default async function QuestionsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const questions = await getQuestionHistory();

  // Normalize createdAt to Date objects (Drizzle returns Date, but type may vary)
  const normalized = questions.map((q) => ({
    id: q.id,
    text: q.text,
    aiResponse: q.aiResponse ?? null,
    createdAt: q.createdAt instanceof Date ? q.createdAt : new Date(q.createdAt!),
  }));

  return (
    <div className="pt-8 pb-8">
      <h1 className="text-[20px] font-semibold text-[#18181b] mb-6">My Questions</h1>
      <QuestionHistory questions={normalized} />
    </div>
  );
}
