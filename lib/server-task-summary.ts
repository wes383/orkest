/**
 * Server-side task summary builder.
 *
 * Replicates the frontend logic from `today-page-utils.ts` + `daily-digest-utils.ts`
 * so that cron jobs and server APIs produce identical results to the web UI.
 *
 * Key differences from the naive DB query approach:
 * - Filters out subtasks (parent_id IS NOT NULL)
 * - Expands recurring tasks via RRule (shows today's occurrence)
 * - Respects plannedTodayDates / dismissedTodayDates
 * - Handles date-range items that span across today
 * - Counts completedTasks only for today, not all-time
 */

import { rrulestr } from "rrule";

import { dayjs } from "./dayjs";
import type { Priority } from "./types/item";
import type { TaskSummaryDigest } from "./types/daily-digest";

// --- Types matching the Supabase `items` row ---

type ItemRow = {
  id: string;
  uid: string;
  title: string;
  description: string | null;
  has_time: boolean;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  all_day: boolean;
  timezone: string | null;
  due_date: string | null;
  recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrence_interval: number;
  days_of_week: number[];
  recurrence_end_type: "never" | "on_date" | "after_count";
  recurrence_end_date: string | null;
  recurrence_count: number | null;
  recurrence_bysetpos: number | null;
  priority: Priority | null;
  rrule: string | null;
  exdates: string[] | null;
  completed_occurrences: string[] | null;
  reopened_occurrences: string[] | null;
  deferred_until: string | null;
  dismissed_today_dates: string[] | null;
  planned_today_dates: string[] | null;
  now_override_date: string | null;
  parent_id: string | null;
  status: "active" | "in_progress" | "completed" | "cancelled" | "skipped";
  deleted_at: string | null;
  created_at: string;
};

// --- Internal item representation ---

interface ParsedItem {
  id: string;
  title: string;
  priority?: Priority;
  status: ItemRow["status"];
  startDate?: Date;
  endDate?: Date;
  dueDate?: Date;
  allDay: boolean;
  timezone?: string;
  rrule?: string;
  exdates: Date[];
  completedOccurrences: Date[];
  reopenedOccurrences: Date[];
  dismissedTodayDates: string[];
  plannedTodayDates: string[];
  parentId: string | null;
  createdAt: Date;
}

// --- Display item after recurring expansion ---

interface ServerDisplayItem {
  id: string;
  title: string;
  priority?: Priority;
  status: ItemRow["status"];
  startDate?: Date;
  endDate?: Date;
  dueDate?: Date;
  allDay: boolean;
  isRecurringInstance: boolean;
  occurrenceKey?: string;
}

// --- Helpers ---

function makeDate(date?: string | null, time?: string | null, tz?: string | null): Date | undefined {
  if (!date) return undefined;
  if (tz) {
    const dateStr = time ? `${date}T${time}:00` : `${date}T00:00:00`;
    return dayjs.tz(dateStr, tz).toDate();
  }
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day);
  if (time) {
    const [hours, minutes] = time.split(":").map(Number);
    value.setHours(hours, minutes, 0, 0);
  }
  return value;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isCompletedLike(status: ItemRow["status"]) {
  return status === "completed" || status === "cancelled" || status === "skipped";
}

function parseRowToItem(row: ItemRow): ParsedItem {
  const tz = row.timezone || undefined;
  return {
    id: row.id,
    title: row.title,
    priority: row.priority ?? undefined,
    status: row.status,
    startDate: makeDate(row.start_date, row.start_time, tz),
    endDate: makeDate(row.end_date, row.end_time, tz),
    dueDate: makeDate(row.due_date, undefined, tz),
    allDay: row.all_day,
    timezone: tz,
    rrule: row.rrule ?? undefined,
    exdates: (row.exdates ?? []).map((v) => new Date(v)),
    completedOccurrences: (row.completed_occurrences ?? []).map((v) => new Date(v)),
    reopenedOccurrences: (row.reopened_occurrences ?? []).map((v) => new Date(v)),
    dismissedTodayDates: row.dismissed_today_dates ?? [],
    plannedTodayDates: row.planned_today_dates ?? [],
    parentId: row.parent_id,
    createdAt: new Date(row.created_at),
  };
}

