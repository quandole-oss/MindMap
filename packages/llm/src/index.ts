export { createLLMAdapter } from "./adapters/factory";
export { AnthropicAdapter } from "./adapters/anthropic";
export { buildEnrichSystemPrompt } from "./prompts/enrich";
export {
  buildExtractPrompt,
  extractConcepts,
  conceptExtractionSchema,
} from "./prompts/extract";
export type { ConceptExtractionResult } from "./prompts/extract";

export interface LLMAdapter {
  getModel(): unknown;
  getModelId(): string;
}
