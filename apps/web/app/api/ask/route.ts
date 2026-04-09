import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { db, schema, findSimilarConcepts, createConceptEdges } from "@mindmap/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { createLLMAdapter, buildEnrichSystemPrompt, extractConcepts, generateEmbedding, disambiguateConcept } from "@mindmap/llm";
import { getMisconceptionById } from "@mindmap/misconceptions";
import { routeQuestion, semanticFallback, type RoutingDecision } from "@mindmap/router";
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

  // T-06-12: Return 503 immediately when ANTHROPIC_API_KEY is not configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "AI features require ANTHROPIC_API_KEY to be configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
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

        // Route each concept via string matching
        const routingDecisions = concepts.map((concept) => ({
          concept,
          decision: routeQuestion(concept.name, gradeLevel, concept.domain),
        }));

        // Collect concepts that string matching could not route to a misconception
        const unmatchedConcepts = routingDecisions
          .filter((r) => r.decision.mode === "enrich")
          .map((r) => r.concept);

        // LLM semantic fallback for unmatched concepts (batched, single call)
        let semanticMatches: Array<{ conceptName: string; misconceptionId: string; confidence: number }> = [];
        if (unmatchedConcepts.length > 0) {
          semanticMatches = await semanticFallback(unmatchedConcepts, gradeLevel, model);
        }

        // Merge: upgrade any enrich decisions to diagnose based on semantic matches
        const semanticMatchMap = new Map(semanticMatches.map((m) => [m.conceptName, m]));
        const mergedDecisions = routingDecisions.map(({ concept, decision }) => {
          if (decision.mode === "enrich") {
            const semantic = semanticMatchMap.get(concept.name);
            if (semantic) {
              return {
                concept,
                decision: {
                  mode: "diagnose" as const,
                  misconceptionId: semantic.misconceptionId,
                  probability: semantic.confidence,
                },
              };
            }
          }
          return { concept, decision };
        });

        // Find ALL diagnose decisions, sort by confidence, pick the best
        const diagnoseDecisions = mergedDecisions
          .filter((r): r is { concept: typeof r.concept; decision: Extract<RoutingDecision, { mode: "diagnose" }> } =>
            r.decision.mode === "diagnose"
          )
          .sort((a, b) => b.decision.probability - a.decision.probability);

        const primaryDecision = diagnoseDecisions.length > 0
          ? diagnoseDecisions[0].decision
          : ({ mode: "enrich" } as const);

        const primaryDiagnoseConcept = diagnoseDecisions.length > 0
          ? diagnoseDecisions[0].concept
          : null;

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

        // Deduplicate concepts using two-stage pipeline (GRPH-02):
        // 1. Generate embedding for each concept
        // 2. pgvector ANN search for similar existing concepts
        // 3. Auto-merge (>0.92), LLM disambiguate (0.85-0.92), or create new (<0.85)
        const resolvedConceptIds: string[] = [];
        const conceptNameToResolvedId = new Map<string, string>();

        for (const { concept, decision } of mergedDecisions) {
          if (decision.mode === "diagnose") {
            console.log(
              `[router] diagnose: ${concept.name} -> ${decision.misconceptionId}`,
            );
          }

          let resolvedConceptId: string;

          try {
            // Generate embedding for the concept name
            const embedding = await generateEmbedding(concept.name);

            // Search for similar existing concepts via pgvector HNSW
            const similar = await findSimilarConcepts(userId, embedding, 0.85, 5);

            if (similar.length > 0) {
              const topMatch = similar[0];
              const similarity = 1 - topMatch.distance;

              if (similarity > 0.92) {
                // Auto-merge: increment visitCount on existing concept
                await db
                  .update(schema.concepts)
                  .set({ visitCount: sql`${schema.concepts.visitCount} + 1` })
                  .where(eq(schema.concepts.id, topMatch.id));
                resolvedConceptId = topMatch.id;
                console.log(`[dedup] auto-merge: "${concept.name}" -> "${topMatch.name}" (similarity: ${similarity.toFixed(3)})`);
              } else {
                // Ambiguous band (0.85-0.92): LLM disambiguation
                const disambigResult = await disambiguateConcept(
                  concept.name,
                  concept.domain,
                  similar,
                  question
                );

                if (disambigResult.match && disambigResult.matchIndex < similar.length) {
                  // LLM says merge
                  const matchedConcept = similar[disambigResult.matchIndex];
                  await db
                    .update(schema.concepts)
                    .set({ visitCount: sql`${schema.concepts.visitCount} + 1` })
                    .where(eq(schema.concepts.id, matchedConcept.id));
                  resolvedConceptId = matchedConcept.id;
                  console.log(`[dedup] llm-merge: "${concept.name}" -> "${matchedConcept.name}"`);
                } else {
                  // LLM says different concept — create new with embedding
                  const [newConcept] = await db
                    .insert(schema.concepts)
                    .values({
                      userId,
                      name: concept.name,
                      domain: concept.domain,
                      status: "unprobed",
                      embedding,
                      visitCount: 1,
                    })
                    .returning();
                  resolvedConceptId = newConcept.id;
                  console.log(`[dedup] llm-new: "${concept.name}" (disambiguated from "${similar[0].name}")`);
                }
              }
            } else {
              // No similar concepts found — create new with embedding
              const [newConcept] = await db
                .insert(schema.concepts)
                .values({
                  userId,
                  name: concept.name,
                  domain: concept.domain,
                  status: "unprobed",
                  embedding,
                  visitCount: 1,
                })
                .returning();
              resolvedConceptId = newConcept.id;
              console.log(`[dedup] new: "${concept.name}" (no similar concepts)`);
            }
          } catch (embeddingErr) {
            // Fallback: if embedding fails (no OPENAI_API_KEY, etc.), insert without embedding
            console.error(`[dedup] embedding failed for "${concept.name}", inserting without:`, embeddingErr);
            const [newConcept] = await db
              .insert(schema.concepts)
              .values({
                userId,
                name: concept.name,
                domain: concept.domain,
                status: "unprobed",
                visitCount: 1,
              })
              .returning();
            resolvedConceptId = newConcept.id;
          }

          // Track name → resolved ID for accurate diagnose branch lookup
          conceptNameToResolvedId.set(concept.name, resolvedConceptId);

          // Create join record linking concept to question
          await db.insert(schema.conceptQuestions).values({
            conceptId: resolvedConceptId,
            questionId: savedQuestion.id,
          });

          resolvedConceptIds.push(resolvedConceptId);
        }

        // Create curiosity_link edges between all concepts from this question (GRPH-03)
        await createConceptEdges(resolvedConceptIds, "curiosity_link");

        // Diagnose branch: create a diagnostic session when the router returns diagnose mode
        // T-04-02: This runs server-side in onFinish — student cannot influence session creation
        if (primaryDecision.mode === "diagnose" && primaryDiagnoseConcept) {
          const diagConceptId = conceptNameToResolvedId.get(primaryDiagnoseConcept.name);
          if (!diagConceptId) {
            console.warn(`[diagnose] resolved concept ID not found for "${primaryDiagnoseConcept.name}"`);
          } else {
            // T-e12-01: Validate misconceptionId against library before use (rejects LLM-fabricated IDs)
            const misconceptionEntry = getMisconceptionById(primaryDecision.misconceptionId);
            if (misconceptionEntry) {
              // Set concept status to misconception (coral node in graph)
              await db
                .update(schema.concepts)
                .set({ status: "misconception" })
                .where(eq(schema.concepts.id, diagConceptId));

              // Create a diagnostic session at stage=probe
              await db.insert(schema.diagnosticSessions).values({
                userId,
                conceptId: diagConceptId,
                questionId: savedQuestion.id,
                misconceptionId: misconceptionEntry.id,
                misconceptionName: misconceptionEntry.name,
                stage: "probe",
                messages: [],
              });

              console.log(
                `[diagnose] created session for misconception "${misconceptionEntry.name}" (concept: ${diagConceptId})`
              );
            } else {
              console.warn(
                `[diagnose] misconception not found in library: ${primaryDecision.misconceptionId}`
              );
            }
          }
        }
      } catch (err) {
        console.error("[onFinish] concept extraction failed:", err);
      }
    },
  });

  return result.toTextStreamResponse();
}
