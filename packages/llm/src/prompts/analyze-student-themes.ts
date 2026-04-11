/**
 * PRIV-01 compliance: This function's signature accepts only anonymized aggregate
 * counts, library IDs (theme slugs + misconception IDs from the static YAML library),
 * session outcome enums, and a grade band. It MUST NOT accept a userId, studentId,
 * email, enrollment record, session record, or any other object containing student
 * identifiers.
 *
 * Student identity binding (e.g., "Lila shows substance-based reasoning") happens
 * in the CALLING component layer AFTER this function returns, by correlating
 * returned theme IDs against a parallel data structure the caller already holds.
 *
 * Pattern source: packages/llm/src/prompts/diagnose-resolve.ts:47-55
 *
 * Design rationale: the prompt explicitly instructs the LLM to surface
 * CROSS-misconception PATTERNS rather than enumerate misconceptions one by one,
 * so the narrative is not a duplicate of the knowledge graph drill-down.
 */
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLLMAdapter } from "../adapters/factory";

export const studentThemeAnalysisSchema = z.object({
  dominantThemes: z.array(z.string()).min(1).max(3),
  narrative: z.string().min(60),
  supportingMisconceptionIds: z.array(z.string()).min(1),
});

export type StudentThemeAnalysis = z.infer<typeof studentThemeAnalysisSchema>;

type AnalyzeStudentThemesParams = {
  // PRIV-01: the four anonymized fields exposed by getStudentThemeProfile().
  gradeBand: "K-5" | "6-8" | "9-12";
  themeCounts: Record<string, number>; // themeId -> observed count
  misconceptionIds: string[]; // library IDs only
  sessionOutcomes: Array<"resolved" | "unresolved" | "incomplete">;
};

function buildAnalysisPrompt(params: AnalyzeStudentThemesParams): string {
  const { gradeBand, themeCounts, misconceptionIds, sessionOutcomes } = params;

  const sortedThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => `  - ${id} (observed ${count} time${count === 1 ? "" : "s"})`)
    .join("\n");

  const outcomeTally = sessionOutcomes.reduce<Record<string, number>>((acc, o) => {
    acc[o] = (acc[o] ?? 0) + 1;
    return acc;
  }, {});
  const outcomeSummary = Object.entries(outcomeTally)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const vocabGuidance = {
    "K-5": "Use simple vocabulary suitable for grades K-5. Avoid technical jargon.",
    "6-8": "Use vocabulary appropriate for middle school (grades 6-8).",
    "9-12": "Use vocabulary appropriate for high school (grades 9-12).",
  }[gradeBand];

  return `You are a science education researcher synthesizing a learner profile. You will NOT be told who this learner is — only their anonymized diagnostic history. Your job is to surface cross-cutting patterns that explain WHY this learner keeps running into related misconceptions.

Theoretical framing: Vosniadou's framework theory + Chi's ontological category error framing. Students typically share a handful of deep framework-level commitments (e.g., "energy is a substance", "perception equals reality") that generate many surface-level misconceptions across topics. Your narrative must surface these framework-level patterns — NOT enumerate the individual misconceptions the learner holds.

## Anonymized learner profile
- grade_band: ${gradeBand}
- ${vocabGuidance}

### Observed themes (sorted by frequency)
${sortedThemes || "  (no themes observed)"}

### Observed misconception library IDs
${misconceptionIds.map((id) => `  - ${id}`).join("\n") || "  (none)"}

### Session outcomes
${outcomeSummary || "(none)"}

## Your task
Produce a JSON object with these fields:
- dominantThemes: 1-3 theme ids that best explain the cross-misconception pattern. Each MUST be a key from the "Observed themes" block above.
- narrative: 2-4 sentences (min 60 chars) describing the framework-level pattern you see. The narrative MUST surface CROSS-misconception patterns. Do NOT enumerate the individual misconceptions one by one.
- supportingMisconceptionIds: 1+ misconception ids from the "Observed misconception library IDs" block that support the dominant themes.

## Rules
1. Identify 1-3 dominant themes ONLY when supported by >=2 observed misconceptions or sessions. If only one misconception is observed, still return one theme but keep the narrative tentative.
2. Every supportingMisconceptionId MUST come from the "Observed misconception library IDs" block above — do not invent ids.
3. Every dominantTheme MUST come from the "Observed themes" block above — do not invent theme ids.
4. The narrative MUST cross-reference at least two misconceptions as a PATTERN. Do not simply list what was observed.
5. Do NOT mention any individual student — you have not been given one. Write in third-person learner voice ("this learner"), never use placeholder names or identifiers.
6. Return ONLY the JSON object, no prose.`;
}

/**
 * PRIV-01 note: parameter shape is structurally locked to four anonymized fields.
 * See the file-level docblock for the full contract.
 */
export async function analyzeStudentThemes(
  params: AnalyzeStudentThemesParams
): Promise<StudentThemeAnalysis> {
  const adapter = createLLMAdapter();
  const model = adapter.getModel();
  const prompt = buildAnalysisPrompt(params);

  try {
    const { experimental_output } = await generateText({
      model,
      prompt,
      temperature: 0.4,
      experimental_output: Output.object({ schema: studentThemeAnalysisSchema }),
    });

    return experimental_output;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`analyzeStudentThemes failed: ${message}`);
  }
}
