import { z } from "zod";
import { generateText, Output } from "ai";
import { createLLMAdapter } from "../adapters/factory";

/**
 * Build a disambiguation prompt for LLM to decide if a new concept matches an existing one.
 *
 * Used in the 0.85-0.92 cosine similarity band where pgvector ANN finds candidates
 * that are close but not certain enough to auto-merge.
 *
 * Key disambiguation rule: same word in different domains (e.g. "wave" in physics vs
 * "wave" in music) should NOT merge. Same concept with different phrasing SHOULD merge.
 */
export function buildDisambiguatePrompt(
  newConcept: string,
  newDomain: string,
  candidates: Array<{ name: string; domain: string; distance: number }>
): string {
  const candidateList = candidates
    .map(
      (c, i) =>
        `  ${i}. "${c.name}" (domain: ${c.domain}, similarity: ${(1 - c.distance).toFixed(2)})`
    )
    .join("\n");

  return `You are helping deduplicate educational concepts in a student knowledge graph.

A student encountered a new concept: "${newConcept}" (domain: ${newDomain})

Existing similar concepts in this student's knowledge graph:
${candidateList}

Does the new concept refer to the SAME underlying educational concept as any of the existing ones?

Rules:
- Same word in different domains (e.g. "wave" in physics vs "wave" in music) should NOT merge.
- Same concept with slightly different phrasing (e.g. "Newton's law" vs "Newton's second law of motion") SHOULD merge if they refer to the same idea.
- Consider domain context carefully — cross-domain matches require strong semantic overlap.

Respond with a JSON object:
{ "match": true/false, "matchIndex": <0-based index of the matching candidate, or 0 if no match> }`;
}

const disambiguateSchema = z.object({
  match: z.boolean(),
  matchIndex: z.number().int().nonnegative(),
});

/**
 * Use an LLM to determine whether a new concept is the same as an existing one.
 *
 * Called only in the 0.85-0.92 similarity band (borderline matches).
 * Fails open: on any error, returns { match: false, matchIndex: 0 } so a new
 * node is created rather than data being lost.
 *
 * @param newName - The new concept name to check
 * @param newDomain - The domain of the new concept
 * @param candidates - Borderline similar existing concepts with their distances
 * @param questionContext - The original student question for additional context
 * @returns { match: boolean; matchIndex: number } — matchIndex is 0-based into candidates array
 */
export async function disambiguateConcept(
  newName: string,
  newDomain: string,
  candidates: Array<{ name: string; domain: string; distance: number }>,
  questionContext: string
): Promise<{ match: boolean; matchIndex: number }> {
  try {
    const adapter = createLLMAdapter();
    const model = adapter.getModel();

    const basePrompt = buildDisambiguatePrompt(newName, newDomain, candidates);
    // Append student question for additional context (T-03-04: concept names only, no PII)
    const prompt = `${basePrompt}\n\nThe student's question was: ${questionContext}`;

    const { experimental_output } = await generateText({
      model,
      prompt,
      experimental_output: Output.object({ schema: disambiguateSchema }),
    });

    return {
      match: experimental_output.match,
      matchIndex: experimental_output.matchIndex,
    };
  } catch (err) {
    // Fail-open: prefer creating a new node over losing concept data
    console.error("[disambiguate] LLM disambiguation failed, defaulting to no-match:", err);
    return { match: false, matchIndex: 0 };
  }
}
