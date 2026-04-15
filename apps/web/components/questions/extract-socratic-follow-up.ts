/**
 * Extracts the Socratic follow-up from the streamed answer.
 * The Socratic follow-up is the last paragraph ending with "?".
 */
export function extractSocraticFollowUp(markdown: string): { body: string; followUp: string | null } {
  // Split on double newlines to get paragraphs
  const paragraphs = markdown.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  if (paragraphs.length === 0) return { body: markdown, followUp: null };

  const last = paragraphs[paragraphs.length - 1];

  // Check if last paragraph is a question (ends with ?)
  if (last.endsWith("?")) {
    const body = paragraphs.slice(0, -1).join("\n\n");
    return { body, followUp: last };
  }

  return { body: markdown, followUp: null };
}
