import type { FocusSession } from "./types/focus-page";

export const UNTAGGED_KEY = "__untagged__";

export type TimeRange = "today" | "week" | "month" | "year" | "all";

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function filterSessionsByTimeRange(sessions: FocusSession[], range: TimeRange): FocusSession[] {
  if (range === "all") return sessions;

  const now = new Date();
  let startDate: Date;

  switch (range) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week": {
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      break;
    }
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
  }

  return sessions.filter((s) => new Date(s.startedAt) >= startDate);
}

export function calcAverageSessionDuration(sessions: FocusSession[]): number {
  if (sessions.length === 0) return 0;
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  return Math.round(totalSeconds / sessions.length);
}

export function calcFocusEfficiency(sessions: FocusSession[]): number {
  if (sessions.length === 0) return 0;
  const completedCount = sessions.filter((s) => s.completed).length;
  return Math.round((completedCount / sessions.length) * 100);
}

export function calcLongestSession(sessions: FocusSession[]): number {
  if (sessions.length === 0) return 0;
  return Math.max(...sessions.map((s) => s.durationSeconds));
}

export function calcTotalMinutes(sessions: FocusSession[]): number {
  return sessions.reduce((sum, s) => sum + Math.floor(s.durationSeconds / 60), 0);
}

export function getStreakDays(allSessions: FocusSession[]): number {
  if (allSessions.length === 0) return 0;

  const sessionDates = new Set<string>();
  for (const session of allSessions) {
    if (session.completed) {
      sessionDates.add(getDateKey(new Date(session.startedAt)));
    }
  }

  const today = new Date();
  let streak = 0;
  const currentDate = new Date(today);

  while (true) {
    const dateKey = getDateKey(currentDate);
    if (sessionDates.has(dateKey)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function getHourlyDistribution(sessions: FocusSession[]): { hour: number; minutes: number }[] {
  const hourMap = new Map<number, number>();

  for (let h = 0; h < 24; h++) {
    hourMap.set(h, 0);
  }

  for (const session of sessions) {
    const startHour = new Date(session.startedAt).getHours();
    const minutes = Math.floor(session.durationSeconds / 60);
    hourMap.set(startHour, (hourMap.get(startHour) ?? 0) + minutes);
  }

  return Array.from(hourMap.entries()).map(([hour, minutes]) => ({ hour, minutes }));
}

export function getTagStats(sessions: FocusSession[]): { tag: string; minutes: number; count: number }[] {
  const tagMap = new Map<string, { minutes: number; count: number }>();

  for (const session of sessions) {
    const minutes = Math.floor(session.durationSeconds / 60);
    const tags = session.tags ?? [];

    if (tags.length === 0) {
      const existing = tagMap.get(UNTAGGED_KEY) ?? { minutes: 0, count: 0 };
      tagMap.set(UNTAGGED_KEY, { minutes: existing.minutes + minutes, count: existing.count + 1 });
    } else {
      for (const tag of tags) {
        const existing = tagMap.get(tag) ?? { minutes: 0, count: 0 };
        tagMap.set(tag, { minutes: existing.minutes + minutes, count: existing.count + 1 });
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, stats]) => ({ tag, ...stats }))
    .sort((a, b) => b.minutes - a.minutes);
}
