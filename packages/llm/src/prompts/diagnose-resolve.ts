import { z } from "zod";
import { generateText, Output } from "ai";
import { createLLMAdapter } from "../adapters/factory";

const resolutionSchema = z.object({
  resolved: z.boolean(),
  rationale: z.string(),
});

export type ResolutionResult = z.infer<typeof resolutionSchema>;

/**
 * Evaluates whether the student has resolved their misconception based on their final response.
 *
 * Uses generateText + Output.object (same pattern as extract.ts) for structured output.
 *
 * Evaluation is intentionally generous: partial understanding counts as resolved.
 * Only returns false if the student completely restates the original misconception
 * or shows zero engagement with the counterevidence.
 */
export async function evaluateResolution(params: {
  misconceptionName: string;
  probeResponse: string;
  confrontationUsed: string;
  studentFinalResponse: string;
}): Promise<{ resolved: boolean; rationale: string }> {
  const adapter = createLLMAdapter();
  const model = adapter.getModel();

  const prompt = `You are evaluating whether a student has made a genuine shift in their thinking about a common scientific misconception.

Misconception being addressed: "${params.misconceptionName}"

What the student originally believed (their probe response): "${params.probeResponse}"

The counterevidence that was presented to them: "${params.confrontationUsed}"

The student's final response after seeing the counterevidence: "${params.studentFinalResponse}"

Decide whether the student has resolved this misconception. Be generous in your evaluation:
- TRUE (resolved): The student shows any genuine shift — partial understanding, curiosity, acknowledgment of the evidence, or recognition that their original belief might need revision.
- FALSE (unresolved): The student completely restates their original misconception without engaging with the evidence, OR shows clear confusion without any movement toward understanding.

Respond with a JSON object containing:
- "resolved": boolean
- "rationale": a one-sentence explanation of your evaluation`;

  const { experimental_output } = await generateText({
    model,
    prompt,
    experimental_output: Output.object({ schema: resolutionSchema }),
  });

  return experimental_output;
}

/**
 * Builds the system prompt for the final reveal message in the resolve stage.
 *
 * T-04-03 compliance: This is the ONLY stage where the misconception name is revealed to the
 * student. The reveal is warm, normalizing, and non-judgmental. The LLM is instructed to stay
 * under 150 words and avoid preachiness.
 */
export function buildResolveMessage(
  misconceptionName: string,
  resolved: boolean
): string {
  if (resolved) {
    return `You are wrapping up a Socratic dialogue with a student who has just shown genuine progress in their thinking.

Affirm the shift in their thinking warmly. Then reveal: "What you were exploring is actually a named scientific misconception called '${misconceptionName}'. Many curious minds have thought the same thing — including some brilliant scientists before the evidence caught up."

Rules:
- Be warm and genuine, not effusive.
- Do NOT say "Great job!" or use hollow praise.
- Do NOT lecture about what the correct answer is — they already discovered it through the dialogue.
- Keep under 150 words.
- End by encouraging their curiosity to keep exploring.`;
  }

  return `You are wrapping up a Socratic dialogue with a student who is still working through a concept.

Be kind and encouraging. Acknowledge that this topic is genuinely tricky. Then reveal: "What you were exploring is actually a named scientific misconception called '${misconceptionName}'. Many curious minds have thought the same thing — it's one of the most common ideas in science that turns out to be more complex than it first appears."

Rules:
- Be warm, not disappointed.
- Do NOT say they got it wrong or failed.
- Do NOT lecture or over-explain the correct answer.
- Keep under 150 words.
- Suggest this might be a concept worth revisiting — curiosity is the best starting point.`;
}
