import { z } from "zod";
import { generateText, Output } from "ai";
import { createLLMAdapter } from "../adapters/factory";

export const conceptExtractionSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string(),
      domain: z.enum(["physics", "biology", "math", "history", "general"]),
    })
  ),
});

export type ConceptExtractionResult = z.infer<typeof conceptExtractionSchema>;

export function buildExtractPrompt(question: string, answer: string): string {
  return `Extract the 2-6 core educational concepts from the following student question and answer. For each concept, identify the most relevant domain.

Student question: ${question}

Answer: ${answer}

Return a JSON object with a "concepts" array. Each concept should have a "name" (short descriptive label) and "domain" (one of: physics, biology, math, history, general).`;
}

export async function extractConcepts(
  question: string,
  answer: string
): Promise<Array<{ name: string; domain: string }>> {
  const adapter = createLLMAdapter();
  const model = adapter.getModel();
  const prompt = buildExtractPrompt(question, answer);

  const { experimental_output } = await generateText({
    model,
    prompt,
    experimental_output: Output.object({ schema: conceptExtractionSchema }),
  });

  return experimental_output.concepts;
}
