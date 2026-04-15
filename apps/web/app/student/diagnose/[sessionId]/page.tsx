import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/lib/auth";
import { getSessionById } from "@/actions/diagnostic";
import { DiagnosticChat } from "@/components/diagnostic/diagnostic-chat";
import type { UIMessage } from "ai";

export default async function DiagnosePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { sessionId } = await params;
  const diagnosticSession = await getSessionById(sessionId);
  if (!diagnosticSession) redirect("/student");

  const initialMessages = (diagnosticSession.messages ?? []) as UIMessage[];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-black">
      <div className="max-w-[680px] mx-auto px-4 py-6">
        <Link
          href="/student"
          className="inline-flex items-center gap-2 text-[14px] text-white/60 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <DiagnosticChat
          sessionId={diagnosticSession.id}
          initialMessages={initialMessages}
          stage={diagnosticSession.stage}
          outcome={diagnosticSession.outcome}
          misconceptionName={diagnosticSession.misconceptionName}
          conceptId={diagnosticSession.conceptId}
        />
      </div>
    </div>
  );
}
