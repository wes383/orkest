import {
  buildDisplayItems,
  formatDateInput,
  getAnchorDate,
  startOfDay,
  toItemFromManualRecord,
} from "./all-page-utils";
import type { DisplayItem, ManualItemRecord } from "./types/all-page";
import type { Priority } from "./types/item";
import type { TodayViewModel } from "./types/today-page";
import { getDateLocale } from "./stores/use-settings-store";
import { getBrowserTimezone } from "./timezone";

function getDateFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: getBrowserTimezone() || undefined,
  });
}

const priorityRank: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function comparePriority(left?: Priority, right?: Priority) {
  const leftRank = left ? priorityRank[left] : Number.POSITIVE_INFINITY;
  const rightRank = right ? priorityRank[right] : Number.POSITIVE_INFINITY;
  return leftRank - rightRank;
}

function compareCreatedAt(left: DisplayItem, right: DisplayItem) {
  return left.createdAt.getTime() - right.createdAt.getTime();
}

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
  if (!item.time.start || !item.time.end) {
    return false;
  }

  const currentDay = startOfDay(today).getTime();
  const startDay = startOfDay(item.time.start).getTime();
  const endDay = startOfDay(item.time.end).getTime();

  return startDay <= currentDay && currentDay <= endDay;
}

function hasNoDate(item: DisplayItem) {
  return !item.time.start && !item.time.end && !item.time.due;
}

function getTodayAnchorDate(item: DisplayItem, today: Date) {
  if (isPlannedForToday(item, today)) {
    return startOfDay(today);
  }

  if (isDateRangeCoveringToday(item, today)) {
    return startOfDay(today);
  }

  return getAnchorDate(item);
}

function getTodayDecisionDateKey(today: Date) {
  return formatDateInput(startOfDay(today));
}

function compareScheduled(left: DisplayItem, right: DisplayItem) {
  const leftStart = left.time.start?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightStart = right.time.start?.getTime() ?? Number.POSITIVE_INFINITY;

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  const priorityComparison = comparePriority(left.priority, right.priority);
  if (priorityComparison !== 0) {
    return priorityComparison;
  }

  return compareCreatedAt(left, right);
}

export function buildTodayViewModel(
  manualItems: ManualItemRecord[],
  now = new Date(),
  showCompleted = true,
): TodayViewModel {
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const displayItems = buildDisplayItems(
    manualItems
      .filter((record) => !record.deletedAt && !record.parentId)
      .map((record) => toItemFromManualRecord(record)),
  );
  const visibleDisplayItems = displayItems.filter((item) => !isDismissedForToday(item, today));

  const scheduledItems = visibleDisplayItems
    .filter((item) => {
      if (item.time.allDay) {
        return isDateRangeCoveringToday(item, today) ||
          (item.time.start && item.time.start >= today && item.time.start < tomorrow);
      }

      if (!item.time.start) {
        return false;
      }

      if (isDateRangeCoveringToday(item, today)) {
        return true;
      }

      return item.time.start >= today && item.time.start < tomorrow;
    })
    .filter((item) => showCompleted || !isCompletedLike(item))
    .sort((left, right) => {
      const leftCompleted = isCompletedLike(left);
      const rightCompleted = isCompletedLike(right);
      if (leftCompleted !== rightCompleted) {
        return leftCompleted ? 1 : -1;
      }
      return compareScheduled(left, right);
    });

  const todayScopedItems = visibleDisplayItems.filter((item) => {
    if (hasNoDate(item) && !isPlannedForToday(item, today)) {
      return false;
    }

    const anchor = getTodayAnchorDate(item, today);
    return anchor >= today && anchor < tomorrow;
  });

  return {
    dateLabel: getDateFormatter().format(today),
    summary: {
      totalToday: todayScopedItems.length,
      completedToday: todayScopedItems.filter((item) => item.status === "completed").length,
      remainingToday: todayScopedItems.filter((item) => !isCompletedLike(item)).length,
      overdueCount: visibleDisplayItems.filter((item) => {
        if (hasNoDate(item) || isPlannedForToday(item, today) || isCompletedLike(item)) {
          return false;
        }
        return getTodayAnchorDate(item, today) < today;
      }).length,
    },
    scheduledItems,
  };
}
