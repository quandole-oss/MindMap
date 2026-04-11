/**
 * PRIV-01 compliance: This function's signature accepts only anonymized library data
 * (theme metadata, misconception entries from the static YAML library) plus an
 * aggregated student count and grade band. It MUST NOT accept a userId, studentId,
 * email, enrollment record, session record, or any other object containing student
 * identifiers. Student identity binding happens in the calling component layer
 * AFTER this function returns.
 *
 * Pattern source: packages/llm/src/prompts/diagnose-resolve.ts:47-55
 *
 * Anti-hallucination (D-15): every suggested activity must cite one or more
 * referencedMisconceptionIds, and the calling layer asserts (via fixture tests)
 * that those IDs are a subset of the input constituentMisconceptions. The v1
 * design does NOT post-filter the LLM output — the Zod schema enforces shape
 * and the test suite documents the grounding failure mode for reviewers.
 */
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLLMAdapter } from "../adapters/factory";

const activityItem = z.object({
  title: z.string().min(5),
  description: z.string().min(40),
  referencedMisconceptionIds: z.array(z.string()).min(1),
});

export const lessonPlanSchema = z.object({
  theme: z.string(),
  commonMisunderstanding: z.string().min(40),
  targetUnderstanding: z.string().min(40),
  suggestedActivities: z.array(activityItem).min(2).max(5),
  discussionPrompts: z.array(z.string().min(20)).min(2).max(5),
  confrontationApproaches: z.array(z.string().min(30)).min(1).max(3),
});

export type LessonPlan = z.infer<typeof lessonPlanSchema>;

type GenerateLessonPlanParams = {
  // PRIV-01: anonymized inputs only. No studentId, userId, email, enrollment.
  theme: {
    id: string;
    name: string;
    naive_theory: string;
    description: string;
    citation: string;
  };
  studentsAffected: number;
  gradeBand: "K-5" | "6-8" | "9-12";
  constituentMisconceptions: Array<{
    id: string;
    name: string;
    description: string;
    confrontation_scenarios: string[];
  }>;
};

function buildLessonPlanPrompt(params: GenerateLessonPlanParams): string {
  const { theme, studentsAffected, gradeBand, constituentMisconceptions } = params;

  const misconceptionBlock = constituentMisconceptions
    .map(
      (m) =>
        `  - id: ${m.id}\n    name: "${m.name}"\n    description: ${m.description}\n    confrontation_scenarios: ${JSON.stringify(m.confrontation_scenarios)}`
    )
    .join("\n");

  return `You are a K-12 science teacher coach producing a concrete, evidence-based lesson plan to address a shared root-cause theme that is blocking ${studentsAffected} students in a ${gradeBand} classroom.

Theoretical framing: Vosniadou's framework theory + Chi's ontological category shift. Students in this cohort share a single underlying framework-level misunderstanding (the "theme"), and the lesson plan must confront the framework — not merely list facts. Activities should create cognitive conflict that makes the current mental model insufficient, then scaffold the correct ontological category.

## Root-cause theme
- id: ${theme.id}
- label: ${theme.name}
- naive_theory: ${theme.naive_theory}
- description: ${theme.description}
- citation: ${theme.citation}
- grade_band: ${gradeBand}
- students_affected: ${studentsAffected}

## Constituent misconceptions observed in this class (these are the ONLY valid referencedMisconceptionIds)
${misconceptionBlock}

## Your task
Produce a JSON lesson plan object with these fields:
- theme: the theme label (string)
- commonMisunderstanding: 2-3 sentences describing the shared framework-level misunderstanding (min 40 chars)
- targetUnderstanding: 2-3 sentences describing the target ontological shift (min 40 chars)
- suggestedActivities: 2-5 activities. Each activity has:
    - title (min 5 chars)
    - description (min 40 chars) — MUST name a specific demonstration, artifact, or experiment
    - referencedMisconceptionIds: 1+ ids from the constituent list above
- discussionPrompts: 2-5 prompts (each min 20 chars)
- confrontationApproaches: 1-3 approaches (each min 30 chars) that create cognitive conflict (Vosniadou/Chi framing)

## Rules
1. Activities MUST NOT be vague. Do NOT write "have a discussion" or "use an analogy". Every activity must name a specific demonstration, artifact, or experiment students will see, touch, or measure.
2. Every activity MUST cite the misconception ids it addresses via referencedMisconceptionIds, and those ids MUST come from the constituent list above. Do not invent misconception ids or reference ids that are not listed.
3. Be specific and concrete. A teacher should be able to execute the plan tomorrow with the equipment typical of a ${gradeBand} classroom.
4. Do NOT reference any individual student by identifier — you have not been given any.
5. Return ONLY the JSON object, no prose.`;
}

/**
 * PRIV-01 note: parameter shape contains only anonymized library data plus a grade
 * band and aggregate count. See the file-level docblock for the full contract.
 */
export async function generateLessonPlan(params: GenerateLessonPlanParams): Promise<LessonPlan> {
  const adapter = createLLMAdapter();
  const model = adapter.getModel();
  const prompt = buildLessonPlanPrompt(params);

  try {
    const { experimental_output } = await generateText({
      model,
      prompt,
      temperature: 0.3,
      experimental_output: Output.object({ schema: lessonPlanSchema }),
    });

    return experimental_output;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`generateLessonPlan failed for theme "${params.theme.id}": ${message}`);
  }
}
