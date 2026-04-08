export interface LLMAdapter {
  enrich(question: string, gradeband: string): Promise<unknown>;
  extractConcepts(text: string): Promise<string[]>;
  embed(text: string): Promise<number[]>;
}

export function createLLMAdapter(): LLMAdapter {
  throw new Error("LLM adapter not implemented — see Phase 2");
}
