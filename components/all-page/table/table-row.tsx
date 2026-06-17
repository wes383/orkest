"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Circle, Info, Pencil, Repeat, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { useDateLocale, useSettingsStore } from "@/lib/stores/use-settings-store";
import { canDeleteRecurringSeriesFromDisplayItem, formatDateInput, formatDueDate, getAnchorDate, PRIORITY_CONFIG } from "@/lib/all-page-utils";
import { cn } from "@/lib/utils";
import type { DisplayItem, ManualItemRecord, Reminder } from "@/lib/types/all-page";
import type { Priority } from "@/lib/types/item";
import { ProjectPill } from "@/components/projects/project-pill";

import {
  DateCellEditor,
  PriorityCellEditor,
  ProjectCellEditor,
  RecurrenceCellEditor,
  TagsCellEditor,
  TitleCellEditor,
  type RecurrenceValue,
} from "./table-cell-editors";
import { TableCellTooltip } from "./table-cell-tooltip";
import { ExtraDetailsTooltip } from "./table-extra-details-tooltip";

function formatEstimate(minutes: number | undefined) {
  if (minutes === undefined) return "";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h${mins}m`;
}

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function formatReminder(reminder: Reminder, t: TranslateFn, isAllDay: boolean): string {
  if (isAllDay) {
    const minutes = reminder.minutesBefore;
    const days = reminder.dayOffset ?? Math.floor(minutes / 1440);
    const time = reminder.triggerTime ?? "09:00";
    if (days === 0) return t("reminder.sameDayAt", { time });
    if (days >= 7 && days % 7 === 0) {
      return t("reminder.timeWeekAt", { weeks: days / 7, time });
    }
    return t("reminder.timeDayAt", { days, time });
  }
  const minutes = reminder.minutesBefore;
  if (minutes < 60) return t("reminder.timeMin", { minutes });
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return t("reminder.timeHour", { hours });
  }
  if (minutes < 10080) {
    const days = Math.floor(minutes / 1440);
    return t("reminder.timeDay", { days });
  }
  const weeks = Math.floor(minutes / 10080);
  return t("reminder.timeWeek", { weeks });
}

const DAY_NAME_KEYS = ["calendar.daySun", "calendar.dayMon", "calendar.dayTue", "calendar.dayWed", "calendar.dayThu", "calendar.dayFri", "calendar.daySat"];

function formatRecurrenceTranslated(item: DisplayItem, t: TranslateFn, formatDueDate: (date: Date) => string): string {
  const rec = item.recurrence;
  if (!rec) return "";

  const interval = rec.interval ?? 1;
  const type = rec.type;
  const endLabel = rec.count
    ? ` ${t("recurrence.countTimes", { count: rec.count })}`
    : rec.endDate
      ? ` ${t("recurrence.until", { date: formatDueDate(rec.endDate) })}`
      : "";

  if (type === "daily") {
    const base = interval === 1 ? t("recurrence.daily") : t("recurrence.dailyInterval", { interval });
    return base + endLabel;
  }

  if (type === "weekly") {
    const days = rec.daysOfWeek;
    const dayLabels = days
      ? days.map((d: number) => t(DAY_NAME_KEYS[d] as "calendar.daySun"))
      : [];
    if (dayLabels.length > 0) {
      const dayStr = dayLabels.join(", ");
      const key = interval === 1 ? "recurrence.weeklyOn" : "recurrence.weeklyOnInterval";
      return t(key, { days: dayStr, interval }) + endLabel;
    }
    const key = interval === 1 ? "recurrence.weekly" : "recurrence.weeklyInterval";
    return t(key, { interval }) + endLabel;
  }

  if (type === "monthly") {
    if (rec.bysetpos && rec.daysOfWeek?.length) {
      const day = t(DAY_NAME_KEYS[rec.daysOfWeek[0]] as "calendar.daySun");
      if (rec.bysetpos === -1) {
        const key = interval === 1 ? "recurrence.monthlyOnLast" : "recurrence.monthlyOnLastInterval";
        return t(key, { day, interval }) + endLabel;
      }
      const ORDINAL_KEYS: Record<number, "recurrence.pos.1st" | "recurrence.pos.2nd" | "recurrence.pos.3rd" | "recurrence.pos.4th" | "recurrence.pos.5th"> = {
        1: "recurrence.pos.1st", 2: "recurrence.pos.2nd", 3: "recurrence.pos.3rd", 4: "recurrence.pos.4th", 5: "recurrence.pos.5th",
      };
      const position = t(ORDINAL_KEYS[rec.bysetpos] ?? "recurrence.pos.1st");
      const key = interval === 1 ? "recurrence.monthlyOnNth" : "recurrence.monthlyOnNthInterval";
      return t(key, { position, day, interval }) + endLabel;
    }
    const key = interval === 1 ? "recurrence.monthly" : "recurrence.monthlyInterval";
    return t(key, { interval }) + endLabel;
  }

  if (type === "yearly") {
    const key = interval === 1 ? "recurrence.yearly" : "recurrence.yearlyInterval";
    return t(key, { interval }) + endLabel;
  }

  return "";
}

function formatTimeOfDay(date: Date, locale: string, is12h: boolean) {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: is12h,
  }).format(date);
}

function toInputDate(date?: Date) {
  return date ? formatDateInput(date) : "";
}

function toInputTime(date: Date | undefined, locale: string, is12h: boolean) {
  if (!date) return "";
  const formatted = formatTimeOfDay(date, locale, is12h);
  // Normalize "9:00 AM" -> "09:00" for <input type="time">
  const match = formatted.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

type EditableCell = "title" | "start" | "end" | "project" | "tags" | "priority" | "recurring";

export function TableRow({
  item,
  itemKey,
  isSelected,
  isCompact,
  onToggleSelect,
  onOpen,
  onToggleComplete,
}: {
  item: DisplayItem;
  itemKey: string;
  isSelected: boolean;
  isCompact: boolean;
  onToggleSelect: (key: string) => void;
  onOpen: (item: DisplayItem) => void;
  onToggleComplete: (item: DisplayItem) => void;
}) {
  const { t } = useI18n();
  const projects = useProjectStore((s) => s.projects);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const dateLocale = useDateLocale();
  const is12h = timeFormat === "12h";
  const patchManualItem = useAllPageStore((s) => s.patchManualItem);
  const handleDeleteItem = useAllPageStore((s) => s.handleDeleteItem);
  const manualItems = useAllPageStore((s) => s.manualItems);

  const isCompleted = item.status === "completed";
  const anchorDate = getAnchorDate(item);
  const [editingCell, setEditingCell] = useState<EditableCell | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const tooltipsDisabled = editingCell !== null;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(dateLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [dateLocale],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(dateLocale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: is12h,
      }),
    [dateLocale, is12h],
  );
  const formatDateTimeCell = (date: Date | undefined, showTime: boolean) => {
    if (!date) return "";
    const datePart = dateFormatter.format(date);
    if (!showTime) return datePart;
    return `${datePart} ${timeFormatter.format(date)}`;
  };

  const priority: Priority | undefined = item.priority;
  const priorityConfig = priority ? PRIORITY_CONFIG[priority] : undefined;
  const tags = item.tags ?? [];
  const recurrence = item.recurrence;
  const recurrenceDraft: RecurrenceValue | undefined = recurrence
    ? {
        type: recurrence.type,
        interval: recurrence.interval ?? 1,
        daysOfWeek: recurrence.daysOfWeek ?? [],
        endType: recurrence.endDate
          ? "on_date"
          : recurrence.count !== undefined
            ? "after_count"
            : "never",
        endDate: recurrence.endDate ? formatDateInput(recurrence.endDate) : "",
        count: recurrence.count ?? 10,
        monthlyPattern: "day_of_month",
        nthWeekdayPosition: recurrence.bysetpos ?? 2,
        nthWeekdayDay: recurrence.daysOfWeek?.[0] ?? 1,
      }
    : undefined;
  const recurrenceType = recurrence?.type ?? "none";
  const startDate = item.time.start;
  const endDate = item.time.end;
  const dueDate = item.time.due;
  const allDay = Boolean(item.time.allDay);
  const hasTime = item.time.hasTime ?? false;
  const anchorForStart = startDate ?? dueDate ?? anchorDate;
  const showStartTime = !allDay && hasTime;
  const showEndTime = !allDay && hasTime;
  const startLabel = formatDateTimeCell(anchorForStart, showStartTime);
  const endLabel = formatDateTimeCell(endDate, showEndTime);
  const project = item.projectId ? projects.find((p) => p.id === item.projectId) : undefined;

  function openCell(cell: EditableCell) {
    return (event: React.MouseEvent) => {
      event.stopPropagation();
      setEditingCell(cell);
    };
  }

  function commitTitle(next: string) {
    patchManualItem(item.id, { title: next });
    setEditingCell(null);
  }

  function commitPriority(next: Priority | undefined) {
    patchManualItem(item.id, { priority: next });
    setEditingCell(null);
  }

  function commitProject(next: string | undefined) {
    patchManualItem(item.id, { projectId: next });
    setEditingCell(null);
  }

  function commitTags(next: string[] | undefined) {
    patchManualItem(item.id, { tags: next });
    setEditingCell(null);
  }

  function commitDate(patch: {
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    allDay?: boolean;
  }) {
    patchManualItem(item.id, {
      startDate: patch.startDate,
      startTime: patch.startTime,
      endDate: patch.endDate,
      endTime: patch.endTime,
      allDay: patch.allDay ?? false,
      hasTime: patch.allDay ? false : Boolean(patch.startTime),
    });
    setEditingCell(null);
  }

  function commitRecurrence(next: RecurrenceValue) {
    const daysOfWeek = next.type === "weekly" ? next.daysOfWeek : [];
    const bysetpos =
      next.type === "monthly" && next.monthlyPattern === "nth_weekday"
        ? next.nthWeekdayPosition
        : undefined;
    const recurrenceEndDate =
      next.type !== "none" && next.endType === "on_date" ? next.endDate || undefined : undefined;
    const recurrenceCount =
      next.type !== "none" && next.endType === "after_count" ? next.count : undefined;
    patchManualItem(item.id, {
      recurrenceType: next.type,
      recurrenceInterval: next.type === "none" ? 1 : next.interval,
      daysOfWeek,
      recurrenceEndType: next.type === "none" ? "never" : next.endType,
      recurrenceEndDate,
      recurrenceCount,
      recurrenceBysetpos: bysetpos,
    });
    setEditingCell(null);
  }

  function cancelEdit() {
    setEditingCell(null);
  }

  // Build the list of detail rows shown in the hover tooltip on the actions
  // column's info icon. Each row is omitted when the item has no value for
  // that field. The timezone is only shown when it differs from the browser.
  const subtasks: ManualItemRecord[] = useMemo(
    () => manualItems.filter((r) => r.parentId === item.id && !r.deletedAt),
    [manualItems, item.id],
  );
  const extraDetailRows = useMemo(() => {
    const rows: Array<{ label: string; value: React.ReactNode }> = [];

    if (subtasks.length > 0) {
      const completed = subtasks.filter((s) => s.status === "completed").length;
      const list = subtasks.map((s) => {
        const done = s.status === "completed";
        return (
          <div
            key={s.id}
            className={cn(
              "flex items-center gap-1.5",
              done && "line-through text-[#9f99a3]",
            )}
          >
            {done ? (
              <CheckCircle className="h-3 w-3 shrink-0 text-green-500" />
            ) : (
              <Circle className="h-3 w-3 shrink-0 text-[#9f99a3]" />
            )}
            <span className="truncate">{s.title || "—"}</span>
          </div>
        );
      });
      rows.push({
        label: t("itemForm.subtasks"),
        value: (
          <div className="space-y-1">
            {list}
            <div className="text-[10px] text-[#9f99a3]">
              {t("subtasks.progress", { completed, total: subtasks.length })}
            </div>
          </div>
        ),
      });
    }

    const itemTimezone = item.time.timezone;
    const browserTimezone = getBrowserTimezone();
    if (itemTimezone && itemTimezone !== browserTimezone) {
      rows.push({
        label: t("itemForm.timezone"),
        value: itemTimezone,
      });
    }

    if (dueDate) {
      rows.push({
        label: t("itemForm.dueDate"),
        value: formatDueDate(dueDate),
      });
    }

    const estimateLabel = formatEstimate(item.estimateMinutes);
    if (estimateLabel) {
      rows.push({
        label: t("itemForm.estimatedDuration"),
        value: estimateLabel,
      });
    }

    const reminders = item.reminders ?? [];
    if (reminders.length > 0) {
      rows.push({
        label: t("itemForm.reminders"),
        value: (
          <ul className="space-y-0.5">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center gap-1.5">
                <span>• {formatReminder(r, t as TranslateFn, allDay)}</span>
                <span className="text-[#9f99a3]">
                  ({r.method === "email"
                    ? t("reminder.methodEmail")
                    : t("reminder.methodPush")})
                </span>
              </li>
            ))}
          </ul>
        ),
      });
    }

    if (item.description && item.description.trim()) {
      rows.push({
        label: t("itemForm.notes"),
        value: item.description,
      });
    }

    return rows;
  }, [subtasks, item.time.timezone, dueDate, item.estimateMinutes, item.reminders, item.description, t, allDay]);

  return (
    <tr
      data-item-id={item.id}
      className={cn(
        "border-b border-black/5 dark:border-white/5 transition-colors",
        isSelected
          ? "bg-blue-50/80 dark:bg-blue-950/40"
          : "hover:bg-white/70 dark:hover:bg-white/[0.04]",
        isCompleted && "opacity-55",
      )}
    >
      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(itemKey)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-4 w-4 cursor-pointer rounded border-black/20"
          aria-label={item.title}
        />
      </td>

      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(item);
            }}
            className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#9f99a3] hover:text-[#25242a] dark:hover:text-white"
            aria-label={isCompleted ? t("batch.undo") : t("batch.complete")}
          >
            {isCompleted ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </button>
          {editingCell === "title" ? (
            <TitleCellEditor
              value={item.title}
              onCommit={commitTitle}
              onCancel={cancelEdit}
              label={t("table.column.title")}
            />
          ) : (
            <TableCellTooltip
              label={t("table.column.title")}
              value={item.title || "Untitled"}
              disabled={tooltipsDisabled || !item.title.trim()}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={openCell("title")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditingCell("title");
                  }
                }}
                className={cn(
                  "min-w-0 max-w-[10rem] flex-1 cursor-pointer truncate text-sm text-[#25242a] dark:text-[#f5f5f5]",
                  isCompleted && "line-through",
                )}
              >
                {item.title}
              </span>
            </TableCellTooltip>
          )}
        </div>
      </td>

      <td
        className={cn(
          "px-3 align-middle text-xs text-[#525059] dark:text-[#d4d4d4] tabular-nums whitespace-nowrap",
          isCompact ? "py-1.5" : "py-2.5",
        )}
        onClick={openCell("start")}
      >
        {editingCell === "start" ? (
          <DateCellEditor
            startDate={toInputDate(startDate)}
            startTime={toInputTime(startDate, dateLocale, is12h)}
            endDate={toInputDate(endDate)}
            endTime={toInputTime(endDate, dateLocale, is12h)}
            allDay={allDay}
            onCommit={commitDate}
            onCancel={cancelEdit}
            label={t("table.column.start")}
            trigger={
              <span className="cursor-pointer text-xs">
                {startLabel || <span className="text-[#9f99a3]">—</span>}
              </span>
            }
          />
        ) : (
          <span className="cursor-pointer">
            {startLabel || <span className="text-[#9f99a3]">—</span>}
          </span>
        )}
      </td>

      <td
        className={cn(
          "px-3 align-middle text-xs text-[#525059] dark:text-[#d4d4d4] tabular-nums whitespace-nowrap",
          isCompact ? "py-1.5" : "py-2.5",
        )}
        onClick={openCell("end")}
      >
        {editingCell === "end" ? (
          <DateCellEditor
            startDate={toInputDate(startDate)}
            startTime={toInputTime(startDate, dateLocale, is12h)}
            endDate={toInputDate(endDate)}
            endTime={toInputTime(endDate, dateLocale, is12h)}
            allDay={allDay}
            onCommit={commitDate}
            onCancel={cancelEdit}
            label={t("table.column.end")}
            trigger={
              <span className="cursor-pointer text-xs">
                {endLabel || <span className="text-[#9f99a3]">—</span>}
              </span>
            }
          />
        ) : (
          <span className="cursor-pointer">
            {endLabel || <span className="text-[#9f99a3]">—</span>}
          </span>
        )}
      </td>

      <td
        className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}
        onClick={openCell("project")}
      >
        {editingCell === "project" ? (
          <ProjectCellEditor
            value={item.projectId}
            onCommit={commitProject}
            label={t("table.column.project")}
            trigger={
              <span className="cursor-pointer">
                {project ? (
                  <ProjectPill projectId={project.id} projectName={project.name} />
                ) : (
                  <span className="text-xs text-[#9f99a3]">—</span>
                )}
              </span>
            }
          />
        ) : (
          <TableCellTooltip
            label={t("table.column.project")}
            value={project ? project.name : "—"}
            disabled={tooltipsDisabled || !project}
          >
            <span className="cursor-pointer">
              {project ? (
                <ProjectPill projectId={project.id} projectName={project.name} />
              ) : (
                <span className="text-xs text-[#9f99a3]">—</span>
              )}
            </span>
          </TableCellTooltip>
        )}
      </td>

      <td
        className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}
        onClick={openCell("tags")}
      >
        {editingCell === "tags" ? (
          <TagsCellEditor
            value={tags}
            onCommit={commitTags}
            onCancel={cancelEdit}
            label={t("table.column.tags")}
            trigger={
              <span className="cursor-pointer">
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-w-[10rem]">
                    {tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#525059] dark:text-[#d4d4d4]"
                      >
                        #{tag}
                      </span>
                    ))}
                    {tags.length > 2 ? (
                      <span className="text-[10px] text-[#9f99a3]">+{tags.length - 2}</span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-[#9f99a3]">—</span>
                )}
              </span>
            }
          />
        ) : (
          <TableCellTooltip
            label={t("table.column.tags")}
            value={tags.length > 0 ? tags.map((tag) => `#${tag}`).join(" ") : "—"}
            disabled={tooltipsDisabled || tags.length === 0}
          >
            <span className="cursor-pointer">
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1 max-w-[10rem]">
                  {tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#525059] dark:text-[#d4d4d4]"
                    >
                      #{tag}
                    </span>
                  ))}
                  {tags.length > 2 ? (
                    <span className="text-[10px] text-[#9f99a3]">+{tags.length - 2}</span>
                  ) : null}
                </div>
              ) : (
                <span className="text-xs text-[#9f99a3]">—</span>
              )}
            </span>
          </TableCellTooltip>
        )}
      </td>

      <td
        className={cn(
          "px-3 align-middle text-center",
          isCompact ? "py-1.5" : "py-2.5",
        )}
        onClick={openCell("priority")}
      >
        {editingCell === "priority" ? (
          <PriorityCellEditor
            value={priority}
            onCommit={commitPriority}
            label={t("table.column.priority")}
            trigger={
              <span className="cursor-pointer">
                {priorityConfig ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      color: priorityConfig.textColor,
                      backgroundColor: `${priorityConfig.textColor}1a`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: priorityConfig.textColor }}
                      aria-hidden
                    />
                    {t(`priority.${priority}` as Parameters<typeof t>[0])}
                  </span>
                ) : (
                  <span className="text-xs text-[#9f99a3]">—</span>
                )}
              </span>
            }
          />
        ) : (
          <span className="cursor-pointer">
            {priorityConfig ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  color: priorityConfig.textColor,
                  backgroundColor: `${priorityConfig.textColor}1a`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: priorityConfig.textColor }}
                  aria-hidden
                />
                {t(`priority.${priority}` as Parameters<typeof t>[0])}
              </span>
            ) : (
              <span className="text-xs text-[#9f99a3]">—</span>
            )}
          </span>
        )}
      </td>

      <td
        className={cn(
          "px-3 align-middle text-center text-base",
          isCompact ? "py-1.5" : "py-2.5",
        )}
        onClick={openCell("recurring")}
      >
        {editingCell === "recurring" ? (
          <RecurrenceCellEditor
            value={recurrenceDraft}
            anchorDate={startDate ?? dueDate ?? anchorDate}
            onCommit={commitRecurrence}
            onCancel={cancelEdit}
            label={t("table.column.recurring")}
          />
        ) : (
          <TableCellTooltip
            label={t("table.column.recurring")}
            value={recurrenceType !== "none" ? formatRecurrenceTranslated(item, t as TranslateFn, formatDueDate) : "—"}
          >
            <span className="cursor-pointer">
              {recurrenceType !== "none" ? (
                <Repeat
                  className="inline-block h-3.5 w-3.5 text-[#7d7880] dark:text-[#a3a3a3]"
                  aria-label="Recurring"
                />
              ) : (
                <span className="text-[#9f99a3]">—</span>
              )}
            </span>
          </TableCellTooltip>
        )}
      </td>

      <td className={cn("px-3 align-middle text-right", isCompact ? "py-1.5" : "py-2.5")}>
        <div className="inline-flex items-center gap-1">
          {extraDetailRows.length > 0 && (
            <ExtraDetailsTooltip rows={extraDetailRows} disabled={tooltipsDisabled}>
              <span
                role="img"
                aria-label={t("common.moreInfo")}
                data-testid="row-info-icon"
                className="inline-flex h-6 w-6 cursor-default items-center justify-center rounded text-[#9f99a3] hover:text-[#25242a] hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/10"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </ExtraDetailsTooltip>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(item);
            }}
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#9f99a3] hover:text-[#25242a] hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/10"
            aria-label={t("common.edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canDeleteRecurringSeriesFromDisplayItem(item)) {
                setDeleteDialogOpen(true);
              } else {
                handleDeleteItem(item, item.isRecurringInstance ? "single" : "series");
              }
            }}
            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#9f99a3] hover:text-red-600 hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:bg-red-400/10"
            aria-label={t("common.delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
      {deleteDialogOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
            onClick={() => setDeleteDialogOpen(false)}
          >
            <div
              className="w-72 rounded-3xl border border-black/5 bg-white p-0 shadow-[0_24px_64px_rgba(28,24,35,0.16)] dark:border-white/10 dark:bg-[#1a1a1a]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sr-only" role="dialog" aria-label={t("recurrence.deleteTitle")} />
              <div className="px-6 pt-6 pb-2">
                <p className="text-base font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("recurrence.deleteTitle")}</p>
                <p className="mt-1 text-xs text-[#9f99a3]">{t("recurrence.deleteSubtitle")}</p>
              </div>
              <div className="space-y-0.5 px-2 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteItem(item, "single");
                    setDeleteDialogOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                >
                  <Trash2 className="h-4 w-4 shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-[#25242a] dark:text-[#f5f5f5]">{t("recurrence.deleteThisOccurrence")}</p>
                    <p className="text-[11px] text-[#9f99a3]">{t("recurrence.deleteThisOccurrenceDesc")}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteItem(item, "series");
                    setDeleteDialogOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                >
                  <Trash2 className="h-4 w-4 shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-[#25242a] dark:text-[#f5f5f5]">{t("recurrence.deleteEntireSeries")}</p>
                    <p className="text-[11px] text-[#9f99a3]">{t("recurrence.deleteEntireSeriesDesc")}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(false)}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-[#7d7880] transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                >
                  {t("itemForm.cancel")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </tr>
  );
}
