import { describe, it, expect } from "vitest";
import { calculateStreak } from "../streak";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

/**
 * A fixed "now" so tests are deterministic and don't depend on wall-clock time.
 * 2026-04-14T12:00:00Z (noon UTC on a Tuesday)
 */
const NOW = new Date("2026-04-14T12:00:00Z");

/** Return a Date that is `n` UTC days before `NOW`, at the given UTC hour. */
function daysAgo(n: number, hour = 12): Date {
  const d = new Date(NOW.getTime() - n * MS_PER_DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

/** Shorthand: return today at a specific UTC hour. */
function today(hour = 12): Date {
  return daysAgo(0, hour);
}

/** Shorthand: return yesterday at a specific UTC hour. */
function yesterday(hour = 12): Date {
  return daysAgo(1, hour);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateStreak", () => {
  // ---- Empty / base cases ------------------------------------------------

  it("returns 0 for an empty array", () => {
    expect(calculateStreak([], NOW)).toBe(0);
  });

  // ---- Single-question cases ---------------------------------------------

  it("returns 1 for a single question asked today", () => {
    expect(calculateStreak([today()], NOW)).toBe(1);
  });

  it("returns 1 for a single question asked yesterday", () => {
    expect(calculateStreak([yesterday()], NOW)).toBe(1);
  });

  it("returns 0 for a single question asked 2 days ago", () => {
    // 2 days ago is neither today nor yesterday, so streak is broken
    expect(calculateStreak([daysAgo(2)], NOW)).toBe(0);
  });

  // ---- Multi-day consecutive streaks ------------------------------------

  it("returns 3 for three consecutive days ending today", () => {
    const dates = [today(), yesterday(), daysAgo(2)];
    expect(calculateStreak(dates, NOW)).toBe(3);
  });

  it("returns 3 for three consecutive days ending yesterday", () => {
    // No question today, but streak hasn't broken yet
    const dates = [yesterday(), daysAgo(2), daysAgo(3)];
    expect(calculateStreak(dates, NOW)).toBe(3);
  });

  it("returns 7 for a full week streak ending today", () => {
    const dates = Array.from({ length: 7 }, (_, i) => daysAgo(i));
    expect(calculateStreak(dates, NOW)).toBe(7);
  });

  // ---- Gap in streak ----------------------------------------------------

  it("returns 2 when there is a gap (today, yesterday, skip, 3 days ago)", () => {
    // Days: today(0), yesterday(1), [gap at 2], 3 days ago
    const dates = [today(), yesterday(), daysAgo(3)];
    expect(calculateStreak(dates, NOW)).toBe(2);
  });

  it("returns 1 when today has a question but yesterday is missing", () => {
    const dates = [today(), daysAgo(2), daysAgo(3)];
    expect(calculateStreak(dates, NOW)).toBe(1);
  });

  // ---- Deduplication (multiple questions on the same UTC day) ------------

  it("counts multiple questions on the same day as 1 streak day", () => {
    // Three questions today at different hours
    const dates = [today(18), today(12), today(6)];
    expect(calculateStreak(dates, NOW)).toBe(1);
  });

  it("deduplicates correctly within a multi-day streak", () => {
    // 2 questions today, 3 questions yesterday, 1 two days ago
    const dates = [
      today(20),
      today(8),
      yesterday(23),
      yesterday(15),
      yesterday(7),
      daysAgo(2, 12),
    ];
    expect(calculateStreak(dates, NOW)).toBe(3);
  });

  // ---- Cross-month boundary ---------------------------------------------

  it("handles cross-month boundary (March 31 -> April 1)", () => {
    // Use a "now" that is April 1
    const april1 = new Date("2026-04-01T12:00:00Z");
    const march31 = new Date("2026-03-31T14:00:00Z");
    const march30 = new Date("2026-03-30T10:00:00Z");

    const dates = [april1, march31, march30];
    expect(calculateStreak(dates, april1)).toBe(3);
  });

  // ---- Cross-year boundary ----------------------------------------------

  it("handles cross-year boundary (Dec 31 -> Jan 1)", () => {
    const jan1 = new Date("2027-01-01T12:00:00Z");
    const dec31 = new Date("2026-12-31T14:00:00Z");
    const dec30 = new Date("2026-12-30T10:00:00Z");

    const dates = [jan1, dec31, dec30];
    expect(calculateStreak(dates, jan1)).toBe(3);
  });

  // ---- Timezone edge cases ----------------------------------------------

  it("treats UTC 23:59 and UTC 00:01 next day as different streak days", () => {
    // These are two different UTC dates even though only 2 minutes apart
    const lateNight = new Date("2026-04-13T23:59:00Z"); // Apr 13 UTC
    const earlyMorning = new Date("2026-04-14T00:01:00Z"); // Apr 14 UTC

    // earlyMorning is "today" (Apr 14), lateNight is "yesterday" (Apr 13)
    const dates = [earlyMorning, lateNight];
    expect(calculateStreak(dates, NOW)).toBe(2);
  });

  it("treats two timestamps on the same UTC day as one streak day", () => {
    // Both are Apr 14 UTC
    const earlyMorning = new Date("2026-04-14T00:01:00Z");
    const lateEvening = new Date("2026-04-14T23:59:00Z");

    // descending order
    const dates = [lateEvening, earlyMorning];
    expect(calculateStreak(dates, NOW)).toBe(1);
  });

  // ---- Long streak ------------------------------------------------------

  it("counts a 30-day streak correctly", () => {
    const dates = Array.from({ length: 30 }, (_, i) => daysAgo(i));
    expect(calculateStreak(dates, NOW)).toBe(30);
  });

  // ---- Streak starting from yesterday (grace period) --------------------

  it("allows streak to start from yesterday (today has no question yet)", () => {
    // Student hasn't asked today, but asked yesterday and the day before
    const dates = [yesterday(), daysAgo(2), daysAgo(3), daysAgo(4)];
    expect(calculateStreak(dates, NOW)).toBe(4);
  });

  // ---- Ordering assumptions ---------------------------------------------

  it("handles dates already in descending order (most recent first)", () => {
    const dates = [today(), yesterday(), daysAgo(2)];
    expect(calculateStreak(dates, NOW)).toBe(3);
  });

  // ---- Edge: streak broken long ago -------------------------------------

  it("returns 0 when all questions are from a week ago", () => {
    const dates = [daysAgo(7), daysAgo(8), daysAgo(9)];
    expect(calculateStreak(dates, NOW)).toBe(0);
  });

  // ---- Edge: exactly at midnight boundary -------------------------------

  it("handles question exactly at UTC midnight as belonging to that day", () => {
    const midnightToday = new Date("2026-04-14T00:00:00.000Z");
    const midnightYesterday = new Date("2026-04-13T00:00:00.000Z");

    const dates = [midnightToday, midnightYesterday];
    expect(calculateStreak(dates, NOW)).toBe(2);
  });

  // ---- Leap year --------------------------------------------------------

  it("handles leap year boundary (Feb 28 -> Feb 29 -> Mar 1)", () => {
    // 2028 is a leap year
    const mar1 = new Date("2028-03-01T12:00:00Z");
    const feb29 = new Date("2028-02-29T12:00:00Z");
    const feb28 = new Date("2028-02-28T12:00:00Z");

    const dates = [mar1, feb29, feb28];
    expect(calculateStreak(dates, mar1)).toBe(3);
  });
});
