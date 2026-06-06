import type { ManualItemRecord, DisplayItem } from "./types/all-page";
import {
  buildDisplayItems,
  startOfDay,
  toItemFromManualRecord,
  formatDateInput,
} from "./all-page-utils";

function isCompletedLike(item: DisplayItem) {
  return item.status === "completed" || item.status === "cancelled" || item.status === "skipped";
}

function isDismissedForToday(item: DisplayItem, today: Date) {
  return (item.dismissedTodayDates ?? []).includes(getTodayDecisionDateKey(today));
}

function isPlannedForToday(item: DisplayItem, today: Date) {
  return (item.plannedTodayDates ?? []).includes(getTodayDecisionDateKey(today));
}

function isDateRangeCoveringToday(item: DisplayItem, today: Date) {
  if (!item.time.start || !item.time.end) return false;
  const currentDay = startOfDay(today).getTime();
  const startDay = startOfDay(item.time.start).getTime();
  const endDay = startOfDay(item.time.end).getTime();
  return startDay <= currentDay && currentDay <= endDay;
}

function hasNoDate(item: DisplayItem) {
  return !item.time.start && !item.time.end && !item.time.due;
}

function getTodayDecisionDateKey(today: Date) {
  return formatDateInput(startOfDay(today));
}

export function buildFocusViewModel(
  manualItems: ManualItemRecord[],
  now = new Date(),
): DisplayItem[] {
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const displayItems = buildDisplayItems(
    manualItems
      .filter((record) => !record.deletedAt && !record.parentId)
      .map((record) => toItemFromManualRecord(record)),
  );
  const visibleDisplayItems = displayItems.filter((item) => !isDismissedForToday(item, today));

  const todayItems = visibleDisplayItems
    .filter((item) => {
      if (isCompletedLike(item)) return false;

      if (item.time.allDay) {
        return (
          isDateRangeCoveringToday(item, today) ||
          (item.time.start && item.time.start >= today && item.time.start < tomorrow)
        );
      }

      if (!item.time.start) {
        return hasNoDate(item) && isPlannedForToday(item, today);
      }

      if (isDateRangeCoveringToday(item, today)) return true;
      return item.time.start >= today && item.time.start < tomorrow;
    })
    .sort((a, b) => {
      const aStart = a.time.start?.getTime() ?? Number.POSITIVE_INFINITY;
      const bStart = b.time.start?.getTime() ?? Number.POSITIVE_INFINITY;
      return aStart - bStart;
    });

  return todayItems;
}

export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds >= 60) {
    const minutes = Math.ceil(totalSeconds / 60);
    return String(minutes);
  }
  if (totalSeconds === 0) {
    return "0";
  }
  return `:${String(totalSeconds)}`;
}

export function formatStopwatch(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}
