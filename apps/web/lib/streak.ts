/**
 * Pure streak calculation logic, extracted from the getStreak() server action
 * so it can be tested without database or auth dependencies.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Calculate consecutive-day streak from a list of question dates.
 *
 * @param questionDates - createdAt timestamps in descending order (most recent first)
 * @param now - optional "current time" override for testing; defaults to `new Date()`
 * @returns number of consecutive days with at least one question
 *
 * Rules:
 * - Dates are normalized to UTC midnight for comparison.
 * - Duplicate dates (multiple questions on the same UTC day) count as one day.
 * - The streak may start from today OR yesterday (a streak doesn't break until
 *   the full day passes without a question).
 * - If the most recent question is older than yesterday, the streak is 0.
 */
export function calculateStreak(
  questionDates: Date[],
  now: Date = new Date(),
): number {
  if (questionDates.length === 0) return 0;

  // Deduplicate to unique UTC dates
  const uniqueDates: Date[] = [];
  const seenDates = new Set<string>();
  for (const raw of questionDates) {
    const d = new Date(raw);
    d.setUTCHours(0, 0, 0, 0);
    const key = d.toISOString();
    if (!seenDates.has(key)) {
      seenDates.add(key);
      uniqueDates.push(d);
    }
  }

  // Determine today and yesterday in UTC
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - MS_PER_DAY);

  // The most recent unique date must be today or yesterday, otherwise streak = 0
  const mostRecentDate = uniqueDates[0];
  if (
    mostRecentDate.getTime() !== today.getTime() &&
    mostRecentDate.getTime() !== yesterday.getTime()
  ) {
    return 0;
  }

  // Count consecutive days backward from the most recent question date
  let streak = 0;
  let checkDate = new Date(mostRecentDate);
  for (const date of uniqueDates) {
    if (date.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
