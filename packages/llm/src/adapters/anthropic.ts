import { anthropic } from "@ai-sdk/anthropic";

export class AnthropicAdapter {
  private readonly modelId = "claude-sonnet-4-20250514";

  getModel() {
    return anthropic(this.modelId);
  }

  getModelId(): string {
    return this.modelId;
  }
}
