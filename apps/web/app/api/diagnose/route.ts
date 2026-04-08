import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { eq, and } from "drizzle-orm";
import {
  createLLMAdapter,
  buildProbeSystemPrompt,
  buildConfrontSystemPrompt,
  evaluateResolution,
  buildResolveMessage,
} from "@mindmap/llm";
import { getMisconceptionById } from "@mindmap/misconceptions";

export const maxDuration = 60;

export async function POST(req: Request) {
  // T-04-10: Auth check — userId from session only, never from request body
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = session.user.id;

  let sessionId: string;
  let message: UIMessage | null;

  try {
    const body = await req.json();
    sessionId = body.sessionId;
    message = body.message ?? null;

    if (!sessionId || typeof sessionId !== "string") {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // T-06-12: Return 503 immediately when ANTHROPIC_API_KEY is not configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI features require ANTHROPIC_API_KEY to be configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // T-04-05: Load session with ownership check — students cannot access other students' sessions
    const diagnosticSession = await db.query.diagnosticSessions.findFirst({
      where: and(
        eq(schema.diagnosticSessions.id, sessionId),
        eq(schema.diagnosticSessions.userId, userId)
      ),
    });

    if (!diagnosticSession) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stage "resolve" (terminal) — no more streaming, return JSON state
    if (diagnosticSession.stage === "resolve") {
      return new Response(
        JSON.stringify({
          stage: "resolve",
          outcome: diagnosticSession.outcome,
          misconceptionName: diagnosticSession.misconceptionName,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const adapter = createLLMAdapter();
    const model = adapter.getModel();

    // Get student's grade level from most recent enrollment
    const enrollment = await db.query.classEnrollments.findFirst({
      where: eq(schema.classEnrollments.studentId, userId),
      orderBy: (t, { desc }) => [desc(t.enrolledAt)],
    });
    const gradeLevel = enrollment?.gradeLevel ?? 6;

    // Load misconception entry from library
    const misconceptionEntry = getMisconceptionById(diagnosticSession.misconceptionId);

    // Stage "probe" — initial probe question (no messages in DB yet)
    if (
      diagnosticSession.stage === "probe" &&
      diagnosticSession.messages.length === 0
    ) {
      // Look up original question text for context in probe prompt
      let originalQuestion = "something you were curious about";
      if (diagnosticSession.questionId) {
        const questionRecord = await db.query.questions.findFirst({
          where: eq(schema.questions.id, diagnosticSession.questionId),
        });
        if (questionRecord) {
          originalQuestion = questionRecord.text;
        }
      }

      const probeQuestion =
        misconceptionEntry?.probe_questions?.[0] ??
        "Tell me what you think about this concept.";

      const systemPrompt = buildProbeSystemPrompt(
        probeQuestion,
        gradeLevel,
        originalQuestion
      );

      const result = streamText({
        model,
        system: systemPrompt,
        prompt: "Begin the diagnostic conversation by asking the student the probe question.",
      });

      return result.toUIMessageStreamResponse({
        onFinish: async ({ messages: updatedMessages }) => {
          try {
            await db
              .update(schema.diagnosticSessions)
              .set({ messages: updatedMessages as UIMessage[], updatedAt: new Date() })
              .where(eq(schema.diagnosticSessions.id, sessionId));
          } catch (err) {
            console.error("[diagnose] onFinish save error (probe init):", err);
          }
        },
      });
    }

    // Stage "probe" or "classify" with student response — advance to confront
    if (
      diagnosticSession.stage === "probe" ||
      diagnosticSession.stage === "classify"
    ) {
      if (!message) {
        return new Response(
          JSON.stringify({ error: "message is required for this stage" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // T-04-06: Server loads history from DB; client only sends latest message
      const allMessages: UIMessage[] = [...diagnosticSession.messages, message];

      // Extract the student's probe response (last user message in history)
      const lastUserMessage = [...allMessages].reverse().find((m) => m.role === "user");
      const probeResponse =
        lastUserMessage?.parts
          ?.map((p) => (p.type === "text" ? p.text : ""))
          .join("") ?? "";

      const confrontationSeed =
        misconceptionEntry?.confrontation_scenarios?.[0] ??
        "Consider this scenario and tell me what you think.";

      const confrontPrompt = buildConfrontSystemPrompt(
        diagnosticSession.misconceptionName,
        probeResponse,
        confrontationSeed,
        gradeLevel
      );

      // Mark stage as classify (transient) before generating confront response
      await db
        .update(schema.diagnosticSessions)
        .set({ stage: "classify", updatedAt: new Date() })
        .where(eq(schema.diagnosticSessions.id, sessionId));

      // CRITICAL: convertToModelMessages is async in AI SDK v6 — must await
      const modelMessages = await convertToModelMessages(allMessages);

      const result = streamText({
        model,
        system: confrontPrompt,
        messages: modelMessages,
      });

      return result.toUIMessageStreamResponse({
        originalMessages: allMessages,
        onFinish: async ({ messages: updatedMessages }) => {
          try {
            await db
              .update(schema.diagnosticSessions)
              .set({
                messages: updatedMessages as UIMessage[],
                stage: "confront",
                updatedAt: new Date(),
              })
              .where(eq(schema.diagnosticSessions.id, sessionId));
          } catch (err) {
            console.error("[diagnose] onFinish save error (probe->confront):", err);
          }
        },
      });
    }

    // Stage "confront" — student responded to confrontation, evaluate resolution
    if (diagnosticSession.stage === "confront") {
      if (!message) {
        return new Response(
          JSON.stringify({ error: "message is required for this stage" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // T-04-06: Append new student message to DB history
      const allMessages: UIMessage[] = [...diagnosticSession.messages, message];

      // Extract student's final response text (last user message)
      const studentFinalMessage = [...allMessages].reverse().find((m) => m.role === "user");
      const studentFinalResponse =
        studentFinalMessage?.parts
          ?.map((p) => (p.type === "text" ? p.text : ""))
          .join("") ?? "";

      // Extract the probe response (first user message in history)
      const firstUserMessage = allMessages.find((m) => m.role === "user");
      const probeResponse =
        firstUserMessage?.parts
          ?.map((p) => (p.type === "text" ? p.text : ""))
          .join("") ?? "";

      // Extract the confrontation used (last assistant message before the student's final response)
      const lastAssistantMessage = [...diagnosticSession.messages]
        .reverse()
        .find((m) => m.role === "assistant");
      const confrontationUsed =
        lastAssistantMessage?.parts
          ?.map((p: { type: string; text?: string }) => (p.type === "text" ? p.text : ""))
          .join("") ?? "";

      // T-04-07: Resolution evaluation runs server-side — client cannot fake this
      const resolutionResult = await evaluateResolution({
        misconceptionName: diagnosticSession.misconceptionName,
        probeResponse,
        confrontationUsed,
        studentFinalResponse,
      });

      // Update concept health based on resolution
      if (resolutionResult.resolved) {
        // MISC-09: Concept turns teal (healthy) on successful resolution
        await db
          .update(schema.concepts)
          .set({ status: "healthy" })
          .where(eq(schema.concepts.id, diagnosticSession.conceptId));
      }
      // Unresolved: concept stays coral — "misconception" status unchanged

      const outcome = resolutionResult.resolved ? "resolved" : "unresolved";

      // Build the warm resolve reveal message (T-04-08: first time misconception name is revealed)
      const resolvePrompt = buildResolveMessage(
        diagnosticSession.misconceptionName,
        resolutionResult.resolved
      );

      // CRITICAL: convertToModelMessages is async in AI SDK v6 — must await
      const modelMessages = await convertToModelMessages(allMessages);

      const result = streamText({
        model,
        system: resolvePrompt,
        messages: modelMessages,
      });

      return result.toUIMessageStreamResponse({
        originalMessages: allMessages,
        onFinish: async ({ messages: updatedMessages }) => {
          try {
            await db
              .update(schema.diagnosticSessions)
              .set({
                messages: updatedMessages as UIMessage[],
                stage: "resolve",
                outcome,
                updatedAt: new Date(),
              })
              .where(eq(schema.diagnosticSessions.id, sessionId));
          } catch (err) {
            console.error("[diagnose] onFinish save error (confront->resolve):", err);
          }
        },
      });
    }

    // Fallback — should not reach here
    return new Response(JSON.stringify({ error: "Unknown session state" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[diagnose]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
