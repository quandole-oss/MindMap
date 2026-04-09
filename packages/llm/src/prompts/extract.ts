import { z } from "zod";
import { generateText, Output } from "ai";
import { createLLMAdapter } from "../adapters/factory";

export const DOMAINS = [
  "physics", "biology", "chemistry", "math", "computer-science",
  "earth-science", "astronomy", "history", "literature", "social-studies",
  "art", "music", "health", "engineering", "general"
] as const;

export const conceptExtractionSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string(),
      domain: z.enum(DOMAINS),
    })
  ),
});

export type ConceptExtractionResult = z.infer<typeof conceptExtractionSchema>;

export function buildExtractPrompt(question: string, answer: string): string {
  const domainList = DOMAINS.join(", ");
  return `Extract 2-4 core educational concepts from this student question and answer.
Prefer specific, named concepts (e.g. "photosynthesis", "Newton's first law", "plate tectonics") over vague category labels (e.g. "biology", "science processes", "physics concepts").
Each concept needs a domain from this list: ${domainList}.

<examples>
<example>
Question: Why do leaves change color in autumn?
Good: [{ name: "chlorophyll breakdown", domain: "biology" }, { name: "anthocyanin pigments", domain: "biology" }, { name: "photoperiodism", domain: "biology" }]
Bad: [{ name: "plants", domain: "biology" }, { name: "seasons", domain: "general" }, { name: "colors", domain: "general" }, { name: "nature", domain: "general" }]
</example>
<example>
Question: Why does the moon have phases?
Good: [{ name: "lunar phases", domain: "astronomy" }, { name: "Earth-Moon orbital geometry", domain: "astronomy" }]
Bad: [{ name: "moon", domain: "general" }, { name: "space", domain: "astronomy" }, { name: "light reflection", domain: "physics" }, { name: "night sky", domain: "general" }]
</example>
</examples>

Student question: ${question}

Answer: ${answer}

Return a JSON object with a "concepts" array. Each concept should have a "name" (short, specific descriptive label) and "domain" (one of: ${domainList}).`;
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
