import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLLMAdapter } from "../adapters/factory";
import { AnthropicAdapter } from "../adapters/anthropic";

describe("createLLMAdapter", () => {
  const originalEnv = process.env.LLM_PROVIDER;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalEnv;
    }
  });

  it("returns an adapter when LLM_PROVIDER is not set (defaults to anthropic)", () => {
    delete process.env.LLM_PROVIDER;
    const adapter = createLLMAdapter();
    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  it("returns an AnthropicAdapter when LLM_PROVIDER=anthropic", () => {
    process.env.LLM_PROVIDER = "anthropic";
    const adapter = createLLMAdapter();
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  it("throws when LLM_PROVIDER is an unknown value", () => {
    process.env.LLM_PROVIDER = "invalid-provider";
    expect(() => createLLMAdapter()).toThrow("Unknown LLM provider: invalid-provider");
  });

  it("throws with the provider name in the error message", () => {
    process.env.LLM_PROVIDER = "openai";
    expect(() => createLLMAdapter()).toThrow("Unknown LLM provider: openai");
  });
});

describe("AnthropicAdapter", () => {
  it("has a getModelId method returning the model string", () => {
    const adapter = new AnthropicAdapter();
    expect(adapter.getModelId()).toBe("claude-sonnet-4-20250514");
  });

  it("has a getModel method", () => {
    const adapter = new AnthropicAdapter();
    expect(typeof adapter.getModel).toBe("function");
  });
});