// --- Recurring task expansion ---

function getRecurrenceAnchor(item: ParsedItem): Date | undefined {
  return item.startDate ?? item.dueDate ?? item.endDate;
}

function serializeOccurrenceKey(date: Date): string {
  return date.toISOString();
}

function toRRuleComparableDate(date: Date, tz?: string): Date {
  const resolvedTz = tz || "UTC";
  const d = dayjs(date).tz(resolvedTz);
  return new Date(
    Date.UTC(d.year(), d.month(), d.date(), d.hour(), d.minute(), d.second(), d.millisecond()),
  );
}

function fromRRuleDate(date: Date, tz?: string): Date {
  const resolvedTz = tz || "UTC";
  return dayjs.tz(
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`,
    resolvedTz,
  ).toDate();
}

function shiftDateByOffset(date: Date | undefined, offsetMs: number): Date | undefined {
  if (!date) return undefined;
  return new Date(date.getTime() + offsetMs);
}

/**
 * Find the next recurring occurrence on or after the user's "today".
 * Uses `userToday` (already computed in user's timezone) instead of `new Date()`
 * to avoid server timezone mismatch.
 */
function getNextRecurringOccurrence(item: ParsedItem, userToday: Date): Date | null {
  if (!item.rrule) return null;

  const tz = item.timezone || "UTC";
  const parsedRule = rrulestr(item.rrule);
  const skippedOccurrences = new Set(
    [...item.exdates, ...item.completedOccurrences].map(serializeOccurrenceKey),
  );
  let cursor = toRRuleComparableDate(userToday, tz);

  for (let i = 0; i < 2048; i++) {
    const rawOccurrence = parsedRule.after(cursor, true);
    if (!rawOccurrence) return null;

    const occurrence = fromRRuleDate(rawOccurrence, tz);
    const occurrenceKey = serializeOccurrenceKey(occurrence);
    if (!skippedOccurrences.has(occurrenceKey)) {
      return occurrence;
    }
    cursor = toRRuleComparableDate(new Date(occurrence.getTime() + 1000), tz);
  }
  return null;
}

function createRecurringDisplayItem(
  item: ParsedItem,
  occurrenceDate: Date,
  status: ItemRow["status"],
): ServerDisplayItem | null {
  const anchorDate = getRecurrenceAnchor(item);
  if (!anchorDate) return null;

  const offsetMs = occurrenceDate.getTime() - anchorDate.getTime();

  return {
    id: item.id,
    title: item.title,
    priority: item.priority,
    status,
    startDate: shiftDateByOffset(item.startDate, offsetMs),
    endDate: shiftDateByOffset(item.endDate, offsetMs),
    dueDate: item.startDate ? shiftDateByOffset(item.dueDate, offsetMs) : item.dueDate,
    allDay: item.allDay,
    isRecurringInstance: true,
    occurrenceKey: serializeOccurrenceKey(occurrenceDate),
  };
}

function getCompletedRecurringDisplayItems(item: ParsedItem): ServerDisplayItem[] {
  const excludedOccurrences = new Set(item.exdates.map(serializeOccurrenceKey));
  return item.completedOccurrences
    .filter((occ) => !excludedOccurrences.has(serializeOccurrenceKey(occ)))
    .sort((a, b) => a.getTime() - b.getTime())
    .map((occ) => createRecurringDisplayItem(item, occ, "completed"))
    .filter((v): v is ServerDisplayItem => v !== null);
}

function getReopenedRecurringDisplayItems(item: ParsedItem): ServerDisplayItem[] {
  const excludedOccurrences = new Set(item.exdates.map(serializeOccurrenceKey));
  const completedSet = new Set(item.completedOccurrences.map(serializeOccurrenceKey));
  return item.reopenedOccurrences
    .filter((occ) => {
      const key = serializeOccurrenceKey(occ);
      return !excludedOccurrences.has(key) && !completedSet.has(key);
    })
    .sort((a, b) => a.getTime() - b.getTime())
    .map((occ) => createRecurringDisplayItem(item, occ, "active"))
    .filter((v): v is ServerDisplayItem => v !== null);
}

function getNextPendingRecurringDisplayItem(item: ParsedItem, userToday: Date): ServerDisplayItem | null {
  const occurrenceDate = getNextRecurringOccurrence(item, userToday);
  if (!occurrenceDate) return null;
  return createRecurringDisplayItem(item, occurrenceDate, "active");
}

function isRecurringItem(item: ParsedItem): boolean {
  return Boolean(item.rrule);
}

// --- Build display items (mirrors frontend buildDisplayItems) ---

function buildServerDisplayItems(items: ParsedItem[], userToday: Date): ServerDisplayItem[] {
  const displayItems = items
    .filter((item) => !item.parentId)
    .flatMap((item) => {
      if (item.status === "completed" && !isRecurringItem(item)) {
        return [{ ...item, isRecurringInstance: false }] as ServerDisplayItem[];
      }

      if (!isRecurringItem(item)) {
        return [{ ...item, isRecurringInstance: false }] as ServerDisplayItem[];
      }

      const completedItems = getCompletedRecurringDisplayItems(item);
      const reopenedItems = getReopenedRecurringDisplayItems(item);
      const nextPendingItem = getNextPendingRecurringDisplayItem(item, userToday);

      return nextPendingItem
        ? [...completedItems, ...reopenedItems, nextPendingItem]
        : [...completedItems, ...reopenedItems];
    });

  // Deduplicate
  const unique = new Map<string, ServerDisplayItem>();
  for (const item of displayItems) {
    const key = `${item.id}:${item.occurrenceKey ?? "base"}`;
    unique.set(key, item);
  }
  return Array.from(unique.values());
}

// --- Today view logic (mirrors frontend buildTodayViewModel) ---

function isDateRangeCoveringToday(item: ServerDisplayItem, today: Date): boolean {
  if (!item.startDate || !item.endDate) return false;
  const currentDay = startOfDay(today).getTime();
  const startDay = startOfDay(item.startDate).getTime();
  const endDay = startOfDay(item.endDate).getTime();
  return startDay <= currentDay && currentDay <= endDay;
}

function isPlannedForToday(item: ServerDisplayItem, plannedTodayDates: string[], today: Date): boolean {
  return plannedTodayDates.includes(formatDateKey(today));
}

function hasNoDate(item: ServerDisplayItem): boolean {
  return !item.startDate && !item.endDate && !item.dueDate;
}

function getTodayAnchorDate(item: ServerDisplayItem, plannedTodayDates: string[], today: Date): Date | undefined {
  if (isPlannedForToday(item, plannedTodayDates, today)) {
    return startOfDay(today);
  }
  if (isDateRangeCoveringToday(item, today)) {
    return startOfDay(today);
  }
  return item.startDate ?? item.dueDate ?? item.endDate;
}

// --- Public API ---

export interface ServerTaskSummaryResult {
  taskSummary: TaskSummaryDigest;
  /** The text context sent to AI for motivational message generation */
  taskContext: string;
}

/**
 * Build a task summary digest from raw Supabase `items` rows,
 * using the same logic as the frontend's `buildTodayViewModel` + `buildTaskSummaryDigest`.
 *
 * @param rows - Raw rows from Supabase `items` table (must include all relevant columns)
 * @param todayKey - Date key in YYYY-MM-DD format for the target day
 * @param timezoneOffset - User's timezone offset in minutes (same as `new Date().getTimezoneOffset()`)
 */
export function buildServerTaskSummary(
  rows: ItemRow[],
  todayKey: string,
  timezoneOffset: number,
): ServerTaskSummaryResult {
  // Compute "today" in user's local timezone (same formula as getDateKeyWithOffset)
  const nowUtc = new Date();
  const utcMs = nowUtc.getTime() + nowUtc.getTimezoneOffset() * 60_000;
  const userMs = utcMs - timezoneOffset * 60_000;
  const userToday = new Date(userMs);
  userToday.setHours(0, 0, 0, 0);

  const tomorrow = new Date(userToday);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Parse rows, filter deleted
  const parsedItems = rows
    .filter((row) => !row.deleted_at)
    .map(parseRowToItem);

  // Build a map of dismissed/planned dates per item id
  const dismissedMap = new Map<string, string[]>();
  const plannedMap = new Map<string, string[]>();
  for (const item of parsedItems) {
    dismissedMap.set(item.id, item.dismissedTodayDates);
    plannedMap.set(item.id, item.plannedTodayDates);
  }

  // Build display items (expands recurring), passing userToday for RRule search
  const displayItems = buildServerDisplayItems(parsedItems, userToday);

  // Filter out dismissed items
  const visibleItems = displayItems.filter((item) => {
    const dismissed = dismissedMap.get(item.id) ?? [];
    return !dismissed.includes(formatDateKey(userToday));
  });

  // --- scheduledItems (mirrors frontend) ---
  const scheduledItems = visibleItems
    .filter((item) => {
      if (item.allDay) {
        return (
          isDateRangeCoveringToday(item, userToday) ||
          (item.startDate && item.startDate >= userToday && item.startDate < tomorrow)
        );
      }
      if (!item.startDate) return false;
      if (isDateRangeCoveringToday(item, userToday)) return true;
      return item.startDate >= userToday && item.startDate < tomorrow;
    })
    .sort((a, b) => {
      const aCompleted = isCompletedLike(a.status);
      const bCompleted = isCompletedLike(b.status);
      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
      const aStart = a.startDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bStart = b.startDate?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aStart !== bStart) return aStart - bStart;
      return 0;
    });

  // --- todayScopedItems (mirrors frontend for summary stats) ---
  const todayScopedItems = visibleItems.filter((item) => {
    if (hasNoDate(item) && !isPlannedForToday(item, plannedMap.get(item.id) ?? [], userToday)) {
      return false;
    }
    const anchor = getTodayAnchorDate(item, plannedMap.get(item.id) ?? [], userToday);
    if (!anchor) return false;
    return anchor >= userToday && anchor < tomorrow;
  });

  // --- Overdue ---
  const overdueCount = visibleItems.filter((item) => {
    if (hasNoDate(item) || isPlannedForToday(item, plannedMap.get(item.id) ?? [], userToday) || isCompletedLike(item.status)) {
      return false;
    }
    const anchor = getTodayAnchorDate(item, plannedMap.get(item.id) ?? [], userToday);
    if (!anchor) return false;
    return anchor < userToday;
  }).length;

  // --- Build TaskSummaryDigest (mirrors frontend buildTaskSummaryDigest) ---
  const activeScheduled = scheduledItems.filter((item) => !isCompletedLike(item.status));

  const highPriorityTitles = activeScheduled
    .filter((item) => item.priority === "urgent" || item.priority === "high")
    .slice(0, 3)
    .map((item) => item.title);

  const nextUp = activeScheduled.find((item) => {
    if (!item.startDate) return false;
    return item.startDate >= new Date();
  });

  const todayTaskTitles = activeScheduled.slice(0, 10).map((item) => item.title);

  const taskSummary: TaskSummaryDigest = {
    totalTasks: todayScopedItems.length,
    completedTasks: todayScopedItems.filter((item) => item.status === "completed").length,
    remainingTasks: todayScopedItems.filter((item) => !isCompletedLike(item.status)).length,
    overdueTasks: overdueCount,
    highPriorityTitles,
    nextUpTitle: nextUp?.title ?? null,
    nextUpTime: nextUp?.startDate
      ? nextUp.startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null,
    todayTaskTitles,
  };

  // --- Build taskContext string (mirrors frontend /api/daily-digest) ---
  const taskContext = [
    `Total tasks today: ${taskSummary.totalTasks}`,
    `Completed: ${taskSummary.completedTasks}`,
    `Remaining: ${taskSummary.remainingTasks}`,
    `Overdue: ${taskSummary.overdueTasks}`,
    taskSummary.highPriorityTitles.length > 0
      ? `High priority tasks: ${taskSummary.highPriorityTitles.join(", ")}`
      : "No high priority tasks.",
    taskSummary.todayTaskTitles.length > 0
      ? `Today's tasks:\n${taskSummary.todayTaskTitles.map((t) => `- ${t}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");

  return { taskSummary, taskContext };
}
