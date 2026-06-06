import { dayjs } from "@/lib/dayjs";
import type { AiChatItemContext } from "@/lib/ai/chat-types";

type AiItemStatus = NonNullable<AiChatItemContext["status"]>;

const TERMINAL_STATUSES = new Set<AiItemStatus>(["completed", "cancelled", "skipped"]);

function getOccurrenceDateKey(value: string, timezone: string): string | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;

  return parsed.tz(timezone).format("YYYY-MM-DD");
}

function hasOccurrenceOnDate(
  occurrences: string[] | undefined,
  date: string,
  timezone: string,
) {
  return occurrences?.some((value) => getOccurrenceDateKey(value, timezone) === date) ?? false;
}

export function isRecurringOccurrenceSkippedOnDate(
  item: AiChatItemContext,
  date: string,
  timezone: string,
) {
  return hasOccurrenceOnDate(item.exdates, date, item.timezone || timezone);
}

export function isRecurringOccurrenceCompletedOnDate(
  item: AiChatItemContext,
  date: string,
  timezone: string,
) {
  return hasOccurrenceOnDate(item.completedOccurrences, date, item.timezone || timezone);
}

export function isRecurringOccurrenceReopenedOnDate(
  item: AiChatItemContext,
  date: string,
  timezone: string,
) {
  return hasOccurrenceOnDate(item.reopenedOccurrences, date, item.timezone || timezone);
}

export function getItemStatusOnDate(
  item: AiChatItemContext,
  date: string,
  timezone: string,
): AiItemStatus {
  if (!item.recurrenceType || item.recurrenceType === "none") {
    return item.status ?? "active";
  }

  if (isRecurringOccurrenceSkippedOnDate(item, date, timezone)) {
    return "skipped";
  }

  if (isRecurringOccurrenceCompletedOnDate(item, date, timezone)) {
    return "completed";
  }

  if (isRecurringOccurrenceReopenedOnDate(item, date, timezone)) {
    return "active";
  }

  return item.status ?? "active";
}

export function isItemTerminalOnDate(
  item: AiChatItemContext,
  date: string,
  timezone: string,
) {
  return TERMINAL_STATUSES.has(getItemStatusOnDate(item, date, timezone));
}

export function withItemStatusOnDate(
  item: AiChatItemContext,
  date: string,
  timezone: string,
): AiChatItemContext {
  return {
    ...item,
    status: getItemStatusOnDate(item, date, timezone),
  };
}
