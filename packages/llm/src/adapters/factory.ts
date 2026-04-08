import { AnthropicAdapter } from "./anthropic";

export type LLMAdapterInstance = AnthropicAdapter;

export function createLLMAdapter(): AnthropicAdapter {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";

  if (provider === "anthropic") {
    return new AnthropicAdapter();
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}
