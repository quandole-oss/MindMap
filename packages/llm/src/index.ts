export { createLLMAdapter } from "./adapters/factory";
export { AnthropicAdapter } from "./adapters/anthropic";
export { buildEnrichSystemPrompt } from "./prompts/enrich";
export {
  buildExtractPrompt,
  extractConcepts,
  conceptExtractionSchema,
} from "./prompts/extract";
export type { ConceptExtractionResult } from "./prompts/extract";
export { generateEmbedding } from "./embeddings";
export { disambiguateConcept, buildDisambiguatePrompt } from "./prompts/disambiguate";
export { buildProbeSystemPrompt } from "./prompts/diagnose-probe";
export { buildConfrontSystemPrompt } from "./prompts/diagnose-confront";
export { evaluateResolution, buildResolveMessage } from "./prompts/diagnose-resolve";
export type { ResolutionResult } from "./prompts/diagnose-resolve";
export { generateLessonPlan, lessonPlanSchema } from "./prompts/generate-lesson-plan";
export type { LessonPlan } from "./prompts/generate-lesson-plan";
export {
  analyzeStudentThemes,
  studentThemeAnalysisSchema,
} from "./prompts/analyze-student-themes";
export type { StudentThemeAnalysis } from "./prompts/analyze-student-themes";

export interface LLMAdapter {
  getModel(): unknown;
  getModelId(): string;
}
