/**
 * Embedding generation using OpenAI text-embedding-3-small (1536 dimensions).
 *
 * @requires OPENAI_API_KEY environment variable to be set.
 *
 * Security note (T-03-01): Only concept names should be passed to generateEmbedding().
 * Callers must ensure no student PII is included in the text argument.
 * Input is validated to max 500 characters before any API call.
 */
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

/** OpenAI text-embedding-3-small produces 1536-dimensional vectors */
const embeddingModel = openai.embedding("text-embedding-3-small");

/**
 * Generate a 1536-dimension embedding vector for the given text.
 *
 * @param text - The concept name or short phrase to embed.
 *   Must be non-empty and no longer than 500 characters.
 * @returns A number array of length 1536.
 * @throws Error if text is empty or exceeds 500 characters.
 * @throws Error if the OpenAI API call fails (no OPENAI_API_KEY set, network error, etc.).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("generateEmbedding: text must not be empty");
  }
  if (text.length > 500) {
    throw new Error(
      `generateEmbedding: text exceeds 500 characters (got ${text.length}). ` +
        "Pass only concept names, not full sentences or paragraphs."
    );
  }

  const { embedding } = await embed({
    model: embeddingModel,
    value: text.trim(),
  });

  return embedding;
}
