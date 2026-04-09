import { z } from "zod";
import { generateText, Output } from "ai";
import { loadLibrary } from "@mindmap/misconceptions";
import { gradeLevelToGradeBand } from "./utils";

const semanticRouteSchema = z.object({
  matches: z.array(
    z.object({
      conceptName: z.string(),
      misconceptionId: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

export type SemanticMatch = z.infer<typeof semanticRouteSchema>["matches"][number];

/**
 * LLM semantic fallback for concepts that string matching could not route.
 *
 * Makes a single batched LLM call for all unmatched concepts. On any error,
 * returns an empty array (graceful degradation to enrich mode).
 *
 * @param unmatched  - Concepts with no string match in the misconception library
 * @param gradeLevel - Student's numeric grade level (0-12)
 * @param model      - LLM model instance (caller provides; keeps router stateless)
 * @returns Array of semantic matches with confidence scores > 0.6
 */
export async function semanticFallback(
  unmatched: Array<{ name: string; domain: string }>,
  gradeLevel: number,
  model: Parameters<typeof generateText>[0]["model"]
): Promise<SemanticMatch[]> {
  if (unmatched.length === 0) {
    return [];
  }

  try {
    const gradeBand = gradeLevelToGradeBand(gradeLevel);

    // Load full library and filter by grade band only — let the LLM see cross-domain matches
    const allMisconceptions = loadLibrary().filter((m) => m.grade_band === gradeBand);

    if (allMisconceptions.length === 0) {
      return [];
    }

    const prompt = `You are a K-12 educational misconception detector.
Given a list of concepts a student asked about, identify which (if any) relate to well-documented student misconceptions.

Known misconceptions (grade band: ${gradeBand}):
${allMisconceptions.map((m) => `- ID: ${m.id} | "${m.name}" | ${m.description}`).join("\n")}

Concepts to check:
${unmatched.map((c) => `- "${c.name}" (domain: ${c.domain})`).join("\n")}

For each concept that semantically matches a known misconception, return the match with a confidence score (0-1).
Only include matches with confidence > 0.6. Return an empty matches array if none match.`;

    const { experimental_output } = await generateText({
      model,
      prompt,
      experimental_output: Output.object({ schema: semanticRouteSchema }),
    });

    return experimental_output.matches;
  } catch (err) {
    console.warn("[semanticFallback] LLM call failed, falling back to enrich mode:", err);
    return [];
  }
}
