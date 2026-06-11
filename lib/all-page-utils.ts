import { RRule, rrulestr } from "rrule";

import type { Item, ItemStatus, Priority } from "./types/item";
import type {
  ManualItemRecord,
  DisplayItem,
  ItemFormState,
  SubtaskFormItem,
  DayGroup,
  Section,
  ListSortConfig,
  KanbanColumn,
  KanbanColumnId,
  BuildKanbanOptions,
} from "./types/all-page";
import { getTimeFormatHour12, getWeekStartDay, getDateLocale, getAppLocale } from "./stores/use-settings-store";
import { translate } from "@/lib/i18n/dictionary";
import { dayjs } from "./dayjs";
import { getBrowserTimezone } from "./timezone";

export const LOCAL_STORAGE_KEY = "orkest-manual-items";

function getTimezoneOption(): string | undefined {
  return getBrowserTimezone() || undefined;
}

export function getMonthFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: "long",
    year: "numeric",
    timeZone: getTimezoneOption(),
  });
}

export function getTimeFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: getTimeFormatHour12(),
    timeZone: getTimezoneOption(),
  });
}

export function getDueDateFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: "short",
    day: "numeric",
    timeZone: getTimezoneOption(),
  });
}

export function getDueDateFormatterWithYear(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: getTimezoneOption(),
  });
}

export function formatDueDate(date: Date): string {
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return getDueDateFormatter().format(date);
  }
  return getDueDateFormatterWithYear().format(date);
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getOrderedDayNames(): string[] {
  const start = getWeekStartDay();
  return [...DAY_NAMES.slice(start), ...DAY_NAMES.slice(0, start)];
}

