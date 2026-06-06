import type { TodayViewModel } from "./types/today-page";
import type { TaskSummaryDigest } from "./types/daily-digest";
import { getTimeFormatHour12 } from "./stores/use-settings-store";

export function buildTaskSummaryDigest(viewModel: TodayViewModel): TaskSummaryDigest {
  const hour12 = getTimeFormatHour12();
  const timeFormatOptions: Intl.DateTimeFormatOptions = { 
    hour: "2-digit", 
    minute: "2-digit",
    hour12 
  };

  const highPriorityTitles = viewModel.scheduledItems
    .filter((item) => item.priority === "urgent" || item.priority === "high")
    .filter((item) => item.status !== "completed" && item.status !== "cancelled" && item.status !== "skipped")
    .slice(0, 3)
    .map((item) => item.title);

  const nextUp = viewModel.scheduledItems
    .filter((item) => item.status !== "completed" && item.status !== "cancelled" && item.status !== "skipped")
    .find((item) => {
      if (!item.time.start) return false;
      return item.time.start >= new Date();
    });

  const todayTaskTitles = viewModel.scheduledItems
    .filter((item) => item.status !== "completed" && item.status !== "cancelled" && item.status !== "skipped")
    .slice(0, 10)
    .map((item) => item.title);

  // Find in-progress tasks (currently between start and end time)
  const now = new Date();
  const inProgressTasks = viewModel.scheduledItems
    .filter((item) => {
      if (item.status === "completed" || item.status === "cancelled" || item.status === "skipped") return false;
      if (!item.time.start || !item.time.end) return false;
      return now >= item.time.start && now <= item.time.end;
    })
    .map((item) => ({
      title: item.title,
      startTime: item.time.start
        ? item.time.start.toLocaleTimeString([], timeFormatOptions)
        : undefined,
      endTime: item.time.end
        ? item.time.end.toLocaleTimeString([], timeFormatOptions)
        : undefined,
    }));

  return {
    totalTasks: viewModel.summary.totalToday,
    completedTasks: viewModel.summary.completedToday,
    remainingTasks: viewModel.summary.remainingToday,
    overdueTasks: viewModel.summary.overdueCount,
    highPriorityTitles,
    nextUpTitle: nextUp?.title ?? null,
    nextUpTime: nextUp?.time.start
      ? nextUp.time.start.toLocaleTimeString([], timeFormatOptions)
      : null,
    nextUpEndTime: nextUp?.time.end
      ? nextUp.time.end.toLocaleTimeString([], timeFormatOptions)
      : null,
    todayTaskTitles,
    inProgressTasks,
  };
}

export function getTimeOfDay(now: Date = new Date()): "morning" | "afternoon" | "evening" | "night" {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function getTodayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

export function getDateKeyWithOffset(timezoneOffset: number, now: Date = new Date()): string {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const userMs = utcMs - timezoneOffset * 60_000;
  const userDate = new Date(userMs);
  return `${userDate.getFullYear()}-${String(userDate.getMonth() + 1).padStart(2, "0")}-${String(userDate.getDate()).padStart(2, "0")}`;
}

export function isAfterWakeUpTime(sleepEnd: string, now: Date = new Date()): boolean {
  const [wakeH, wakeM] = sleepEnd.split(":").map(Number);
  const wakeMinutes = wakeH * 60 + wakeM;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= wakeMinutes;
}
