import type { AiActionConflict, AiActionScheduleSuggestion, AiChatItemContext } from "@/lib/ai/chat-types";
import type { ItemFormState } from "@/lib/types/all-page";
import { doesItemOccurInRange } from "@/lib/ai/candidate-search";
import { isRecurringOccurrenceSkippedOnDate } from "@/lib/ai/recurring-status";

const EMPTY_FORM: ItemFormState = {
  title: "",
  description: "",
  hasTime: false,
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
  allDay: false,
  hasDueDate: false,
  dueDate: "",
  timezone: "",
  recurrenceType: "none",
  recurrenceInterval: "1",
  daysOfWeek: Array(7).fill(false),
  recurrenceEndType: "never",
  recurrenceEndDate: "",
  recurrenceCount: "10",
  monthlyPattern: "day_of_month",
  nthWeekdayPosition: "2",
  nthWeekdayDay: 2,
  priority: undefined,
  estimateMinutes: "",
  tags: [],
  subtasks: [],
  projectId: "",
  projectName: "",
  progressIds: [],
  status: undefined,
  reminders: [],
};

export function createEmptyAiForm(): ItemFormState {
  return {
    ...EMPTY_FORM,
    daysOfWeek: [...EMPTY_FORM.daysOfWeek],
    tags: [],
    subtasks: [],
  };
}

function normalizeDaysOfWeek(days: AiChatItemContext["daysOfWeek"]): boolean[] {
  if (!days) return Array(7).fill(false);
  if (days.every((day) => typeof day === "boolean")) {
    return days as boolean[];
  }

  const next = Array(7).fill(false);
  for (const day of days) {
    if (typeof day === "number" && day >= 0 && day <= 6) {
      next[day] = true;
    }
  }
  return next;
}

export function formFromAiItem(item: AiChatItemContext): ItemFormState {
  return {
    ...createEmptyAiForm(),
    title: item.title ?? "",
    description: item.description ?? "",
    hasTime: Boolean(item.hasTime || item.startDate),
    startDate: item.startDate ?? "",
    startTime: item.startTime ?? "",
    endDate: item.endDate ?? "",
    endTime: item.endTime ?? "",
    allDay: Boolean(item.allDay),
    hasDueDate: Boolean(item.hasDueDate || item.dueDate),
    dueDate: item.dueDate ?? "",
    timezone: item.timezone ?? "",
    recurrenceType: item.recurrenceType ?? "none",
    recurrenceInterval: item.recurrenceInterval ?? "1",
    daysOfWeek: normalizeDaysOfWeek(item.daysOfWeek),
    recurrenceEndType: item.recurrenceEndType ?? "never",
    recurrenceEndDate: item.recurrenceEndDate ?? "",
    recurrenceCount: item.recurrenceCount?.toString() ?? "10",
    monthlyPattern: item.recurrenceBysetpos ? "nth_weekday" : "day_of_month",
    nthWeekdayPosition: item.recurrenceBysetpos?.toString() ?? "2",
    nthWeekdayDay: item.daysOfWeek?.findIndex((d) => typeof d === "number" ? d > 0 : d) ?? 2,
    priority: item.priority,
    estimateMinutes: item.estimateMinutes ?? "",
    tags: item.tags ?? [],
    subtasks: (item.subtasks ?? []).map((title, index) => ({
      id: `ai-subtask-${index}`,
      title,
    })),
    projectId: item.projectId ?? "",
    projectName: item.projectName ?? "",
    progressIds: [],
    status: item.status,
    reminders: (item.reminders ?? []).map((r) => ({
      id: crypto.randomUUID(),
      minutesBefore: r.minutesBefore,
      method: r.method,
      triggerTime: r.triggerTime,
      dayOffset: r.dayOffset,
    })),
  };
}

export function mergeAiFormPatch(
  base: ItemFormState,
  patch: Partial<ItemFormState>,
): ItemFormState {
  return {
    ...base,
    ...patch,
    daysOfWeek: patch.daysOfWeek ? [...patch.daysOfWeek] : [...base.daysOfWeek],
    tags: patch.tags ? [...patch.tags] : [...base.tags],
    subtasks: patch.subtasks ? patch.subtasks.map((subtask, index) => ({
      id: subtask.id || `ai-subtask-${index}`,
      title: subtask.title,
    })) : base.subtasks.map((subtask) => ({ ...subtask })),
    reminders: patch.reminders
      ? patch.reminders.map((r) => ({
          ...r,
          id: r.id || crypto.randomUUID(),
        }))
      : base.reminders.map((r) => ({ ...r })),
  };
}

export function minutesFromTime(time: string | undefined): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function timeFromMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function detectAiConflicts(
  candidate: Partial<Pick<ItemFormState, "startDate" | "startTime" | "endDate" | "endTime" | "allDay">>,
  items: AiChatItemContext[],
  excludeIds: string[] = [],
  timezone?: string,
): AiActionConflict[] {
  if (!candidate.startDate || !candidate.startTime || candidate.allDay) return [];

  const candidateDate = candidate.startDate;
  const start = minutesFromTime(candidate.startTime);
  const end = minutesFromTime(candidate.endTime) ?? start;
  if (start === null || end === null || end <= start) return [];

  return items
    .filter((item) =>
      !excludeIds.includes(item.id) &&
      item.hasTime &&
      !item.allDay &&
      item.startTime &&
      itemOccursOnDate(item, candidateDate, timezone)
    )
    .filter((item) => {
      const itemStart = minutesFromTime(item.startTime);
      const itemEnd = minutesFromTime(item.endTime) ?? itemStart;
      if (itemStart === null || itemEnd === null || itemEnd <= itemStart) return false;
      return start < itemEnd && end > itemStart;
    })
    .map((item) => ({
      itemId: item.id,
      title: item.title,
      startDate: item.startDate || candidateDate,
      startTime: item.startTime || "",
      endDate: item.endDate,
      endTime: item.endTime,
    }));
}