export function getWeekStartDate(date: Date): Date {
  const start = getWeekStartDay();
  const day = date.getDay();
  const diff = (day - start + 7) % 7;
  const result = new Date(date);
  result.setDate(date.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export const RRULE_WEEKDAYS = [
  RRule.SU,
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
];

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; textColor: string }> = {
  low: { label: "Low", color: "bg-gray-100 text-gray-600 border-gray-200", textColor: "#4b5563" },
  medium: { label: "Medium", color: "bg-blue-50 text-blue-600 border-blue-200", textColor: "var(--priority-medium)" },
  high: { label: "High", color: "bg-orange-50 text-orange-600 border-orange-200", textColor: "#ea580c" },
  urgent: { label: "Urgent", color: "bg-red-50 text-red-600 border-red-200", textColor: "#dc2626" },
};

export function getPriorityLabel(priority: Priority): string {
  return translate(getAppLocale(), `priority.${priority}` as "priority.low" | "priority.medium" | "priority.high" | "priority.urgent");
}

export const emptyForm: ItemFormState = {
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
  daysOfWeek: [false, false, false, false, false, false, false],
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
  status: undefined,
  reminders: [],
};

export function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export const TIMELINE_POINT_COLORS = {
  today: "#88c5a6",
  history: "#9ca3af",
  upcoming: "#5ea8ff",
  noDate: "#5ea8ff",
} as const;

export type DateCategory = "today" | "upcoming" | "history" | "noDate";

export function getDateCategory(date?: Date): DateCategory {
  if (!date) return "noDate";
  const today = startOfDay(new Date());
  const pointDate = startOfDay(date);
  if (pointDate.getTime() === today.getTime()) return "today";
  if (pointDate < today) return "history";
  return "upcoming";
}

export const DATE_LABEL_COLORS: Record<DateCategory, string> = {
  today: "#2f855a",
  upcoming: "var(--date-upcoming)",
  history: "#6b7280",
  noDate: "#6b7280",
};

export function getTimelinePointColor(date?: Date) {
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  if (isDark) {
    return "#a3a3a3";
  }

  if (!date) {
    return TIMELINE_POINT_COLORS.noDate;
  }

  const today = startOfDay(new Date());
  const pointDate = startOfDay(date);

  if (pointDate.getTime() === today.getTime()) {
    return TIMELINE_POINT_COLORS.today;
  }

  if (pointDate < today) {
    return TIMELINE_POINT_COLORS.history;
  }

  return TIMELINE_POINT_COLORS.upcoming;
}

export function getTimelinePointColorForItem(item: Item) {
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  if (isDark) {
    return "#a3a3a3";
  }

  if (hasNoDate(item)) {
    return TIMELINE_POINT_COLORS.noDate;
  }

  return getTimelinePointColor(getAnchorDate(item));
}

export function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");

  if (normalized.length !== 6) {
    return hexColor;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getAnchorDate(item: Item) {
  const recurringOccurrenceDate =
    "occurrenceDate" in item && item.occurrenceDate instanceof Date
      ? item.occurrenceDate
      : undefined;

  const baseDate = recurringOccurrenceDate ?? item.time.start ?? item.time.due ?? item.time.end ?? item.createdAt;

  return baseDate;
}

export function formatDayLabel(date: Date) {
  const currentYear = dayjs().tz(getBrowserTimezone()).year();
  const tz = getTimezoneOption();
  const options: Intl.DateTimeFormatOptions = date.getFullYear() !== currentYear
    ? { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: tz }
    : { weekday: "long", month: "short", day: "numeric", timeZone: tz };
  return new Intl.DateTimeFormat(getDateLocale(), options).format(date).toUpperCase();
}

export function formatItemTime(item: Item, forceDateIfNotToday = false) {
  const tz = getTimezoneOption();
  const nowInTz = dayjs().tz(tz);
  const currentYear = nowInTz.year();
  const todayStr = nowInTz.format("YYYY-MM-DD");

  const shortDateWithYearFormatter = (d: Date) => {
    const options: Intl.DateTimeFormatOptions = d.getFullYear() !== currentYear
      ? { month: "short", day: "numeric", year: "numeric", timeZone: tz }
      : { month: "short", day: "numeric", timeZone: tz };
    return new Intl.DateTimeFormat(getDateLocale(), options).format(d);
  };

  const start = item.time.start;
  const end = item.time.end;

  // For recurring instances without time, use occurrenceDate as the display date
  const occurrenceDate =
    "occurrenceDate" in item && item.occurrenceDate instanceof Date
      ? item.occurrenceDate
      : undefined;

  const isStartNotToday = start && dayjs(start).tz(tz).format("YYYY-MM-DD") !== todayStr;
  const isEndNotToday = end && dayjs(end).tz(tz).format("YYYY-MM-DD") !== todayStr;
  const shouldForceDate = forceDateIfNotToday || (forceDateIfNotToday && (isStartNotToday || isEndNotToday));

  const dayKey = (d: Date) => dayjs(d).tz(tz).format("YYYY-MM-DD");
  const allDayLabel = translate(getAppLocale(), "date.allDay").toUpperCase();

  if (item.time.allDay) {
    if (start && end) {
      const startDay = dayKey(start);
      const endDay = dayKey(end);

      if (startDay === endDay) {
        if (shouldForceDate) {
          return `${shortDateWithYearFormatter(start)} ${allDayLabel}`;
        }
        return allDayLabel;
      }

      return `${shortDateWithYearFormatter(start)} - ${shortDateWithYearFormatter(end)}`;
    }

    if (shouldForceDate) {
      if (start) return `${shortDateWithYearFormatter(start)} ${allDayLabel}`;
      if (end) return `${shortDateWithYearFormatter(end)} ${allDayLabel}`;
    }

    // Recurring instance with no time but has occurrenceDate
    if (occurrenceDate) {
      return `${shortDateWithYearFormatter(occurrenceDate)} ${allDayLabel}`;
    }

    return allDayLabel;
  }

  if (start && end) {
    const startDay = dayKey(start);
    const endDay = dayKey(end);

    if (startDay === endDay) {
      if (shouldForceDate) {
        const tf = getTimeFormatter();
        return `${shortDateWithYearFormatter(start)}, ${tf.format(start)} - ${tf.format(end)}`;
      }
      return `${getTimeFormatter().format(start)} - ${getTimeFormatter().format(end)}`;
    }

    if (shouldForceDate) {
      const tf = getTimeFormatter();
      return `${shortDateWithYearFormatter(start)}, ${tf.format(start)} - ${shortDateWithYearFormatter(end)}, ${tf.format(end)}`;
    }

    return `${getTimeFormatter().format(start)} - ${shortDateWithYearFormatter(end)}, ${getTimeFormatter().format(end)}`;
  }

  const value = start ?? end;

  if (!value) {
    // Recurring instance with no time but has occurrenceDate
    if (occurrenceDate) {
      return shortDateWithYearFormatter(occurrenceDate);
    }
    return "";
  }

  if (shouldForceDate) {
    return `${shortDateWithYearFormatter(value)}, ${getTimeFormatter().format(value)}`;
  }

  return getTimeFormatter().format(value);
}

export function formatRecurrence(item: Item): string {
  const rec = item.recurrence;
  if (!rec) return "";

  const interval = rec.interval ?? 1;
  const type = rec.type;
  const endLabel = rec.count
    ? ` for ${rec.count} times`
    : rec.endDate
      ? ` until ${formatDueDate(rec.endDate)}`
      : "";

  if (type === "daily") {
    const base = interval === 1 ? "Daily" : `Every ${interval} days`;
    return `${base}${endLabel}`;
  }

  if (type === "weekly") {
    const days = rec.daysOfWeek;
    const dayLabels = days
      ? days.map((d) => DAY_NAMES[d]).filter(Boolean)
      : [];
    if (dayLabels.length > 0) {
      const dayStr = dayLabels.join(", ");
      const base =
        interval === 1 ? `Weekly on ${dayStr}` : `Every ${interval} weeks on ${dayStr}`;
      return `${base}${endLabel}`;
    }
    const base = interval === 1 ? "Weekly" : `Every ${interval} weeks`;
    return `${base}${endLabel}`;
  }

  if (type === "monthly") {
    if (rec.bysetpos && rec.daysOfWeek?.length) {
      const posLabels: Record<number, string> = {
        1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", [-1]: "last",
      };
      const posLabel = posLabels[rec.bysetpos] ?? `${rec.bysetpos}th`;
      const dayName = DAY_NAMES[rec.daysOfWeek[0]] ?? "";
      const base = interval === 1
        ? `Monthly on the ${posLabel} ${dayName}`
        : `Every ${interval} months on the ${posLabel} ${dayName}`;
      return `${base}${endLabel}`;
    }
    const base = interval === 1 ? "Monthly" : `Every ${interval} months`;
    return `${base}${endLabel}`;
  }

  if (type === "yearly") {
    const base = interval === 1 ? "Yearly" : `Every ${interval} years`;
    return `${base}${endLabel}`;
  }

  return "";
}

export function groupItemsByDay(
  items: DisplayItem[],
  sortDirection: "asc" | "desc" = "asc",
  preserveItemOrder = false,
): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  const sorted = preserveItemOrder
    ? [...items]
    : [...items].sort(
        (left, right) => getAnchorDate(left).getTime() - getAnchorDate(right).getTime(),
      );

  for (const item of sorted) {
    const date = getAnchorDate(item);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const group = groups.get(key);

    if (group) {
      group.items.push(item);
      continue;
    }

    groups.set(key, { date, items: [item] });
  }

  const result = Array.from(groups.values());

  // Always sort day groups by date
  result.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (!preserveItemOrder) {
    for (const group of result) {
      group.items.sort((left, right) => {
        const leftAllDay = left.time.allDay;
        const rightAllDay = right.time.allDay;

        if (leftAllDay && !rightAllDay) return -1;
        if (!leftAllDay && rightAllDay) return 1;

        return getAnchorDate(left).getTime() - getAnchorDate(right).getTime();
      });
    }
  }

  if (sortDirection === "desc") {
    result.reverse();
  }

  return result;
}

export function hasNoDate(item: Item) {
  return !item.time.start && !item.time.end && !item.recurrence;
}

export function buildSections(items: DisplayItem[]): Section[] {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const locale = getAppLocale();

  const noDateItems = items.filter(hasNoDate);
  const datedItems = items.filter((item) => !hasNoDate(item));

  const todayItems = datedItems.filter((item) => {
    const anchor = getAnchorDate(item);
    return anchor >= today && anchor < tomorrow;
  });

  const upcomingItems = datedItems.filter((item) => getAnchorDate(item) >= tomorrow);
  const historyItems = datedItems.filter((item) => getAnchorDate(item) < today);

  return [
    {
      id: "today",
      title: translate(locale, "date.today"),
      groups: groupItemsByDay(todayItems),
    },
    {
      id: "no-date",
      title: translate(locale, "date.unscheduled"),
      groups: noDateItems.length > 0 ? [{ date: today, items: noDateItems }] : [],
    },
    {
      id: "upcoming",
      title: translate(locale, "date.upcoming"),
      groups: groupItemsByDay(upcomingItems),
    },
    {
      id: "history",
      title: translate(locale, "date.history"),
      groups: groupItemsByDay(historyItems, "desc"),
    },
  ].filter((section) => section.groups.length > 0);
}

export function makeUid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatDateInput(date?: Date, tz?: string) {
  if (!date) {
    return "";
  }

  if (tz) {
    return dayjs(date).tz(tz).format("YYYY-MM-DD");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTimeInput(date?: Date, tz?: string) {
  if (!date) {
    return "";
  }

  if (tz) {
    return dayjs(date).tz(tz).format("HH:mm");
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function makeDateFromInput(date?: string, time?: string, timezone?: string) {
  if (!date) {
    return undefined;
  }

  if (timezone) {
    const dateStr = time ? `${date}T${time}:00` : `${date}T00:00:00`;
    return dayjs.tz(dateStr, timezone).toDate();
  }

  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year, month - 1, day);

  if (time) {
    const [hours, minutes] = time.split(":").map(Number);
    value.setHours(hours, minutes, 0, 0);
  }

  return value;
}

export function serializeOccurrenceKey(date: Date) {
  return date.toISOString();
}

function parseRRuleAnchorDate(rrule?: string) {
  if (!rrule) {
    return undefined;
  }

  const dtstartLine = rrule
    .split("\n")
    .find((line) => line.startsWith("DTSTART:"));

  if (!dtstartLine) {
    return undefined;
  }

  const rawValue = dtstartLine.slice("DTSTART:".length).trim();
  const match = rawValue.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
  );

  if (!match) {
    return undefined;
  }

  const [, year, month, day, hours, minutes, seconds] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );
}

export function getRecurrenceAnchor(item: Item) {
  const anchor = item.time.start ?? item.time.due ?? item.time.end ?? parseRRuleAnchorDate(item.rrule);
  if (anchor && item.time.timezone) {
    return dayjs(anchor).tz(item.time.timezone).toDate();
  }
  return anchor;
}

export function formatRRuleDateTime(date: Date, tz?: string) {
  const resolvedTz = tz || getBrowserTimezone();
  const d = dayjs(date).tz(resolvedTz);
  const year = String(d.year()).padStart(4, "0");
  const month = String(d.month() + 1).padStart(2, "0");
  const day = String(d.date()).padStart(2, "0");
  const hours = String(d.hour()).padStart(2, "0");
  const minutes = String(d.minute()).padStart(2, "0");
  const seconds = String(d.second()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

export function toRRuleComparableDate(date: Date, tz?: string) {
  const resolvedTz = tz || getBrowserTimezone();
  const d = dayjs(date).tz(resolvedTz);
  return new Date(
    Date.UTC(
      d.year(),
      d.month(),
      d.date(),
      d.hour(),
      d.minute(),
      d.second(),
      d.millisecond(),
    ),
  );
}

export function fromRRuleDate(date: Date, tz?: string) {
  const resolvedTz = tz || getBrowserTimezone();
  return dayjs.tz(
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}`,
    resolvedTz,
  ).toDate();
}

export function buildRRuleString({
  anchorDate,
  recurrenceType,
  recurrenceInterval,
  daysOfWeek,
  recurrenceEndDate,
  recurrenceCount,
  recurrenceBysetpos,
  recurrenceEndType,
  timezone,
}: {
  anchorDate?: Date;
  recurrenceType: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval: number;
  daysOfWeek: number[];
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurrenceBysetpos?: number;
  recurrenceEndType?: "never" | "on_date" | "after_count";
  timezone?: string;
}) {
  if (!anchorDate || recurrenceType === "none") {
    return undefined;
  }

  const tz = timezone || getBrowserTimezone();
  const anchorInTz = dayjs(anchorDate).tz(tz);

  const freqMap: Record<string, string> = {
    daily: "DAILY",
    weekly: "WEEKLY",
    monthly: "MONTHLY",
    yearly: "YEARLY",
  };

  const ruleParts = [
    `FREQ=${freqMap[recurrenceType] ?? "DAILY"}`,
    `INTERVAL=${recurrenceInterval}`,
  ];
  if (recurrenceType === "weekly") {
    const selectedDays = daysOfWeek.length > 0 ? daysOfWeek : [anchorInTz.day()];
    const byDay = selectedDays
      .map((dayIndex) => RRULE_WEEKDAYS[dayIndex]?.toString())
      .filter(Boolean)
      .join(",");

    if (byDay) {
      ruleParts.push(`BYDAY=${byDay}`);
    }
  }
  if (recurrenceType === "monthly") {
    if (recurrenceBysetpos && daysOfWeek.length === 1) {
      const byDay = RRULE_WEEKDAYS[daysOfWeek[0]]?.toString();
      if (byDay) {
        ruleParts.push(`BYDAY=${byDay}`);
        ruleParts.push(`BYSETPOS=${recurrenceBysetpos}`);
      }
    } else {
      ruleParts.push(`BYMONTHDAY=${anchorInTz.date()}`);
    }
  }
  if (recurrenceType === "yearly") {
    ruleParts.push(`BYMONTH=${anchorInTz.month() + 1}`);
    ruleParts.push(`BYMONTHDAY=${anchorInTz.date()}`);
  }

  if (recurrenceEndType === "after_count" && recurrenceCount) {
    ruleParts.push(`COUNT=${recurrenceCount}`);
  } else if (recurrenceEndDate) {
    const until = makeDateFromInput(recurrenceEndDate, undefined, tz);
    if (until) {
      const untilTz = dayjs(until).tz(tz).hour(23).minute(59).second(59).millisecond(0);
      ruleParts.push(`UNTIL=${formatRRuleDateTime(untilTz.toDate(), tz)}`);
    }
  }

  return `DTSTART:${formatRRuleDateTime(anchorDate, tz)}\nRRULE:${ruleParts.join(";")}`;
}

export function getItemRRule(item: Item) {
  if (!item.recurrence || item.recurrence.type === "none") {
    return item.rrule;
  }

  return buildRRuleString({
    anchorDate: getRecurrenceAnchor(item),
    recurrenceType: item.recurrence.type,
    recurrenceInterval: item.recurrence.interval ?? 1,
    daysOfWeek: item.recurrence.daysOfWeek ?? [],
    recurrenceEndDate: item.recurrence.endDate ? formatDateInput(item.recurrence.endDate) : undefined,
    recurrenceCount: item.recurrence.count,
    recurrenceBysetpos: item.recurrence.bysetpos,
    recurrenceEndType: item.recurrence.count ? "after_count" : (item.recurrence.endDate ? "on_date" : "never"),
    timezone: item.time.timezone,
  });
}

export function isRecurringItem(item: Item) {
  return Boolean(getItemRRule(item));
}

export function getOccurrenceSearchStart() {
  return startOfDay(new Date());
}

export function getNextRecurringOccurrence(item: Item) {
  const ruleString = getItemRRule(item);
  if (!ruleString) {
    return null;
  }

  const tz = item.time.timezone || getBrowserTimezone();
  const parsedRule = rrulestr(ruleString);
  const skippedOccurrences = new Set(
    [...(item.exdates ?? []), ...(item.completedOccurrences ?? [])].map(serializeOccurrenceKey),
  );
  let cursor = toRRuleComparableDate(getOccurrenceSearchStart(), tz);

  for (let index = 0; index < 2048; index += 1) {
    const rawOccurrence = parsedRule.after(cursor, true);
    if (!rawOccurrence) {
      return null;
    }

    const occurrence = fromRRuleDate(rawOccurrence, tz);
    const occurrenceKey = serializeOccurrenceKey(occurrence);
    if (!skippedOccurrences.has(occurrenceKey)) {
      return occurrence;
    }

    cursor = toRRuleComparableDate(new Date(occurrence.getTime() + 1000), tz);
  }

  return null;
}

export function shiftDateByOffset(date: Date | undefined, offsetMs: number) {
  if (!date) {
    return undefined;
  }

  return new Date(date.getTime() + offsetMs);
}

export function createRecurringDisplayItem(
  item: Item,
  occurrenceDate: Date,
  status: ItemStatus,
): DisplayItem | null {
  const anchorDate = getRecurrenceAnchor(item);

  if (!anchorDate) {
    return null;
  }

  const offsetMs = occurrenceDate.getTime() - anchorDate.getTime();

  return {
    ...item,
    time: {
      ...item.time,
      start: shiftDateByOffset(item.time.start, offsetMs),
      end: shiftDateByOffset(item.time.end, offsetMs),
      due: item.time.start ? shiftDateByOffset(item.time.due, offsetMs) : item.time.due,
    },
    status,
    isRecurringInstance: true,
    occurrenceDate,
    occurrenceKey: serializeOccurrenceKey(occurrenceDate),
    seriesSource: item,
  };
}

export function getCompletedRecurringDisplayItems(item: Item): DisplayItem[] {
  const excludedOccurrences = new Set((item.exdates ?? []).map(serializeOccurrenceKey));

  return (item.completedOccurrences ?? [])
    .filter((occurrenceDate) => !excludedOccurrences.has(serializeOccurrenceKey(occurrenceDate)))
    .sort((left, right) => left.getTime() - right.getTime())
    .map((occurrenceDate) => createRecurringDisplayItem(item, occurrenceDate, "completed"))
    .filter((value): value is DisplayItem => Boolean(value));
}

export function getReopenedRecurringDisplayItems(item: Item): DisplayItem[] {
  const excludedOccurrences = new Set((item.exdates ?? []).map(serializeOccurrenceKey));
  const completedOccurrences = new Set(
    (item.completedOccurrences ?? []).map(serializeOccurrenceKey),
  );

  return (item.reopenedOccurrences ?? [])
    .filter((occurrenceDate) => {
      const occurrenceKey = serializeOccurrenceKey(occurrenceDate);
      return (
        !excludedOccurrences.has(occurrenceKey) && !completedOccurrences.has(occurrenceKey)
      );
    })
    .sort((left, right) => left.getTime() - right.getTime())
    .map((occurrenceDate) => createRecurringDisplayItem(item, occurrenceDate, "active"))
    .filter((value): value is DisplayItem => Boolean(value));
}

export function getNextPendingRecurringDisplayItem(item: Item): DisplayItem | null {
  const occurrenceDate = getNextRecurringOccurrence(item);
  if (!occurrenceDate) {
    return null;
  }

  return createRecurringDisplayItem(item, occurrenceDate, "active");
}

export function canDeleteRecurringSeriesFromDisplayItem(item: DisplayItem) {
  if (!item.isRecurringInstance || item.status === "completed" || !item.occurrenceKey) {
    return false;
  }

  const sourceItem = item.seriesSource ?? item;
  if (sourceItem.deletedAt) {
    return false;
  }

  const nextPendingItem = getNextPendingRecurringDisplayItem(sourceItem);
  return nextPendingItem?.occurrenceKey === item.occurrenceKey;
}

export function toItemFromManualRecord(record: ManualItemRecord, baseItem?: Item): Item {
  const recordTimezone = record.timezone || getBrowserTimezone();
  const start = makeDateFromInput(record.startDate, record.startTime, recordTimezone);
  const end = makeDateFromInput(record.endDate, record.endTime, recordTimezone);
  const due = makeDateFromInput(record.dueDate, undefined, recordTimezone);
  const recurrence =
    record.recurrenceType !== "none"
      ? {
          type: record.recurrenceType,
          interval: record.recurrenceInterval,
          daysOfWeek: record.daysOfWeek.length > 0 ? record.daysOfWeek : undefined,
          endDate:
            record.recurrenceEndType === "on_date" && record.recurrenceEndDate
              ? makeDateFromInput(record.recurrenceEndDate)
              : undefined,
          count: record.recurrenceEndType === "after_count" ? record.recurrenceCount : undefined,
          bysetpos: record.recurrenceBysetpos ?? undefined,
        }
      : undefined;
  const rrule =
    record.rrule ??
    buildRRuleString({
      anchorDate: start ?? due ?? end,
      recurrenceType: record.recurrenceType,
      recurrenceInterval: record.recurrenceInterval,
      daysOfWeek: record.daysOfWeek,
      recurrenceEndDate: record.recurrenceEndDate,
      recurrenceCount: record.recurrenceCount,
      recurrenceBysetpos: record.recurrenceBysetpos,
      recurrenceEndType: record.recurrenceEndType,
      timezone: recordTimezone,
    });
  const exdates = record.exdates?.map((value) => new Date(value));
  const completedOccurrences = record.completedOccurrences?.map((value) => new Date(value));
  const reopenedOccurrences = record.reopenedOccurrences?.map((value) => new Date(value));

  if (baseItem) {
    return {
      ...baseItem,
      uid: record.uid,
      title: record.title,
      description: record.description || undefined,
      time: {
      ...baseItem.time,
      start,
      end,
      due,
      allDay: record.allDay,
      hasTime: record.hasTime,
      timezone: recordTimezone,
    },
      priority: record.priority,
      recurrence,
      rrule,
      exdates,
      completedOccurrences,
      reopenedOccurrences,
      deferredUntil: record.deferredUntil ? new Date(record.deferredUntil) : undefined,
      dismissedTodayDates: record.dismissedTodayDates,
      plannedTodayDates: record.plannedTodayDates,
      nowOverrideDate: record.nowOverrideDate,
      estimateMinutes: record.estimateMinutes,
      actualMinutes: record.actualMinutes,
      focusSessions: record.focusSessions,
      tags: record.tags?.length ? record.tags : undefined,
      projectId: record.projectId,
      parentId: record.parentId,
      reminders: record.reminders,
      status: record.status ?? baseItem.status,
      deletedAt: record.deletedAt ? new Date(record.deletedAt) : undefined,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  return {
    id: record.id,
    uid: record.uid,
    title: record.title,
    description: record.description || undefined,
    time: {
      start,
      end,
      due,
      allDay: record.allDay,
      hasTime: record.hasTime,
      timezone: recordTimezone,
    },
    actual: {},
    status: record.status ?? "active",
    priority: record.priority,
    recurrence,
    rrule,
    exdates,
    completedOccurrences,
    reopenedOccurrences,
    deferredUntil: record.deferredUntil ? new Date(record.deferredUntil) : undefined,
    dismissedTodayDates: record.dismissedTodayDates,
    plannedTodayDates: record.plannedTodayDates,
    nowOverrideDate: record.nowOverrideDate,
    estimateMinutes: record.estimateMinutes,
    actualMinutes: record.actualMinutes,
    focusSessions: record.focusSessions,
    tags: record.tags?.length ? record.tags : undefined,
    projectId: record.projectId,
    parentId: record.parentId,
    reminders: record.reminders,
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : undefined,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export function toManualItemRecord(item: Item, overrides: Partial<ManualItemRecord> = {}): ManualItemRecord {
  const recurrenceType =
    item.recurrence?.type === "daily" || item.recurrence?.type === "weekly" || item.recurrence?.type === "monthly" || item.recurrence?.type === "yearly"
      ? item.recurrence.type
      : "none";

  const saveTz = item.time.timezone || getBrowserTimezone();

  return {
    id: item.id,
    uid: item.uid,
    title: item.title,
    description: item.description,
    hasTime: Boolean(item.time.start || item.time.end),
    startDate: item.time.start ? formatDateInput(item.time.start, saveTz) : undefined,
    startTime: item.time.start && !item.time.allDay ? formatTimeInput(item.time.start, saveTz) : undefined,
    endDate: item.time.end ? formatDateInput(item.time.end, saveTz) : undefined,
    endTime: item.time.end && !item.time.allDay ? formatTimeInput(item.time.end, saveTz) : undefined,
    allDay: Boolean(item.time.allDay),
    timezone: saveTz,
    dueDate: item.time.due ? formatDateInput(item.time.due, saveTz) : undefined,
    recurrenceType,
    recurrenceInterval: item.recurrence?.interval ?? 1,
    daysOfWeek: item.recurrence?.daysOfWeek ?? [],
    recurrenceEndType: item.recurrence?.count ? "after_count" : (item.recurrence?.endDate ? "on_date" : "never"),
    recurrenceEndDate: item.recurrence?.endDate ? formatDateInput(item.recurrence.endDate) : undefined,
    recurrenceCount: item.recurrence?.count,
    recurrenceBysetpos: item.recurrence?.bysetpos,
    priority: item.priority,
    estimateMinutes: item.estimateMinutes,
    actualMinutes: item.actualMinutes,
    focusSessions: item.focusSessions,
    tags: item.tags,
    projectId: item.projectId,
    parentId: item.parentId,
    rrule: getItemRRule(item),
    exdates: item.exdates?.map(serializeOccurrenceKey),
    completedOccurrences: item.completedOccurrences?.map(serializeOccurrenceKey),
    reopenedOccurrences: item.reopenedOccurrences?.map(serializeOccurrenceKey),
    deferredUntil: item.deferredUntil ? item.deferredUntil.toISOString() : undefined,
    dismissedTodayDates: item.dismissedTodayDates,
    plannedTodayDates: item.plannedTodayDates,
    nowOverrideDate: item.nowOverrideDate,
    status: item.status,
    deletedAt: item.deletedAt ? item.deletedAt.toISOString() : undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    ...overrides,
  };
}

export function toFormStateFromItem(item: Item, subtasks?: SubtaskFormItem[]): ItemFormState {
  const start = item.time.start;
  const end = item.time.end;
  const due = item.time.due;
  const itemTz = item.time.timezone;
  const recurrenceType =
    item.recurrence?.type === "daily" || item.recurrence?.type === "weekly" || item.recurrence?.type === "monthly" || item.recurrence?.type === "yearly"
      ? item.recurrence.type
      : "none";

  return {
    title: item.title,
    description: item.description || "",
    hasTime: Boolean(start || end),
    startDate: formatDateInput(start, itemTz),
    startTime: item.time.allDay ? "" : formatTimeInput(start, itemTz),
    endDate: formatDateInput(end, itemTz),
    endTime: item.time.allDay ? "" : formatTimeInput(end, itemTz),
    allDay: Boolean(item.time.allDay),
    hasDueDate: Boolean(due),
    dueDate: formatDateInput(due, itemTz),
    timezone: item.time.timezone || "",
    recurrenceType,
    recurrenceInterval: String(item.recurrence?.interval ?? 1),
    daysOfWeek: DAY_NAMES.map(
      (_, dayIndex) => item.recurrence?.daysOfWeek?.includes(dayIndex) ?? false,
    ),
    recurrenceEndType: item.recurrence?.count ? "after_count" : (item.recurrence?.endDate ? "on_date" : "never"),
    recurrenceEndDate: formatDateInput(item.recurrence?.endDate),
    recurrenceCount: String(item.recurrence?.count ?? ""),
    monthlyPattern: item.recurrence?.bysetpos ? "nth_weekday" : "day_of_month",
    nthWeekdayPosition: String(item.recurrence?.bysetpos ?? "2"),
    nthWeekdayDay: item.recurrence?.daysOfWeek?.[0] ?? 2,
    priority: item.priority,
    estimateMinutes: item.estimateMinutes ? String(item.estimateMinutes) : "",
    tags: item.tags || [],
    subtasks: subtasks ?? [],
    projectId: item.projectId || "",
    projectName: "",
    status: item.status,
    reminders: item.reminders || [],
  };
}

export function buildDisplayItems(items: Item[]): DisplayItem[] {
  const displayItems = items
    .filter((item) => !item.parentId)
    .flatMap((item) => {
    if (item.deletedAt) {
      if (isRecurringItem(item)) {
        return [...getCompletedRecurringDisplayItems(item), ...getReopenedRecurringDisplayItems(item)];
      }

      return [];
    }

    if (!isRecurringItem(item)) {
      return [item as DisplayItem];
    }

    const completedItems = getCompletedRecurringDisplayItems(item);
    const reopenedItems = getReopenedRecurringDisplayItems(item);
    const nextPendingItem = getNextPendingRecurringDisplayItem(item);

    return nextPendingItem
      ? [...completedItems, ...reopenedItems, nextPendingItem]
      : [...completedItems, ...reopenedItems];
  });

  const uniqueDisplayItems = new Map<string, DisplayItem>();

  for (const item of displayItems) {
    const dedupeKey = `${item.id}:${item.occurrenceKey ?? "base"}`;
    uniqueDisplayItems.set(dedupeKey, item);
  }

  return Array.from(uniqueDisplayItems.values());
}

export function dedupeManualItemRecords(records: ManualItemRecord[]) {
  const uniqueRecords = new Map<string, ManualItemRecord>();

  for (const record of records) {
    uniqueRecords.set(record.id, record);
  }

  return Array.from(uniqueRecords.values());
}

export function getDisplayItemKey(item: DisplayItem) {
  return `${item.id}:${item.occurrenceKey ?? "base"}`;
}

export function parseStoredManualItems(raw: string | null) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is ManualItemRecord => {
      return (
        value &&
        typeof value === "object" &&
        typeof value.id === "string" &&
        typeof value.uid === "string" &&
        typeof value.title === "string"
      );
    });
  } catch {
    return [];
  }
}

export function hasScheduleDetails(form: ItemFormState) {
  return Boolean(
    form.startDate || form.startTime || form.endDate || form.endTime || form.allDay,
  );
}

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const TAG_MAX_LENGTH = 30;
export const TAG_MAX_COUNT = 10;
export const RECURRENCE_INTERVAL_MAX = 365;
export const ESTIMATE_MINUTES_MAX = 99999;
export const SUBTASK_MAX_COUNT = 20;
export const SUBTASK_TITLE_MAX_LENGTH = 200;

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

export function validateItemForm(form: ItemFormState, t?: TranslateFn): string | null {
  const scheduleEnabled = hasScheduleDetails(form);
  const translate = t ?? ((key: string) => key);

  if (!form.title.trim()) {
    return translate("validation.titleRequired");
  }

  if (form.title.trim().length > TITLE_MAX_LENGTH) {
    return translate("validation.titleTooLong", { count: TITLE_MAX_LENGTH });
  }

  if (form.hasTime && !form.startDate) {
    return translate("validation.startDateRequired");
  }

  if (form.startDate && !form.allDay && !form.startTime) {
    return translate("validation.startTimeRequired");
  }

  if (form.startTime && !form.startDate) {
    return translate("validation.startDateRequiredForTime");
  }

  if (form.endDate && !form.allDay && !form.endTime) {
    return translate("validation.endTimeRequired");
  }

  if (form.endTime && !form.endDate) {
    return translate("validation.endDateRequiredForTime");
  }

  if (scheduleEnabled && form.startDate && form.endDate) {
    if (form.endDate < form.startDate) {
      return translate("validation.endDateBeforeStart");
    }
    if (form.endDate === form.startDate && form.startTime && form.endTime) {
      if (form.endTime < form.startTime) {
        return translate("validation.endTimeBeforeStart");
      }
    }
  }

  if (form.hasDueDate && form.dueDate && scheduleEnabled && form.startDate) {
    if (form.dueDate < form.startDate) {
      return translate("validation.dueDateBeforeStart");
    }
  }

  if (form.description.length > DESCRIPTION_MAX_LENGTH) {
    return translate("validation.notesTooLong", { count: DESCRIPTION_MAX_LENGTH });
  }

  if (form.estimateMinutes) {
    const minutes = Number(form.estimateMinutes);
    if (isNaN(minutes) || minutes <= 0 || !Number.isInteger(minutes)) {
      return translate("validation.estimatePositiveInteger");
    }
    if (minutes > ESTIMATE_MINUTES_MAX) {
      return translate("validation.estimateTooLarge", { count: ESTIMATE_MINUTES_MAX });
    }
  }

  if (form.recurrenceType !== "none") {
    const interval = Number(form.recurrenceInterval);
    if (isNaN(interval) || interval <= 0 || !Number.isInteger(interval)) {
      return translate("validation.recurrenceIntervalPositive");
    }
    if (interval > RECURRENCE_INTERVAL_MAX) {
      return translate("validation.recurrenceIntervalTooLarge", { count: RECURRENCE_INTERVAL_MAX });
    }
  }

  if (form.tags.length > TAG_MAX_COUNT) {
    return translate("validation.tooManyTags", { count: TAG_MAX_COUNT });
  }

  if (form.tags.some((tag) => tag.length > TAG_MAX_LENGTH)) {
    return translate("validation.tagTooLong", { count: TAG_MAX_LENGTH });
  }

  if (form.recurrenceType === "weekly") {
    const hasSelectedDay = form.daysOfWeek.some((d) => d);
    if (!hasSelectedDay) {
      return translate("validation.weeklyRecurrenceDayRequired");
    }
  }

  if (form.recurrenceEndType === "on_date" && !form.recurrenceEndDate) {
    return translate("validation.recurrenceEndDateRequired");
  }

  if (form.recurrenceEndType === "after_count") {
    const count = Number(form.recurrenceCount);
    if (isNaN(count) || count <= 0 || !Number.isInteger(count)) {
      return translate("validation.recurrenceCountPositive");
    }
  }

  if (form.recurrenceType === "monthly" && form.monthlyPattern === "nth_weekday") {
    if (!form.nthWeekdayPosition) {
      return translate("validation.monthlyPatternRequired");
    }
  }

  if (form.hasDueDate && !form.dueDate) {
    return translate("validation.dueDateRequired");
  }

  if (form.subtasks.length > SUBTASK_MAX_COUNT) {
    return translate("validation.tooManySubtasks", { count: SUBTASK_MAX_COUNT });
  }

  if (form.subtasks.some((st) => st.title.length > SUBTASK_TITLE_MAX_LENGTH)) {
    return translate("validation.subtaskTitleTooLong", { count: SUBTASK_TITLE_MAX_LENGTH });
  }

  return null;
}

export function buildRecordFromForm({
  form,
  baseItem,
  existingManualItem,
  now,
  id,
  uid,
}: {
  form: ItemFormState;
  baseItem?: Item;
  existingManualItem?: ManualItemRecord;
  now: string;
  id?: string;
  uid?: string;
}) {
  const scheduleEnabled = hasScheduleDetails(form);
  const hasExplicitDateOrTime = Boolean(form.startDate || form.endDate || form.dueDate);
  const recurrenceType = form.recurrenceType;
  const recurrenceInterval = Number(form.recurrenceInterval || "1");
  const isNthWeekdayMonthly = recurrenceType === "monthly" && form.monthlyPattern === "nth_weekday";
  const daysOfWeek = isNthWeekdayMonthly
    ? [form.nthWeekdayDay]
    : recurrenceType === "weekly"
      ? form.daysOfWeek.reduce<number[]>((acc, selected, index) => {
          if (selected) acc.push(index);
          return acc;
        }, [])
      : [];
  const recurrenceEndDate =
    form.recurrenceEndType === "on_date" ? form.recurrenceEndDate : undefined;
  const recurrenceCount =
    form.recurrenceEndType === "after_count" ? Number(form.recurrenceCount) || undefined : undefined;
  const recurrenceBysetpos =
    isNthWeekdayMonthly ? Number(form.nthWeekdayPosition) || undefined : undefined;
  const fallbackRecurringAnchorDate =
    recurrenceType !== "none" && !form.startDate && !form.dueDate
      ? new Date()
      : undefined;
  const formTimezone = form.timezone || getBrowserTimezone();
  const anchorDate = scheduleEnabled
    ? makeDateFromInput(form.startDate, form.allDay ? undefined : form.startTime, formTimezone)
    : makeDateFromInput(form.dueDate, undefined, formTimezone) ?? fallbackRecurringAnchorDate;
  const existingExdates =
    existingManualItem?.exdates ?? baseItem?.exdates?.map(serializeOccurrenceKey);
  const existingCompletedOccurrences =
    existingManualItem?.completedOccurrences ??
    baseItem?.completedOccurrences?.map(serializeOccurrenceKey);
  const existingReopenedOccurrences =
    existingManualItem?.reopenedOccurrences ??
    baseItem?.reopenedOccurrences?.map(serializeOccurrenceKey);

  return {
    id: id ?? baseItem?.id ?? makeUid(),
    uid: uid ?? existingManualItem?.uid ?? baseItem?.uid ?? `manual-${makeUid()}`,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    hasTime: scheduleEnabled,
    startDate: scheduleEnabled ? form.startDate : undefined,
    startTime: scheduleEnabled && !form.allDay ? form.startTime || undefined : undefined,
    endDate: scheduleEnabled ? form.endDate || undefined : undefined,
    endTime: scheduleEnabled && !form.allDay ? form.endTime || undefined : undefined,
    allDay: scheduleEnabled ? form.allDay : false,
    timezone: formTimezone,
    dueDate: form.hasDueDate || form.dueDate ? form.dueDate : undefined,
    recurrenceType,
    recurrenceInterval,
    daysOfWeek,
    recurrenceEndType: form.recurrenceEndType,
    recurrenceEndDate,
    recurrenceCount,
    recurrenceBysetpos,
    priority: form.priority,
    estimateMinutes: form.estimateMinutes ? Number(form.estimateMinutes) : undefined,
    tags: form.tags.length > 0 ? form.tags : undefined,
    projectId: form.projectId || undefined,
    rrule: buildRRuleString({
      anchorDate,
      recurrenceType,
      recurrenceInterval,
      daysOfWeek,
      recurrenceEndDate,
      recurrenceCount,
      recurrenceBysetpos,
      recurrenceEndType: form.recurrenceEndType,
      timezone: formTimezone,
    }),
    exdates: recurrenceType !== "none" ? existingExdates : undefined,
    completedOccurrences:
      recurrenceType !== "none" ? existingCompletedOccurrences : undefined,
    reopenedOccurrences:
      recurrenceType !== "none" ? existingReopenedOccurrences : undefined,
    deferredUntil:
      existingManualItem?.deferredUntil ?? baseItem?.deferredUntil?.toISOString(),
    dismissedTodayDates:
      existingManualItem?.dismissedTodayDates ?? baseItem?.dismissedTodayDates,
    plannedTodayDates:
      hasExplicitDateOrTime
        ? undefined
        : existingManualItem?.plannedTodayDates ?? baseItem?.plannedTodayDates,
    nowOverrideDate:
      existingManualItem?.nowOverrideDate ?? baseItem?.nowOverrideDate,
    status:
      form.status
      ?? (recurrenceType !== "none"
        ? "active"
        : existingManualItem?.status ?? baseItem?.status ?? "active"),
    reminders: form.reminders && form.reminders.length > 0 ? form.reminders : undefined,
    deletedAt: undefined,
    createdAt: existingManualItem?.createdAt ?? baseItem?.createdAt.toISOString() ?? now,
    updatedAt: now,
  } satisfies ManualItemRecord;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function getPriorityWeight(priority?: string): number {
  return PRIORITY_WEIGHT[priority ?? ""] ?? 0;
}

export function sortDisplayItems(
  items: DisplayItem[],
  config: ListSortConfig,
): DisplayItem[] {
  const result = [...items];

  if (config.mode === "time") {
    result.sort((a, b) => {
      // All-day preference
      if (config.allDayPreference !== "none") {
        const aAllDay = a.time.allDay;
        const bAllDay = b.time.allDay;
        if (aAllDay && !bAllDay) {
          return config.allDayPreference === "allDayFirst" ? -1 : 1;
        }
        if (!aAllDay && bAllDay) {
          return config.allDayPreference === "allDayFirst" ? 1 : -1;
        }
      }

      // Always sort by start time ascending — direction is handled by groupItemsByDay
      const aTime = getAnchorDate(a).getTime();
      const bTime = getAnchorDate(b).getTime();
      return aTime - bTime;
    });
  } else if (config.mode === "created") {
    result.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return config.createdDirection === "asc" ? aTime - bTime : bTime - aTime;
    });
  } else {
    // Priority mode
    result.sort((a, b) => {
      const aWeight = getPriorityWeight(a.priority);
      const bWeight = getPriorityWeight(b.priority);
      if (aWeight !== bWeight) {
        return bWeight - aWeight; // Higher priority first
      }

      // Schedule preference within same priority
      const aUnscheduled = !a.time.start && !a.time.end;
      const bUnscheduled = !b.time.start && !b.time.end;
      if (aUnscheduled && !bUnscheduled) {
        return config.prioritySchedulePreference === "unscheduledFirst" ? -1 : 1;
      }
      if (!aUnscheduled && bUnscheduled) {
        return config.prioritySchedulePreference === "unscheduledFirst" ? 1 : -1;
      }

      // Sub-sort within same priority
      if (config.prioritySubField === "startTime") {
        const aTime = getAnchorDate(a).getTime();
        const bTime = getAnchorDate(b).getTime();
        return config.prioritySubDirection === "asc" ? aTime - bTime : bTime - aTime;
      } else {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return config.prioritySubDirection === "asc" ? aTime - bTime : bTime - aTime;
      }
    });
  }

  return result;
}

export function sortUnscheduledItems(
  items: DisplayItem[],
  sort: "newest" | "oldest" | "priority",
): DisplayItem[] {
  const result = [...items];

  if (sort === "newest") {
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sort === "oldest") {
    result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else {
    result.sort((a, b) => {
      const aWeight = getPriorityWeight(a.priority);
      const bWeight = getPriorityWeight(b.priority);
      if (aWeight !== bWeight) {
        return bWeight - aWeight;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  return result;
}

const DEFAULT_KANBAN_COLUMNS: KanbanColumnId[] = ["backlog", "today", "done"];

const KANBAN_COLUMN_META: Record<KanbanColumnId, { titleKey: string; isCollapsible: boolean }> = {
  backlog: { titleKey: "kanban.column.backlog", isCollapsible: false },
  today: { titleKey: "kanban.column.today", isCollapsible: false },
  done: { titleKey: "kanban.column.done", isCollapsible: true },
};

function isCompletedDisplayItem(item: DisplayItem): boolean {
  if (item.status === "completed") return true;
  if (item.completedAt) return true;
  return false;
}

function isMultiDayHappeningOnDate(item: DisplayItem, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const start = item.time.start;
  const end = item.time.end;
  if (!start || !end) return false;
  return start < dayEnd && end >= dayStart;
}

/**
 * Returns true when an active (non-completed) item has a date anchor
 * earlier than today. Multi-day events (start+end spanning multiple days)
 * are not considered overdue even if the start is in the past.
 */
export function isOverdueDisplayItem(item: DisplayItem, now: Date): boolean {
  if (item.deletedAt) return false;
  if (isCompletedDisplayItem(item)) return false;

  const start = item.time.start;
  const end = item.time.end;
  const due = item.time.due;

  if (start && end && startOfDay(start).getTime() !== startOfDay(end).getTime()) {
    const today = startOfDay(now);
    if (start < today && end >= today) return false;
  }

  const anchor = start ?? end ?? due;
  if (!anchor) return false;

  const today = startOfDay(now);
  return startOfDay(anchor) < today;
}

function isFutureDated(item: DisplayItem, tomorrow: Date): boolean {
  if (item.time.start || item.time.end || item.time.due) {
    return getAnchorDate(item) >= tomorrow;
  }
  if (item.recurrence && !item.isRecurringInstance) {
    const anchor = getAnchorDate(item);
    return anchor >= tomorrow;
  }
  return false;
}

function hasAnyDate(item: DisplayItem): boolean {
  return Boolean(item.time.start || item.time.end || item.time.due || item.recurrence);
}

function hasOnlyDueDate(item: DisplayItem): boolean {
  return Boolean(item.time.due) && !item.time.start && !item.time.end && !item.recurrence;
}

export function buildKanbanColumns(
  items: DisplayItem[],
  now: Date,
  options: BuildKanbanOptions = {},
): KanbanColumn[] {
  const doneLookbackDays = Math.max(0, options.doneLookbackDays ?? 1);
  const enabledColumns = options.enabledColumns ?? DEFAULT_KANBAN_COLUMNS;
  const sortConfig = options.sortConfig;

  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const doneCutoff = new Date(today);
  doneCutoff.setDate(doneCutoff.getDate() - doneLookbackDays);

  const buckets: Record<KanbanColumnId, DisplayItem[]> = {
    backlog: [],
    today: [],
    done: [],
  };

  for (const item of items) {
    if (item.deletedAt) continue;

    if (isCompletedDisplayItem(item)) {
      const completedAt = item.completedAt ?? new Date(item.updatedAt);
      if (completedAt >= doneCutoff) {
        buckets.done.push(item);
      }
      continue;
    }

    if (!hasAnyDate(item)) {
      buckets.backlog.push(item);
      continue;
    }

    if (hasOnlyDueDate(item)) {
      const dueDate = startOfDay(item.time.due!);
      if (dueDate >= tomorrow) {
        buckets.backlog.push(item);
      } else {
        buckets.today.push(item);
      }
      continue;
    }

    if (isFutureDated(item, tomorrow)) {
      continue;
    }

    if (isMultiDayHappeningOnDate(item, today)) {
      buckets.today.push(item);
      continue;
    }

    const anchor = getAnchorDate(item);
    if (anchor < tomorrow) {
      buckets.today.push(item);
    }
  }

  if (sortConfig) {
    const sortColumn = (column: KanbanColumnId) => {
      if (column === "backlog") {
        buckets.backlog = sortUnscheduledItems(buckets.backlog, sortConfig.unscheduledSort);
      } else {
        buckets[column] = sortDisplayItems(buckets[column], sortConfig);
      }
    };
    for (const id of enabledColumns) sortColumn(id);
  }

  return enabledColumns.map((id) => {
    const meta = KANBAN_COLUMN_META[id];
    return {
      id,
      titleKey: meta.titleKey,
      items: buckets[id],
      count: buckets[id].length,
      isCollapsible: meta.isCollapsible,
    };
  });
}
