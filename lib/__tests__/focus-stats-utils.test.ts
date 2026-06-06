import { describe, it, expect } from "vitest";
import {
  filterSessionsByTimeRange,
  calcAverageSessionDuration,
  calcFocusEfficiency,
  calcLongestSession,
  calcTotalMinutes,
  getStreakDays,
  getHourlyDistribution,
  getTagStats,
  UNTAGGED_KEY,
} from "../focus-stats-utils";
import type { FocusSession } from "../types/focus-page";

function makeSession(
  overrides: Partial<FocusSession> = {},
): FocusSession {
  return {
    id: "s1",
    startedAt: new Date("2025-06-15T10:00:00Z"),
    durationSeconds: 1800,
    completed: true,
    ...overrides,
  };
}

describe("filterSessionsByTimeRange", () => {
  it("returns all sessions for 'all' range", () => {
    const sessions = [makeSession(), makeSession()];
    expect(filterSessionsByTimeRange(sessions, "all")).toHaveLength(2);
  });

  it("filters by today", () => {
    const today = new Date();
    const todaySession = makeSession({ startedAt: today });
    const oldSession = makeSession({ startedAt: new Date("2020-01-01") });
    const result = filterSessionsByTimeRange([todaySession, oldSession], "today");
    expect(result).toHaveLength(1);
    expect(result[0].startedAt.getTime()).toBe(today.getTime());
  });

  it("filters by week", () => {
    const today = new Date();
    const recent = makeSession({ startedAt: today });
    const old = makeSession({ startedAt: new Date("2020-01-01") });
    const result = filterSessionsByTimeRange([recent, old], "week");
    expect(result).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(filterSessionsByTimeRange([], "month")).toEqual([]);
  });
});

describe("calcAverageSessionDuration", () => {
  it("returns 0 for empty sessions", () => {
    expect(calcAverageSessionDuration([])).toBe(0);
  });

  it("calculates average correctly", () => {
    const sessions = [
      makeSession({ durationSeconds: 1000 }),
      makeSession({ durationSeconds: 2000 }),
      makeSession({ durationSeconds: 3000 }),
    ];
    expect(calcAverageSessionDuration(sessions)).toBe(2000);
  });

  it("rounds to nearest integer", () => {
    const sessions = [
      makeSession({ durationSeconds: 1000 }),
      makeSession({ durationSeconds: 1001 }),
    ];
    expect(calcAverageSessionDuration(sessions)).toBe(1001);
  });
});

describe("calcFocusEfficiency", () => {
  it("returns 0 for empty sessions", () => {
    expect(calcFocusEfficiency([])).toBe(0);
  });

  it("returns 100 when all completed", () => {
    const sessions = [
      makeSession({ completed: true }),
      makeSession({ completed: true }),
    ];
    expect(calcFocusEfficiency(sessions)).toBe(100);
  });

  it("returns correct percentage", () => {
    const sessions = [
      makeSession({ completed: true }),
      makeSession({ completed: false }),
      makeSession({ completed: true }),
      makeSession({ completed: false }),
    ];
    expect(calcFocusEfficiency(sessions)).toBe(50);
  });
});

describe("calcLongestSession", () => {
  it("returns 0 for empty sessions", () => {
    expect(calcLongestSession([])).toBe(0);
  });

  it("returns max duration", () => {
    const sessions = [
      makeSession({ durationSeconds: 600 }),
      makeSession({ durationSeconds: 3600 }),
      makeSession({ durationSeconds: 1200 }),
    ];
    expect(calcLongestSession(sessions)).toBe(3600);
  });
});

describe("calcTotalMinutes", () => {
  it("returns 0 for empty sessions", () => {
    expect(calcTotalMinutes([])).toBe(0);
  });

  it("sums durations in minutes", () => {
    const sessions = [
      makeSession({ durationSeconds: 60 }),
      makeSession({ durationSeconds: 120 }),
      makeSession({ durationSeconds: 180 }),
    ];
    expect(calcTotalMinutes(sessions)).toBe(6);
  });

  it("floors partial minutes", () => {
    const sessions = [
      makeSession({ durationSeconds: 90 }),
      makeSession({ durationSeconds: 90 }),
    ];
    // 90/60 = 1 min each, total = 2
    expect(calcTotalMinutes(sessions)).toBe(2);
  });
});

describe("getStreakDays", () => {
  it("returns 0 for empty sessions", () => {
    expect(getStreakDays([])).toBe(0);
  });

  it("counts consecutive days backwards from today", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const sessions = [
      makeSession({ startedAt: today, completed: true }),
      makeSession({ startedAt: yesterday, completed: true }),
      makeSession({ startedAt: twoDaysAgo, completed: true }),
    ];
    expect(getStreakDays(sessions)).toBe(3);
  });

  it("breaks streak when a day is missing", () => {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const sessions = [
      makeSession({ startedAt: today, completed: true }),
      makeSession({ startedAt: twoDaysAgo, completed: true }),
    ];
    expect(getStreakDays(sessions)).toBe(1);
  });

  it("only counts completed sessions", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const sessions = [
      makeSession({ startedAt: today, completed: true }),
      makeSession({ startedAt: yesterday, completed: false }),
    ];
    expect(getStreakDays(sessions)).toBe(1);
  });
});

describe("getHourlyDistribution", () => {
  it("returns 24 hours with zero by default", () => {
    const dist = getHourlyDistribution([]);
    expect(dist).toHaveLength(24);
    expect(dist.every((d) => d.minutes === 0)).toBe(true);
  });

  it("aggregates minutes by start hour (local tz)", () => {
    const now = new Date();
    const sameHour1 = new Date(now);
    sameHour1.setMinutes(30);
    const sameHour2 = new Date(now);
    sameHour2.setMinutes(0);
    const hour = now.getHours();

    const sessions = [
      makeSession({ startedAt: sameHour1, durationSeconds: 3600 }),
      makeSession({ startedAt: sameHour2, durationSeconds: 1800 }),
    ];
    const dist = getHourlyDistribution(sessions);
    const entry = dist.find((d) => d.hour === hour);
    expect(entry?.minutes).toBe(90);
  });
});

describe("getTagStats", () => {
  it("returns empty array for empty sessions", () => {
    expect(getTagStats([])).toEqual([]);
  });

  it("groups untagged sessions", () => {
    const sessions = [makeSession({ tags: undefined })];
    const stats = getTagStats(sessions);
    expect(stats).toHaveLength(1);
    expect(stats[0].tag).toBe(UNTAGGED_KEY);
    expect(stats[0].count).toBe(1);
  });

  it("groups by tag", () => {
    const sessions = [
      makeSession({ tags: ["work"], durationSeconds: 3600 }),
      makeSession({ tags: ["work"], durationSeconds: 1800 }),
      makeSession({ tags: ["personal"], durationSeconds: 600 }),
    ];
    const stats = getTagStats(sessions);
    expect(stats).toHaveLength(2);
    const work = stats.find((s) => s.tag === "work");
    const personal = stats.find((s) => s.tag === "personal");
    expect(work?.minutes).toBe(90);
    expect(work?.count).toBe(2);
    expect(personal?.minutes).toBe(10);
    expect(personal?.count).toBe(1);
  });

  it("sorts by minutes descending", () => {
    const sessions = [
      makeSession({ tags: ["a"], durationSeconds: 600 }),
      makeSession({ tags: ["b"], durationSeconds: 3600 }),
    ];
    const stats = getTagStats(sessions);
    expect(stats[0].tag).toBe("b");
    expect(stats[1].tag).toBe("a");
  });
});