/**
 * Check if an item occurs on a given date, handling recurring items.
 * For non-recurring items, checks if startDate/endDate/dueDate matches.
 * For recurring items, uses the same expansion logic as the AI chat route.
 */
function itemOccursOnDate(
  item: AiChatItemContext,
  date: string,
  timezone?: string,
): boolean {
  // Non-recurring: check if date falls within start-end range, or matches dueDate
  if (!item.recurrenceType || item.recurrenceType === "none") {
    if (item.startDate && item.endDate && item.startDate <= date && date <= item.endDate) return true;
    if (item.startDate && !item.endDate && item.startDate === date) return true;
    if (Boolean(item.hasDueDate) && item.dueDate === date) return true;
    return false;
  }

  // Recurring: use candidate-search expansion
  const tz = timezone || "UTC";

  if (isRecurringOccurrenceSkippedOnDate(item, date, tz)) {
    return false;
  }

  const candidate = {
    id: item.id,
    title: item.title,
    startDate: item.startDate,
    endDate: item.endDate,
    recurrenceType: item.recurrenceType,
    recurrenceInterval: item.recurrenceInterval,
    daysOfWeek: item.daysOfWeek?.map((d) => typeof d === "number" ? Boolean(d) : d),
    recurrenceEndType: item.recurrenceEndType,
    recurrenceEndDate: item.recurrenceEndDate,
    exdates: item.exdates,
    completedOccurrences: item.completedOccurrences,
    reopenedOccurrences: item.reopenedOccurrences,
    createdAt: item.createdAt,
  };

  return doesItemOccurInRange(candidate, { start: date, end: date });
}

function getTimeOfDayFromTime(time: string): string {
  const [h] = time.split(":").map(Number);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

export function suggestAiScheduleSlots(
  date: string,
  durationMinutes: number,
  items: AiChatItemContext[],
  excludeIds: string[] = [],
  limit: number = 3,
  sleepStart: string = "23:00",
  sleepEnd: string = "06:00",
  bufferMinutes: number = 0,
  preferredTimeOfDays?: string[],
  timezone?: string,
): AiActionScheduleSuggestion[] {
  const sleepStartMin = minutesFromTime(sleepStart) ?? 23 * 60;
  const sleepEndMin = minutesFromTime(sleepEnd) ?? 6 * 60;
  const duration = Math.max(15, durationMinutes || 30);
  const buffer = Math.max(0, bufferMinutes);
  const busy = items
    .filter((item) =>
      !excludeIds.includes(item.id) &&
      item.hasTime &&
      !item.allDay &&
      item.startTime &&
      itemOccursOnDate(item, date, timezone)
    )
    .map((item) => {
      const start = minutesFromTime(item.startTime);
      const end = minutesFromTime(item.endTime) ?? start;
      return start !== null && end !== null && end > start ? { start, end } : null;
    })
    .filter((slot): slot is { start: number; end: number } => Boolean(slot))
    .sort((a, b) => a.start - b.start);

  // Build awake windows for this date.
  // Normal (e.g. 23:00-06:00): window = [sleepEnd, sleepStart] = [06:00, 23:00]
  // Cross-midnight (e.g. 02:00-09:00): two windows = [00:00, sleepStart] + [sleepEnd, 24:00]
  type Window = { start: number; end: number };
  const windows: Window[] = [];
  if (sleepEndMin <= sleepStartMin) {
    // Normal: sleep within same day, work window is one continuous block
    windows.push({ start: sleepEndMin, end: sleepStartMin });
  } else {
    // Cross-midnight: sleep wraps around midnight, work window splits in two
    windows.push({ start: 0, end: sleepStartMin });
    windows.push({ start: sleepEndMin, end: 24 * 60 });
  }

  const suggestions: AiActionScheduleSuggestion[] = [];

  for (const window of windows) {
    let cursor = window.start;
    for (const slot of busy) {
      if (slot.start >= window.end) break;
      if (slot.end <= window.start) continue;
      if (slot.start - cursor >= duration) {
        suggestions.push({
          startDate: date,
          startTime: timeFromMinutes(cursor),
          endDate: date,
          endTime: timeFromMinutes(cursor + duration),
        });
        if (suggestions.length >= limit) break;
      }
      cursor = Math.max(cursor, slot.end + buffer);
    }
    if (suggestions.length >= limit) break;
    if (window.end - cursor >= duration) {
      suggestions.push({
        startDate: date,
        startTime: timeFromMinutes(cursor),
        endDate: date,
        endTime: timeFromMinutes(cursor + duration),
      });
      if (suggestions.length >= limit) break;
    }
  }

  if (preferredTimeOfDays && preferredTimeOfDays.length > 0) {
    suggestions.sort((a, b) => {
      const aTod = getTimeOfDayFromTime(a.startTime);
      const bTod = getTimeOfDayFromTime(b.startTime);
      const aIndex = preferredTimeOfDays.indexOf(aTod);
      const bIndex = preferredTimeOfDays.indexOf(bTod);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }

  return suggestions.slice(0, limit);
}
