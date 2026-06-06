"use client";

import { Bell, Circle } from "lucide-react";

import type { AiInlineScheduleItem } from "@/lib/ai/chat-types";
import { formatReviewDate, formatReviewTime } from "@/lib/ai/chat-types";
import { PRIORITY_CONFIG, getPriorityLabel, DAY_NAMES } from "@/lib/all-page-utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type AiInlineItemCardProps = {
  item: AiInlineScheduleItem;
  isFullscreen?: boolean;
};

function buildScheduleLabel(item: AiInlineScheduleItem): string | null {
  if (!item.hasTime && !item.startDate && !item.allDay) return null;

  if (item.allDay) {
    const startLabel = item.startDate ? formatReviewDate(item.startDate) : null;
    const endLabel = item.endDate ? formatReviewDate(item.endDate) : null;
    if (startLabel && endLabel && startLabel !== endLabel) {
      return `${startLabel} - ${endLabel} · All day`;
    }
    return startLabel ? `${startLabel} · All day` : "All day";
  }

  if (item.startDate) {
    const startLabel = formatReviewDate(item.startDate);
    const startTime = item.startTime ? formatReviewTime(item.startTime) : null;
    const endLabel = item.endDate ? formatReviewDate(item.endDate) : null;
    const endTime = item.endTime ? formatReviewTime(item.endTime) : null;

    if (startTime && endTime) {
      const endPart = endLabel && endLabel !== startLabel
        ? `${endLabel} ${endTime}`
        : endTime;
      return `${startLabel}, ${startTime} - ${endPart}`;
    }
    if (startTime) {
      return `${startLabel}, ${startTime}`;
    }
    return startLabel;
  }

  if (item.startTime && item.endTime) {
    return `${formatReviewTime(item.startTime)} - ${formatReviewTime(item.endTime)}`;
  }
  if (item.startTime) {
    return formatReviewTime(item.startTime);
  }

  return null;
}

type TranslateFn = (key: TranslationKey, values?: Record<string, string | number>) => string;

const DAY_NAME_KEYS: TranslationKey[] = ["calendar.daySun", "calendar.dayMon", "calendar.dayTue", "calendar.dayWed", "calendar.dayThu", "calendar.dayFri", "calendar.daySat"];

function buildRecurrenceLabel(item: AiInlineScheduleItem, t?: TranslateFn): string | null {
  if (!item.recurrenceType || item.recurrenceType === "none") return null;

  const interval = Number(item.recurrenceInterval) || 1;
  const endLabel =
    item.recurrenceCount
      ? ` ${t ? t("recurrence.countTimes", { count: item.recurrenceCount }) : `for ${item.recurrenceCount} times`}`
      : item.recurrenceEndDate
        ? ` ${t ? t("recurrence.until", { date: formatReviewDate(item.recurrenceEndDate) ?? item.recurrenceEndDate }) : `until ${formatReviewDate(item.recurrenceEndDate)}`}`
        : "";

  if (item.recurrenceType === "daily") {
    if (t) {
      const key = interval === 1 ? "recurrence.daily" : "recurrence.dailyInterval";
      return t(key, { interval }) + endLabel;
    }
    const base = interval === 1 ? "Daily" : `Every ${interval} days`;
    return `${base}${endLabel}`;
  }

  if (item.recurrenceType === "weekly") {
    const selectedDays = (item.daysOfWeek ?? [])
      .map((dayIndex) => t ? t(DAY_NAME_KEYS[dayIndex]) : DAY_NAMES[dayIndex])
      .filter(Boolean)
      .join(", ");
    if (t) {
      const key = interval === 1 ? "recurrence.weeklyOn" : "recurrence.weeklyOnInterval";
      return t(key, { days: selectedDays, interval }) + endLabel;
    }
    const base = interval === 1
      ? `Weekly${selectedDays ? ` on ${selectedDays}` : ""}`
      : `Every ${interval} weeks${selectedDays ? ` on ${selectedDays}` : ""}`;
    return `${base}${endLabel}`;
  }

  if (item.recurrenceType === "monthly") {
    const dayIndex = item.daysOfWeek?.[0];
    const validDay = (typeof dayIndex === "number" && dayIndex >= 0 && dayIndex <= 6);
    const day = validDay ? (t ? t(DAY_NAME_KEYS[dayIndex]) : DAY_NAMES[dayIndex]) : null;

    if (item.recurrenceBysetpos && day) {
      if (item.recurrenceBysetpos === -1) {
        if (t) {
          const key = interval === 1 ? "recurrence.monthlyOnLast" : "recurrence.monthlyOnLastInterval";
          return t(key, { day, interval }) + endLabel;
        }
        const base = interval === 1
          ? `Monthly on the last ${day}`
          : `Every ${interval} months on the last ${day}`;
        return `${base}${endLabel}`;
      }
      const ORDINAL_KEYS: Record<number, TranslationKey> = {
        1: "recurrence.pos.1st", 2: "recurrence.pos.2nd", 3: "recurrence.pos.3rd", 4: "recurrence.pos.4th", 5: "recurrence.pos.5th",
      };
      const posLabels: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };
      if (t) {
        const position = t(ORDINAL_KEYS[item.recurrenceBysetpos] ?? "recurrence.pos.1st");
        const key = interval === 1 ? "recurrence.monthlyOnNth" : "recurrence.monthlyOnNthInterval";
        return t(key, { position, day, interval }) + endLabel;
      }
      const position = posLabels[item.recurrenceBysetpos] ?? `${item.recurrenceBysetpos}th`;
      const base = interval === 1
        ? `Monthly on the ${position} ${day}`
        : `Every ${interval} months on the ${position} ${day}`;
      return `${base}${endLabel}`;
    }
    if (t) {
      const key = interval === 1 ? "recurrence.monthly" : "recurrence.monthlyInterval";
      return t(key, { interval }) + endLabel;
    }
    const base = interval === 1 ? "Monthly" : `Every ${interval} months`;
    return `${base}${endLabel}`;
  }

  if (item.recurrenceType === "yearly") {
    if (t) {
      const key = interval === 1 ? "recurrence.yearly" : "recurrence.yearlyInterval";
      return t(key, { interval }) + endLabel;
    }
    const base = interval === 1 ? "Yearly" : `Every ${interval} years`;
    return `${base}${endLabel}`;
  }

  return null;
}

