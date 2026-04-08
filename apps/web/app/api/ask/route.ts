import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { db, schema } from "@mindmap/db";
import { and, eq, gte, lt } from "drizzle-orm";
import { createLLMAdapter, buildEnrichSystemPrompt, extractConcepts } from "@mindmap/llm";
import { routeQuestion } from "@mindmap/router";
import { z } from "zod";

export const maxDuration = 60;

const questionSchema = z.object({
  question: z.string().min(1, "Question is required").max(500, "Question must be 500 characters or fewer"),
});

export async function POST(req: Request) {
  // T-02-08: Auth check — userId from session only, never from request body
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = session.user.id;

  // T-02-09: Validate input
  let parsed: { question: string };
  try {
    const body = await req.json();
    const result = questionSchema.safeParse(body);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error.issues[0].message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    parsed = result.data;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { question } = parsed;

  // T-02-10: One-per-day check using UTC date range query
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfTomorrow = new Date(startOfDay.getTime() + 86_400_000);

  const existingQuestion = await db.query.questions.findFirst({
    where: and(
      eq(schema.questions.userId, userId),
      gte(schema.questions.createdAt, startOfDay),
      lt(schema.questions.createdAt, startOfTomorrow),
    ),
  });

  if (existingQuestion) {
    return new Response(JSON.stringify({ error: "One question per day" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get student's grade level from most recent enrollment
  const enrollment = await db.query.classEnrollments.findFirst({
    where: eq(schema.classEnrollments.studentId, userId),
    orderBy: (t, { desc }) => [desc(t.enrolledAt)],
  });
  const gradeLevel = enrollment?.gradeLevel ?? 6;

  // T-02-11: PRIV-01 — Only question text and gradeLevel go to Claude. No PII.
  const adapter = createLLMAdapter();
  const model = adapter.getModel();
  const systemPrompt = buildEnrichSystemPrompt(gradeLevel);

  const result = streamText({
    model,
    system: systemPrompt,
    prompt: question,
    onFinish: async ({ text }) => {
      try {
        // Save the question with the full AI response
        const [savedQuestion] = await db
          .insert(schema.questions)
          .values({
            userId,
            text: question,
            aiResponse: text,
            routingMode: "enrich",
          })
          .returning();

        // Extract concepts from the question and answer
        const concepts = await extractConcepts(question, text);

        if (concepts.length === 0) {
          return;
        }

        // Route each concept and collect routing decisions
        const routingDecisions = concepts.map((concept) => ({
          concept,
          decision: routeQuestion(concept.name, gradeLevel, concept.domain),
        }));

        // Determine primary routing mode (first concept's decision)
        const primaryDecision = routingDecisions[0].decision;
        const routingMode = primaryDecision.mode;
        const routingMisconceptionId =
          primaryDecision.mode === "diagnose" ? primaryDecision.misconceptionId : null;

        // Update question with routing info
        await db
          .update(schema.questions)
          .set({
            routingMode,
            routingMisconceptionId,
          })
          .where(eq(schema.questions.id, savedQuestion.id));

        // Insert each concept and create join records
        for (const { concept, decision } of routingDecisions) {
          if (decision.mode === "diagnose") {
            console.log(
              `[router] diagnose: ${concept.name} -> ${decision.misconceptionId}`,
            );
          }

          const [savedConcept] = await db
            .insert(schema.concepts)
            .values({
              userId,
              name: concept.name,
              domain: concept.domain,
              status: "unprobed",
            })
            .returning();

          await db.insert(schema.conceptQuestions).values({
            conceptId: savedConcept.id,
            questionId: savedQuestion.id,
          });
        }
      } catch (err) {
        console.error("[onFinish] concept extraction failed:", err);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
