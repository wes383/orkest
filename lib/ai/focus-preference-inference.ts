import type { FocusSession } from "@/lib/types/focus-page";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export interface InferredFocusPreference {
  topTimeOfDays: TimeOfDay[];
  topHours: number[];
  totalMinutesByTimeOfDay: Record<TimeOfDay, number>;
  totalMinutesByHour: Record<number, number>;
  confidence: "high" | "medium" | "low";
}

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function inferFocusPreference(sessions: FocusSession[]): InferredFocusPreference {
  if (sessions.length === 0) {
    return {
      topTimeOfDays: [],
      topHours: [],
      totalMinutesByTimeOfDay: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      totalMinutesByHour: {},
      confidence: "low",
    };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recentSessions = sessions.filter((s) => new Date(s.startedAt) >= cutoff);
  const sessionsToUse = recentSessions.length >= 3 ? recentSessions : sessions;

  const byTimeOfDay: Record<TimeOfDay, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const byHour: Record<number, number> = {};

  for (const session of sessionsToUse) {
    const start = new Date(session.startedAt);
    const hour = start.getHours();
    const minutes = Math.floor(session.durationSeconds / 60);

    const tod = getTimeOfDay(hour);
    byTimeOfDay[tod] += minutes;
    byHour[hour] = (byHour[hour] ?? 0) + minutes;
  }

  const sortedTimeOfDays = (Object.entries(byTimeOfDay) as [TimeOfDay, number][])
    .filter(([, minutes]) => minutes > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([tod]) => tod);

  const sortedHours = Object.entries(byHour)
    .map(([h, m]) => ({ hour: Number(h), minutes: m }))
    .filter((e) => e.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .map((e) => e.hour);

  const totalMinutes = Object.values(byTimeOfDay).reduce((s, m) => s + m, 0);
  let confidence: "high" | "medium" | "low" = "low";
  if (totalMinutes >= 300) confidence = "high";
  else if (totalMinutes >= 60) confidence = "medium";

  return {
    topTimeOfDays: sortedTimeOfDays,
    topHours: sortedHours,
    totalMinutesByTimeOfDay: byTimeOfDay,
    totalMinutesByHour: byHour,
    confidence,
  };
}