function formatReminderMinutes(minutes: number, t: TranslateFn): string {
  if (minutes < 60) return t("reminder.timeMin" as "reminder.timeMin", { minutes });
  if (minutes < 1440) return t("reminder.timeHour" as "reminder.timeHour", { hours: Math.floor(minutes / 60) });
  if (minutes < 10080) return t("reminder.timeDay" as "reminder.timeDay", { days: Math.floor(minutes / 1440) });
  return t("reminder.timeWeek" as "reminder.timeWeek", { weeks: Math.floor(minutes / 10080) });
}

type ScheduleReminder = NonNullable<AiInlineScheduleItem["reminders"]>[number];

function formatReminderLabel(r: ScheduleReminder, t: TranslateFn): string {
  const isAllDay = r.dayOffset != null || r.triggerTime != null;
  if (isAllDay) {
    const time = r.triggerTime ?? "09:00";
    const days = r.dayOffset ?? 0;
    if (days === 0) return t("reminder.sameDayAt" as "reminder.sameDayAt", { time });
    if (days % 7 === 0) return t("reminder.timeWeekAt" as "reminder.timeWeekAt", { weeks: days / 7, time });
    return t("reminder.timeDayAt" as "reminder.timeDayAt", { days, time });
  }
  return t("reminder.timeBefore" as "reminder.timeBefore", { time: formatReminderMinutes(r.minutesBefore, t) });
}

export function AiInlineItemCard({ item, isFullscreen }: AiInlineItemCardProps) {
  const { t } = useI18n();
  const scheduleLabel = buildScheduleLabel(item);
  const recurrenceLabel = buildRecurrenceLabel(item, t);
  const dueLabel = item.hasDueDate && item.dueDate ? formatReviewDate(item.dueDate) : null;

  return (
    <div className={`my-2.5 rounded-2xl border border-black/8 bg-white/80 p-4 dark:border-white/10 dark:bg-white/6 ${isFullscreen ? "max-w-2xl" : ""}`}>
      {/* Time label */}
      {scheduleLabel && (
        <p className="mb-2 text-xs font-medium tracking-[0.05em] tabular-nums text-[#7e7982] uppercase dark:text-[#a3a3a3]">
          {scheduleLabel}
        </p>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="mb-2 -ml-0.5 flex flex-wrap items-center gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-[#d4d4d4]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h4
        className={`font-display text-base font-medium leading-[1.2] tracking-[-0.01em] ${
          item.completed
            ? "text-[#b0a9b2] line-through dark:text-[#737373]"
            : "text-[#333139] dark:text-[#f5f5f5]"
        }`}
      >
        {item.title}
      </h4>

      {/* Description */}
      {item.description ? (
        <p className="mt-2 text-sm leading-6 text-[#706b74] dark:text-[#a3a3a3]">
          {item.description}
        </p>
      ) : null}

      {/* Subtasks */}
      {item.subtasks && item.subtasks.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {item.subtasks.map((subtask, index) => (
            <div key={index} className="flex items-center gap-2.5">
              <Circle className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-[#6f675f]" />
              <span className="text-sm text-[#706b74] dark:text-[#a3a3a3]">{subtask}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Footer: priority · due date · recurrence · estimate · reminders */}
      {(item.priority || dueLabel || recurrenceLabel || item.estimateMinutes || (item.reminders && item.reminders.length > 0)) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.priority ? (
            <span className={`text-xs font-semibold tracking-[0.05em] uppercase ${PRIORITY_CONFIG[item.priority].color.split(" ")[1]}`}>
              {getPriorityLabel(item.priority)}
            </span>
          ) : null}
          {dueLabel ? (
            <span className="text-xs font-medium text-gray-400 dark:text-[#737373]">
              Due: {dueLabel}
            </span>
          ) : null}
          {recurrenceLabel ? (
            <span className="text-xs font-medium text-gray-400 dark:text-[#737373]">
              {recurrenceLabel}
            </span>
          ) : null}
          {item.estimateMinutes ? (
            <span className="text-xs font-medium text-gray-400 dark:text-[#737373]">
              {item.estimateMinutes} min
            </span>
          ) : null}
          {item.reminders && item.reminders.length > 0 && item.reminders.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-[#737373]">
              <Bell className="h-3 w-3" />
              <span>{formatReminderLabel(r, t)}</span>
              <span className="text-gray-300 dark:text-[#555]">·</span>
              <span>{r.method === "push" ? t("reminder.methodPush") : t("reminder.methodEmail")}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
