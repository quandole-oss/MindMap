import type { GradeBand } from "@mindmap/misconceptions";

/**
 * Maps a numeric grade level to a grade band string.
 *
 * 0-5  -> "K-5"
 * 6-8  -> "6-8"
 * 9-12 -> "9-12"
 */
export function gradeLevelToGradeBand(gradeLevel: number): GradeBand {
  if (gradeLevel <= 5) return "K-5";
  if (gradeLevel <= 8) return "6-8";
  return "9-12";
}
