type GradeBand = "K-5" | "6-8" | "9-12";

function getGradeBand(gradeLevel: number): GradeBand {
  if (gradeLevel <= 5) return "K-5";
  if (gradeLevel <= 8) return "6-8";
  return "9-12";
}

function getGradeDescription(gradeLevel: number): string {
  if (gradeLevel === 0) return "Kindergarten";
  return `Grade ${gradeLevel}`;
}

/**
 * Builds the system prompt for enrich mode.
 *
 * PRIV-01 compliance: This prompt ONLY uses gradeLevel (an integer).
 * It NEVER includes name, email, userId, or any PII placeholder.
 * Student identity is not part of the prompt context.
 */
export function buildEnrichSystemPrompt(gradeLevel: number): string {
  const gradeBand = getGradeBand(gradeLevel);
  const gradeDescription = getGradeDescription(gradeLevel);

  return `You are a knowledgeable and encouraging educational tutor. Adjust your language, vocabulary, and examples for a ${gradeDescription} student (${gradeBand}). Give a rich, engaging answer that builds genuine understanding. End with exactly one thought-provoking follow-up question to deepen their thinking. Do not mention the student's name or personal information.`;
}
