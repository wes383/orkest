"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, Repeat, X } from "lucide-react";

import { ItemCard } from "./item-card";
import { getFilteredListItems } from "./list-view";
import { Button } from "@/components/ui/button";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useSettingsStore, getDateLocale } from "@/lib/stores/use-settings-store";
import { useI18n } from "@/lib/i18n";
import { getBrowserTimezone } from "@/lib/timezone";
import type { DisplayItem, ListFilterConfig, Section } from "@/lib/types/all-page";
import type { CandidateItem } from "@/lib/ai/candidate-search";
import {
  PRIORITY_CONFIG,
  emptyForm,
  formatDateInput,
  formatItemTime,
  getAnchorDate,
  getDisplayItemKey,
  getWeekStartDate,
  hasNoDate,
} from "@/lib/all-page-utils";

type MorePopoverState = { items: DisplayItem[]; date: Date; x: number; y: number } | null;
type EventPopoverState = { item: DisplayItem; x: number; y: number } | null;
type AddPopoverState = { date: Date; time?: string; x: number; y: number } | null;

interface ToastMessage {
  id: number;
  itemTitle: string;
  newTime: string;
  undoAction: () => void;
}

export type CalendarMode = "month" | "week" | "day";

export type CalendarNavState = {
  mode: CalendarMode;
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSetMode: (m: CalendarMode) => void;
};

type CalendarViewProps = {
  sections: Section[];
  filterConfig: ListFilterConfig;
  onNavigateRef?: React.MutableRefObject<((direction: -1 | 1) => void) | null>;
  onNavStateChange?: (state: CalendarNavState) => void;
};

const CALENDAR_DRAG_MIME = "application/x-orkest-calendar-item";
const MAX_MONTH_EVENTS = 3;

function getCalendarTz(): string | undefined {
  return getBrowserTimezone() || undefined;
}

function getMonthTitleFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: "long",
    year: "numeric",
    timeZone: getCalendarTz(),
  });
}

function getShortDateFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: "short",
    day: "numeric",
    timeZone: getCalendarTz(),
  });
}

function getWeekdayDateFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: getCalendarTz(),
  });
}

function getTimeLabelFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    hour: "numeric",
    minute: "2-digit",
    hour12: useSettingsStore.getState().timeFormat === "12h",
    timeZone: getCalendarTz(),
  });
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function startOfWeek(date: Date) {
  return getWeekStartDate(date);
}

function startOfMonthGrid(date: Date) {
  return startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
}

function isSameDay(left: Date, right: Date) {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function getDateKey(date: Date) {
  return formatDateInput(date);
}

function getWeeksInMonth(cursor: Date) {
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const gridStart = startOfWeek(firstDay);
  const gridEnd = startOfWeek(lastDay);
  const diffDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000);
  return (diffDays / 7) + 1;
}

function getCalendarRange(mode: CalendarMode, cursor: Date) {
  if (mode === "month") {
    const start = startOfMonthGrid(cursor);
    const weeks = getWeeksInMonth(cursor);
    return { start, end: endOfDay(addDays(start, weeks * 7 - 1)) };
  }

  if (mode === "week") {
    const start = startOfWeek(cursor);
    return { start, end: endOfDay(addDays(start, 6)) };
  }

  return { start: startOfDay(cursor), end: endOfDay(cursor) };
}

function getItemSpan(item: DisplayItem) {
  const occurrenceDate = item.occurrenceDate ? startOfDay(item.occurrenceDate) : null;
  const start = item.time.start ? startOfDay(item.time.start) : occurrenceDate;
  let end = item.time.end ? startOfDay(item.time.end) : start;
  const due = item.time.due ? startOfDay(item.time.due) : null;

  if (item.time.start && item.time.end) {
    const isMidnightEnd = item.time.end.getTime() === startOfDay(item.time.end).getTime();
    if (isMidnightEnd && item.time.end.getTime() > item.time.start.getTime()) {
      end = startOfDay(new Date(item.time.end.getTime() - 1));
    }
  }

  if (start) {
    return { start, end: end ?? start };
  }

  if (due) {
    return { start: due, end: due };
  }

  return null;
}

function getItemDateKeys(item: DisplayItem, rangeStart: Date, rangeEnd: Date) {
  const span = getItemSpan(item);
  if (!span) return [];

  const first = startOfDay(new Date(Math.max(span.start.getTime(), rangeStart.getTime())));
  const last = startOfDay(new Date(Math.min(span.end.getTime(), rangeEnd.getTime())));
  const keys: string[] = [];

  for (let cursor = first; cursor <= last; cursor = addDays(cursor, 1)) {
    keys.push(getDateKey(cursor));
  }

  return keys;
}

function isAllDayItem(item: DisplayItem) {
  return Boolean(item.time.allDay || (item.time.start && !item.time.start.getHours() && !item.time.start.getMinutes() && !item.time.end));
}

function getSlotTime(slot: number) {
  return `${String(slot).padStart(2, "0")}:00`;
}

function getSlotLabel(slot: number) {
  const date = new Date();
  date.setHours(slot, 0, 0, 0);
  return getTimeLabelFormatter().format(date);
}

function sortCalendarItems(items: DisplayItem[]) {
  return [...items].sort((left, right) => {
    const leftAllDay = isAllDayItem(left);
    const rightAllDay = isAllDayItem(right);
    if (leftAllDay && !rightAllDay) return -1;
    if (!leftAllDay && rightAllDay) return 1;
    return getAnchorDate(left).getTime() - getAnchorDate(right).getTime();
  });
}

type LayoutedItem = { item: DisplayItem; column: number; totalColumns: number };

function layoutOverlappingItems(items: DisplayItem[], day: Date): LayoutedItem[] {
  if (items.length === 0) return [];

  function effectiveStartSlot(item: DisplayItem) {
    const start = item.time.start ?? item.time.due ?? item.occurrenceDate;
    if (!start) return 0;
    const isStartDay = isSameDay(start, day);
    if (isStartDay) return start.getHours() * 60 + start.getMinutes();
    return 0;
  }
  function effectiveEndSlot(item: DisplayItem) {
    const start = item.time.start ?? item.time.due ?? item.occurrenceDate;
    const end = item.time.end;
    const isStartDay = start && isSameDay(start, day);
    const isEndDay = end && isSameDay(end, day);

    if (!end) {
      const startMin = isStartDay && start ? start.getHours() * 60 + start.getMinutes() : 0;
      return startMin + 15;
    }

    if (isEndDay) return end.getHours() * 60 + end.getMinutes();
    if (end > day) return 1440;
    return 0;
  }

  const sorted = [...items].sort((a, b) => {
    const aStart = effectiveStartSlot(a);
    const bStart = effectiveStartSlot(b);
    if (aStart !== bStart) return aStart - bStart;
    return effectiveEndSlot(a) - effectiveEndSlot(b);
  });

  const groups: DisplayItem[][] = [];
  let currentGroup: DisplayItem[] = [sorted[0]];
  let groupEnd = effectiveEndSlot(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const itemStart = effectiveStartSlot(item);
    if (itemStart < groupEnd) {
      currentGroup.push(item);
      groupEnd = Math.max(groupEnd, effectiveEndSlot(item));
    } else {
      groups.push(currentGroup);
      currentGroup = [item];
      groupEnd = effectiveEndSlot(item);
    }
  }
  groups.push(currentGroup);

  const result: LayoutedItem[] = [];
  for (const group of groups) {
    const columns: number[] = [];
    for (const item of group) {
      const itemStart = effectiveStartSlot(item);
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (columns[col] <= itemStart) {
          columns[col] = effectiveEndSlot(item);
          result.push({ item, column: col, totalColumns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push(effectiveEndSlot(item));
        result.push({ item, column: columns.length - 1, totalColumns: 0 });
      }
    }
    const totalCols = columns.length;
    for (const entry of result) {
      if (group.includes(entry.item)) {
        entry.totalColumns = totalCols;
      }
    }
  }

  return result;
}

function CalendarEvent({
  item,
  compact = false,
  onOpen,
}: {
  item: DisplayItem;
  compact?: boolean;
  onOpen: (item: DisplayItem, x: number, y: number) => void;
}) {
  const { t } = useI18n();
  const disabledCalendarDrag = Boolean(item.isRecurringInstance || item.recurrence);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const priorityConfig = item.priority ? PRIORITY_CONFIG[item.priority] : null;
  const priorityColor = priorityConfig?.textColor ?? "#5f5a63";
  const priorityBgColor = priorityConfig?.color.split(" ")[0] ?? "bg-white/70";
  const timeLabel = formatItemTime(item, true);

  const subtaskTitles = useMemo(
    () => manualItems.filter((r) => r.parentId === item.id && !r.deletedAt).map((s) => s.title),
    [manualItems, item.id],
  );

  function buildCandidateItem(): CandidateItem {
    const daysOfWeek = item.recurrence?.daysOfWeek ?? [];
    const daysOfWeekBoolean = Array(7).fill(false);
    for (const day of daysOfWeek) {
      if (day >= 0 && day <= 6) {
        daysOfWeekBoolean[day] = true;
      }
    }

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      hasTime: Boolean(item.time.start),
      startDate: item.time.start ? formatDateInput(item.time.start) : undefined,
      startTime: item.time.start?.toTimeString().slice(0, 5),
      endDate: item.time.end ? formatDateInput(item.time.end) : undefined,
      endTime: item.time.end?.toTimeString().slice(0, 5),
      allDay: item.time.allDay ?? false,
      hasDueDate: Boolean(item.time.due),
      dueDate: item.time.due ? formatDateInput(item.time.due) : undefined,
      recurrenceType: item.recurrence?.type ?? "none",
      recurrenceInterval: item.recurrence?.interval?.toString() ?? "1",
      daysOfWeek: daysOfWeekBoolean,
      recurrenceEndType: item.recurrence?.count ? ("after_count" as const) : item.recurrence?.endDate ? ("on_date" as const) : ("never" as const),
      recurrenceEndDate: item.recurrence?.endDate ? formatDateInput(item.recurrence.endDate) : undefined,
      recurrenceCount: item.recurrence?.count,
      recurrenceBysetpos: item.recurrence?.bysetpos,
      status: item.status,
      priority: item.priority,
      estimateMinutes: item.estimateMinutes?.toString() ?? "",
      tags: item.tags ?? [],
      projectId: item.projectId,
      subtasks: subtaskTitles,
    };
  }

  function handleDragStart(e: React.DragEvent<HTMLButtonElement>) {
    e.dataTransfer.setData("application/json", JSON.stringify(buildCandidateItem()));
    e.dataTransfer.effectAllowed = "move";
    document.body.classList.add("is-item-dragging");
    document.body.classList.add("is-calendar-event-dragging");

    if (!disabledCalendarDrag) {
      e.dataTransfer.setData(CALENDAR_DRAG_MIME, getDisplayItemKey(item));
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const preview = document.createElement("div");
    const isDark = document.documentElement.classList.contains("dark");
    preview.style.cssText = `
      position: fixed; top: 0; left: 0; width: ${rect.width}px; height: ${rect.height}px; pointer-events: none; z-index: 9999;
      padding: 8px 10px; border-radius: 8px;
      background: ${isDark ? "rgba(32, 32, 32, 0.88)" : "rgba(252, 251, 250, 0.85)"}; backdrop-filter: blur(18px) saturate(140%);
      border: ${isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(255, 255, 255, 0.4)"};
      box-shadow: ${isDark ? "0 12px 32px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.08)" : "0 8px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35)"};
      font-family: var(--font-sans); font-size: 12px; font-weight: 600; color: ${isDark ? "#f5f5f5" : "#333139"};
      display: flex; align-items: center; gap: 8px;
      transform: translate(-200vw, -200vh);
    `;
    const dot = document.createElement("span");
    dot.style.cssText = `width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; background: ${priorityColor};`;
    const title = document.createElement("span");
    title.textContent = item.title;
    title.style.cssText = "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
    preview.appendChild(dot);
    preview.appendChild(title);
    document.body.appendChild(preview);

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    preview.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;

    const handleDragOver = (ev: globalThis.DragEvent) => {
      if (ev.clientX > 0 && ev.clientY > 0) {
        preview.style.transform = `translate(${ev.clientX - offsetX}px, ${ev.clientY - offsetY}px)`;
      }
    };
    document.addEventListener("dragover", handleDragOver, true);

    const cleanup = () => {
      document.removeEventListener("dragover", handleDragOver, true);
      preview.remove();
    };
    e.currentTarget.addEventListener("dragend", cleanup, { once: true });

    const transparentImage = document.createElement("canvas");
    transparentImage.width = 1;
    transparentImage.height = 1;
    e.dataTransfer.setDragImage(transparentImage, 0, 0);
  }

  function handleDragEnd() {
    document.body.classList.remove("is-item-dragging");
    document.body.classList.remove("is-calendar-event-dragging");
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item, event.clientX, event.clientY);
      }}
      title={disabledCalendarDrag ? t("calendar.recurringEditHint") : t("calendar.dragToReschedule")}
      className={`group/event flex h-full w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-black/6 px-2 py-1.5 text-left shadow-sm transition-colors ${priorityBgColor} hover:brightness-95 ${
        disabledCalendarDrag ? "cursor-default opacity-80" : ""
      } ${item.status === "completed" ? "opacity-55" : ""}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: priorityColor }} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-xs font-semibold text-[#333139] ${item.status === "completed" ? "line-through" : ""}`}>
          {item.title}
        </span>
        {!compact && timeLabel ? (
          <span className="mt-0.5 block truncate text-[11px] text-[#8c8691]">
            {timeLabel}
          </span>
        ) : null}
      </span>
      {disabledCalendarDrag ? <Repeat className="mt-0.5 h-3 w-3 shrink-0 text-[#aaa3ad]" /> : null}
    </button>
  );
}

export function CalendarView({ sections, filterConfig, onNavigateRef, onNavStateChange }: CalendarViewProps) {
  const { t } = useI18n();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [mode, setMode] = useState<CalendarMode>("month");
  const [cursorDate, setCursorDate] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [morePopover, setMorePopover] = useState<MorePopoverState>(null);
  const [eventPopover, setEventPopover] = useState<EventPopoverState>(null);
  const [addPopover, setAddPopover] = useState<AddPopoverState>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const morePopoverRef = useRef<HTMLDivElement>(null);
  const eventPopoverRef = useRef<HTMLDivElement>(null);
  const addPopoverRef = useRef<HTMLDivElement>(null);
  const openComposerWithForm = useAllPageStore((s) => s.openComposerWithForm);
  const rescheduleItemFromCalendar = useAllPageStore((s) => s.rescheduleItemFromCalendar);
  useSettingsStore((s) => s.locale);

  const range = useMemo(() => getCalendarRange(mode, cursorDate), [cursorDate, mode]);
  const allItems = useMemo(
    () => getFilteredListItems(sections, filterConfig),
    [sections, filterConfig],
  );

  const itemMap = useMemo(() => {
    const result = new Map<string, DisplayItem>();
    for (const item of allItems) {
      result.set(getDisplayItemKey(item), item);
    }
    return result;
  }, [allItems]);

  const scheduledItems = useMemo(
    () => sortCalendarItems(allItems.filter((item) => !hasNoDate(item) || item.time.due)),
    [allItems],
  );
  const unscheduledItems = useMemo(
    () => sortCalendarItems(allItems.filter((item) => hasNoDate(item) && !item.time.due)),
    [allItems],
  );

  const itemsByDate = useMemo(() => {
    const result = new Map<string, DisplayItem[]>();
    for (const item of scheduledItems) {
      for (const key of getItemDateKeys(item, range.start, range.end)) {
        const items = result.get(key) ?? [];
        items.push(item);
        result.set(key, items);
      }
    }
    for (const [key, items] of result) {
      result.set(key, sortCalendarItems(items));
    }
    return result;
  }, [range.end, range.start, scheduledItems]);

  useEffect(() => {
    if (!morePopover && !eventPopover && !addPopover) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (morePopoverRef.current && !morePopoverRef.current.contains(target)) setMorePopover(null);
      if (eventPopoverRef.current && !eventPopoverRef.current.contains(target)) setEventPopover(null);
      if (addPopoverRef.current && !addPopoverRef.current.contains(target)) setAddPopover(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEventPopover(null);
        setMorePopover(null);
        setAddPopover(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [morePopover, eventPopover, addPopover]);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>, date: Date, time?: string) => {
      const itemKey = event.dataTransfer.getData(CALENDAR_DRAG_MIME);
      if (!itemKey) return;
      event.preventDefault();
      const item = itemMap.get(itemKey);
      if (!item) return;

      let resolvedTime = time;
      if (mode === "week" && item.time.start && !isAllDayItem(item)) {
        const originalDate = startOfDay(item.time.start);
        const dropDate = startOfDay(date);
        if (originalDate.getTime() !== dropDate.getTime()) {
          const originalTime = `${String(item.time.start.getHours()).padStart(2, "0")}:${String(item.time.start.getMinutes()).padStart(2, "0")}`;
          resolvedTime = originalTime;
        }
      }

      const originalStartDate = item.time.start ? formatDateInput(item.time.start) : undefined;
      const originalStartTime = item.time.start ? `${String(item.time.start.getHours()).padStart(2, "0")}:${String(item.time.start.getMinutes()).padStart(2, "0")}` : undefined;

      rescheduleItemFromCalendar(item, { date: getDateKey(date), time: resolvedTime });
      setSelectedDate(startOfDay(date));
      setMorePopover(null);
      setEventPopover(null);
      setAddPopover(null);

      const newTimeStr = resolvedTime || "all day";

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      setToast({
        id: Date.now(),
        itemTitle: item.title,
        newTime: newTimeStr,
        undoAction: () => {
          rescheduleItemFromCalendar(item, {
            date: originalStartDate || getDateKey(date),
            time: originalStartTime,
          });
          setToast(null);
        },
      });

      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 5000);
    },
    [itemMap, rescheduleItemFromCalendar, mode],
  );

  function allowDrop(event: DragEvent<HTMLElement>) {
    if (event.dataTransfer.types.includes(CALENDAR_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  const moveCursor = useCallback((direction: -1 | 1) => {
    setCursorDate((current) => {
      if (mode === "month") return new Date(current.getFullYear(), current.getMonth() + direction, 1);
      if (mode === "week") return addDays(current, direction * 7);
      return addDays(current, direction);
    });
  }, [mode]);

  useEffect(() => {
    if (onNavigateRef) {
      onNavigateRef.current = moveCursor;
    }
  }, [onNavigateRef, moveCursor]);


  function goToday() {
    const today = startOfDay(new Date());
    setCursorDate(today);
    setSelectedDate(today);
  }

  function selectDate(date: Date) {
    const day = startOfDay(date);
    setSelectedDate(day);
    setMorePopover(null);
    setEventPopover(null);
    setAddPopover(null);
    if (mode === "month") {
      setCursorDate(day);
    }
  }

  function enterDayView(date: Date) {
    const day = startOfDay(date);
    setMode("day");
    setCursorDate(day);
    setSelectedDate(day);
    setMorePopover(null);
    setEventPopover(null);
    setAddPopover(null);
  }

  function handleOpenEvent(item: DisplayItem, x: number, y: number) {
    setEventPopover({ item, x, y });
  }

  function handleOpenMore(items: DisplayItem[], date: Date, x: number, y: number) {
    setMorePopover({ items, date, x, y });
  }

  function handleOpenAdd(date: Date, time: string | undefined, x: number, y: number) {
    setAddPopover({ date, time, x, y });
  }

  function handleAddConfirm() {
    if (!addPopover) return;
    const dateStr = formatDateInput(addPopover.date);
    if (addPopover.time) {
      const [h, m] = addPopover.time.split(":").map(Number);
      const end = new Date(2000, 0, 1, h + 1, m);
      const endTime = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
      openComposerWithForm({
        ...emptyForm,
        hasTime: true,
        startDate: dateStr,
        startTime: addPopover.time,
        endDate: dateStr,
        endTime,
      });
    } else {
      openComposerWithForm({
        ...emptyForm,
        hasTime: true,
        allDay: true,
        startDate: dateStr,
      });
    }
    setAddPopover(null);
  }

  const title =
    mode === "month"
      ? getMonthTitleFormatter().format(cursorDate)
      : mode === "week"
        ? `${getShortDateFormatter().format(range.start)} - ${getShortDateFormatter().format(range.end)}`
        : getWeekdayDateFormatter().format(cursorDate);

  useEffect(() => {
    if (onNavStateChange) {
      onNavStateChange({
        mode,
        title,
        onPrev: () => moveCursor(-1),
        onNext: () => moveCursor(1),
        onToday: goToday,
        onSetMode: setMode,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, title, moveCursor]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-black/8 bg-white/45 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-[#25242a]">{title}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative grid grid-cols-3 rounded-full border border-black/8 bg-[#f4f0ec]/[0.5] dark:bg-[#2a2a2a] dark:border-white/10 p-0.5">
            {/* Sliding background */}
            <div
              className="absolute top-0.5 bottom-0.5 rounded-full bg-[#ffffff] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#d4d4d4]"
              style={{
                left: `calc(2px + ${mode === "month" ? 0 : mode === "week" ? 1 : 2} * (100% - 4px) / 3)`,
                width: "calc((100% - 4px) / 3)",
              }}
            />
            {(["month", "week", "day"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setMode(entry)}
                className={`relative z-10 cursor-pointer rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  mode === entry ? "text-[#1a1a1a] dark:text-[#000000]" : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                }`}
              >
                {entry === "month" ? t("calendar.month") : entry === "week" ? t("calendar.week") : t("calendar.day")}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => moveCursor(-1)} className="h-8 w-8 rounded-full p-0" aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={goToday} className="h-8 rounded-full px-3 text-xs">
            {t("listControls.today")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => moveCursor(1)} className="h-8 w-8 rounded-full p-0" aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {mode === "month" ? (
          <MonthCalendar
            cursorDate={cursorDate}
            selectedDate={selectedDate}
            itemsByDate={itemsByDate}
            onEnterDayView={enterDayView}
            onOpenItem={handleOpenEvent}
            onOpenMore={handleOpenMore}
            onOpenAdd={handleOpenAdd}
            onDragOver={allowDrop}
            onDrop={handleDrop}
            isMobile={isMobile}
          />
        ) : mode === "week" ? (
          <TimeGrid
            mode="week"
            cursorDate={cursorDate}
            rangeStart={range.start}
            itemsByDate={itemsByDate}
            onSelectDate={selectDate}
            onOpenItem={handleOpenEvent}
            onOpenAdd={handleOpenAdd}
            onDragOver={allowDrop}
            onDrop={handleDrop}
          />
        ) : (
          <TimeGrid
            mode="day"
            cursorDate={cursorDate}
            rangeStart={range.start}
            itemsByDate={itemsByDate}
            onSelectDate={selectDate}
            onOpenItem={handleOpenEvent}
            onOpenAdd={handleOpenAdd}
            onDragOver={allowDrop}
            onDrop={handleDrop}
          />
        )}

        <UnscheduledPanel items={unscheduledItems} onOpenItem={handleOpenEvent} />
      </div>

      {morePopover && (
        <MorePopover ref={morePopoverRef} popover={morePopover} onClose={() => setMorePopover(null)} onOpenEvent={handleOpenEvent} />
      )}
      {eventPopover && (
        <EventPopover ref={eventPopoverRef} popover={eventPopover} onClose={() => setEventPopover(null)} />
      )}
      {addPopover && (
        <AddPopover ref={addPopoverRef} popover={addPopover} onClose={() => setAddPopover(null)} onConfirm={handleAddConfirm} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#25242a] text-white px-4 py-2.5 rounded-xl shadow-lg">
          <span className="text-sm">
            <span className="font-medium">{toast.itemTitle}</span> moved to {toast.newTime}
          </span>
          <button
            type="button"
            onClick={toast.undoAction}
            className="text-sm font-medium text-white/70 hover:text-white underline underline-offset-2 cursor-pointer"
          >
            {t("common.undo")}
          </button>
        </div>
      )}
    </div>
  );
}

function MonthCalendar({
  cursorDate,
  selectedDate,
  itemsByDate,
  onEnterDayView,
  onOpenItem,
  onOpenMore,
  onOpenAdd,
  onDragOver,
  onDrop,
  isMobile,
}: {
  cursorDate: Date;
  selectedDate: Date;
  itemsByDate: Map<string, DisplayItem[]>;
  onEnterDayView: (date: Date) => void;
  onOpenItem: (item: DisplayItem, x: number, y: number) => void;
  onOpenMore: (items: DisplayItem[], date: Date, x: number, y: number) => void;
  onOpenAdd: (date: Date, time: string | undefined, x: number, y: number) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>, date: Date, time?: string) => void;
  isMobile: boolean;
}) {
  const { t } = useI18n();
  const cells = useMemo(() => {
    const start = startOfMonthGrid(cursorDate);
    const weeks = getWeeksInMonth(cursorDate);
    return Array.from({ length: weeks * 7 }, (_, index) => addDays(start, index));
  }, [cursorDate]);

  const startDay = useSettingsStore((s) => s.weekStartDay);
  const translatedDayKeys = ["calendar.daySun", "calendar.dayMon", "calendar.dayTue", "calendar.dayWed", "calendar.dayThu", "calendar.dayFri", "calendar.daySat"] as const;
  const orderedDayKeys = [...translatedDayKeys.slice(startDay), ...translatedDayKeys.slice(0, startDay)];

  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-white/55 shadow-sm">
      <div className="grid grid-cols-7 border-b border-black/8 bg-[#f4f0ec]/55">
        {orderedDayKeys.map((key) => (
          <div key={key} className="px-2 py-2 text-center text-[11px] font-semibold tracking-[0.14em] text-[#8c8691] uppercase">
            {t(key)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const key = getDateKey(date);
          const items = itemsByDate.get(key) ?? [];
          const isOutsideMonth = date.getMonth() !== cursorDate.getMonth();
          const selected = isSameDay(date, selectedDate);
          const today = isSameDay(date, new Date());
          return (
            <section
              key={key}
              onDragOver={onDragOver}
              onDrop={(event) => onDrop(event, date)}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                if (isMobile && items.length > 0) {
                  onOpenMore(items, date, event.clientX, event.clientY);
                } else {
                  onOpenAdd(date, undefined, event.clientX, event.clientY);
                }
              }}
              className={`min-h-16 sm:min-h-32 cursor-pointer border-b border-r border-black/8 p-1 sm:p-2 transition-colors ${
                isOutsideMonth ? "bg-white/35" : "bg-white/70"
              }`}
            >
              <button
                type="button"
                onClick={() => onEnterDayView(date)}
                className={`mb-1 sm:mb-2 flex h-6 w-6 sm:h-7 sm:w-7 cursor-pointer items-center justify-center rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                  today ? "bg-[#25242a] text-white hover:bg-[#3a3840]" : selected ? "bg-white text-[#25242a] hover:bg-black/4" : "text-[#5f5a63] hover:bg-black/4"
                }`}
              >
                {date.getDate()}
              </button>
              <div className="flex flex-wrap gap-0.5 justify-center sm:block sm:space-y-1">
                {isMobile ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (items.length > 0) onOpenMore(items, date, event.clientX, event.clientY);
                    }}
                    className="flex flex-wrap gap-0.5 justify-center w-full cursor-pointer"
                    aria-label={`${items.length} events`}
                  >
                    {items.slice(0, 4).map((item) => {
                      const priorityConfig = item.priority ? PRIORITY_CONFIG[item.priority] : null;
                      const priorityColor = priorityConfig?.textColor ?? "#5f5a63";
                      return (
                        <span
                          key={getDisplayItemKey(item)}
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: priorityColor }}
                        />
                      );
                    })}
                    {items.length > 4 && (
                      <span className="text-[8px] font-semibold text-[#9f99a3] leading-none mt-0.5">
                        +{items.length - 4}
                      </span>
                    )}
                  </button>
                ) : (
                  <>
                    {items.slice(0, MAX_MONTH_EVENTS).map((item) => (
                      <CalendarEvent key={getDisplayItemKey(item)} item={item} compact onOpen={onOpenItem} />
                    ))}
                    {items.length > MAX_MONTH_EVENTS ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenMore(items, date, event.clientX, event.clientY);
                        }}
                        className="w-full cursor-pointer rounded-lg px-2 py-1 text-left text-xs font-medium text-[#7d7880] hover:bg-black/3"
                      >
                        +{items.length - MAX_MONTH_EVENTS} {t("calendar.more")}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  return now;
}

function TimeGrid({
  mode,
  rangeStart,
  itemsByDate,
  onSelectDate,
  onOpenItem,
  onOpenAdd,
  onDragOver,
  onDrop,
}: {
  mode: "week" | "day";
  cursorDate: Date;
  rangeStart: Date;
  itemsByDate: Map<string, DisplayItem[]>;
  onSelectDate: (date: Date) => void;
  onOpenItem: (item: DisplayItem, x: number, y: number) => void;
  onOpenAdd: (date: Date, time: string | undefined, x: number, y: number) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>, date: Date, time?: string) => void;
}) {
  const { t } = useI18n();
  const days = useMemo(
    () => (mode === "week" ? Array.from({ length: 7 }, (_, index) => addDays(rangeStart, index)) : [rangeStart]),
    [mode, rangeStart],
  );
  const slots = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const now = useCurrentTime();
  const isToday = isSameDay(rangeStart, now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const MINUTES_PER_SLOT = 60;
  const SLOT_HEIGHT = 96;
  const PX_PER_MINUTE = SLOT_HEIGHT / MINUTES_PER_SLOT;
  const currentTop = currentMinutes * PX_PER_MINUTE;

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white/55 shadow-sm">
      <div className={mode === "week" ? "min-w-190" : "w-full min-w-0"}>
        <div className={`grid border-b border-black/8 bg-[#f4f0ec]/55 ${mode === "week" ? "grid-cols-[72px_repeat(7,minmax(96px,1fr))]" : "grid-cols-[72px_minmax(0,1fr)]"}`}>
          <div className="px-2 py-2 text-[11px] font-semibold tracking-[0.14em] text-[#8c8691] uppercase">{t("calendar.allDay")}</div>
          {days.map((day) => {
            const items = (itemsByDate.get(getDateKey(day)) ?? []).filter(isAllDayItem);
            return (
              <div
                key={getDateKey(day)}
                onDragOver={onDragOver}
                onDrop={(event) => onDrop(event, day)}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button")) return;
                  onOpenAdd(day, undefined, event.clientX, event.clientY);
                }}
                className="min-h-20 cursor-pointer border-l border-black/8 p-2"
              >
                <button
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className={`mb-2 cursor-pointer text-xs font-semibold ${isSameDay(day, new Date()) ? "text-[#25242a]" : "text-[#7d7880]"}`}
                >
                   {getWeekdayDateFormatter().format(day)}
                </button>
                <div className="space-y-1">
                  {items.map((item) => (
                    <CalendarEvent key={getDisplayItemKey(item)} item={item} compact onOpen={onOpenItem} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className={`relative ${mode === "week" ? "" : ""}`}>
          <div className={`grid ${mode === "week" ? "grid-cols-[72px_repeat(7,minmax(96px,1fr))]" : "grid-cols-[72px_minmax(0,1fr)]"}`}>
            {slots.map((slot) => (
              <TimeSlotRow
                key={slot}
                  slot={slot}
                  days={days}
                  onOpenAdd={onOpenAdd}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0" style={{ display: "grid", gridTemplateColumns: mode === "week" ? "72px repeat(7, minmax(96px, 1fr))" : "72px minmax(0, 1fr)" }}>
            <div />
            {days.map((day) => {
              const dayItems = (itemsByDate.get(getDateKey(day)) ?? []).filter((item) => !isAllDayItem(item));
              const layouted = layoutOverlappingItems(dayItems, day);
              const showCurrentLine = mode === "day" && isToday && isSameDay(day, now);
              return (
                <div
                  key={`events-${getDateKey(day)}`}
                  className="relative"
                >
                  {showCurrentLine && (
                    <div
                      className="absolute z-10 flex items-center"
                      style={{ top: currentTop, left: 0, right: 0 }}
                    >
                      <div className="h-2 w-2 rounded-full bg-blue-500 -ml-1" />
                      <div className="h-px flex-1 bg-blue-500" />
                    </div>
                  )}
                  {layouted.map(({ item, column, totalColumns }) => {
                    const startDate = item.time.start ?? item.time.due ?? item.occurrenceDate;
                    const endDate = item.time.end;
                    const isStartDay = startDate && isSameDay(startDate, day);
                    const isEndDay = endDate && isSameDay(endDate, day);
                    let effectiveStartMinutes;
                    let effectiveEndMinutes;
                    if (!endDate) {
                      effectiveStartMinutes = isStartDay && startDate ? startDate.getHours() * 60 + startDate.getMinutes() : 0;
                      effectiveEndMinutes = effectiveStartMinutes + 15;
                    } else if (isStartDay && isEndDay) {
                      effectiveStartMinutes = startDate ? startDate.getHours() * 60 + startDate.getMinutes() : 0;
                      effectiveEndMinutes = endDate.getHours() * 60 + endDate.getMinutes();
                    } else if (isStartDay) {
                      effectiveStartMinutes = startDate ? startDate.getHours() * 60 + startDate.getMinutes() : 0;
                      effectiveEndMinutes = 1440;
                    } else if (isEndDay) {
                      effectiveStartMinutes = 0;
                      effectiveEndMinutes = endDate.getHours() * 60 + endDate.getMinutes();
                    } else {
                      effectiveStartMinutes = 0;
                      effectiveEndMinutes = 1440;
                    }
                    const durationMinutes = Math.max(effectiveEndMinutes - effectiveStartMinutes, 15);
                    const topPx = effectiveStartMinutes * PX_PER_MINUTE;
                    const heightPx = durationMinutes * PX_PER_MINUTE - 2;
                    const widthPct = 100 / totalColumns;
                    const leftPct = column * widthPct;
                    return (
                      <div
                        key={getDisplayItemKey(item)}
                        className="pointer-events-auto absolute"
                        style={{ top: topPx, height: heightPx, left: `${leftPct}%`, width: `${widthPct}%`, paddingLeft: 2, paddingRight: 2 }}
                      >
                        <CalendarEvent item={item} compact onOpen={onOpenItem} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeSlotRow({
  slot,
  days,
  onOpenAdd,
  onDragOver,
  onDrop,
}: {
  slot: number;
  days: Date[];
  onOpenAdd: (date: Date, time: string | undefined, x: number, y: number) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>, date: Date, time?: string) => void;
}) {
  return (
    <>
      <div className="min-h-24 border-b border-black/6 px-2 py-1 text-[11px] text-[#aaa3ad]">
        {getSlotLabel(slot)}
      </div>
      {days.map((day) => {
        return (
          <div
            key={`${getDateKey(day)}-${slot}`}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("button")) return;
              onOpenAdd(day, getSlotTime(slot), event.clientX, event.clientY);
            }}
            onDragOver={onDragOver}
            onDrop={(event) => onDrop(event, day, getSlotTime(slot))}
            className="min-h-24 cursor-pointer border-b border-l border-black/6 bg-white/60 text-left transition-colors hover:bg-black/2.5"
          />
        );
      })}
    </>
  );
}

function UnscheduledPanel({
  items,
  onOpenItem,
}: {
  items: DisplayItem[];
  onOpenItem: (item: DisplayItem, x: number, y: number) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-black/8 bg-white/55 p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-semibold tracking-[0.18em] text-[#8c8691] uppercase">Unscheduled</h3>
        <span className="text-xs text-[#aaa3ad]">{items.length}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <CalendarEvent key={getDisplayItemKey(item)} item={item} onOpen={onOpenItem} />
        ))}
      </div>
    </section>
  );
}

const EventPopover = ({
  ref,
  popover,
  onClose,
}: {
  ref: React.Ref<HTMLDivElement>;
  popover: EventPopoverState;
  onClose: () => void;
}) => {
  const { t } = useI18n();
  if (!popover) return null;

  const CARD_WIDTH = 420;
  const OFFSET = 12;

  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;

  const isMobileSize = viewportW < 640;
  const cardWidth = isMobileSize ? viewportW - 2 * OFFSET : CARD_WIDTH;

  const flipUp = popover.y + 300 > viewportH - OFFSET;

  let left = popover.x + OFFSET;
  let top = flipUp ? popover.y - OFFSET : popover.y + OFFSET;

  if (left + cardWidth > viewportW - OFFSET) {
    left = popover.x - cardWidth - OFFSET;
  }
  if (left < OFFSET) {
    left = OFFSET;
  }

  if (top < OFFSET) {
    top = OFFSET;
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[calc(100vw-24px)] sm:w-[420px] max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-black/8 bg-white dark:bg-[#202020] dark:border-white/10 shadow-[0_18px_55px_rgba(0,0,0,0.16)]"
      style={{ top, left, transform: flipUp ? "translateY(-100%)" : undefined }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/6 px-4 py-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#8c8691] uppercase">{t("calendar.event")}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.04] hover:text-[#25242a]"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-3">
          <div className="rounded-xl bg-white dark:bg-[#282828]">
            <ItemCard item={popover.item} disableLeadingBleed forceDateIfNotToday compactActions disableHover onAction={onClose} />
        </div>
      </div>
    </div>
  );
};

const MorePopover = ({
  ref,
  popover,
  onClose,
  onOpenEvent,
}: {
  ref: React.Ref<HTMLDivElement>;
  popover: MorePopoverState;
  onClose: () => void;
  onOpenEvent: (item: DisplayItem, x: number, y: number) => void;
}) => {
  if (!popover) return null;

  const CARD_WIDTH = 360;
  const OFFSET = 12;

  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;

  const isMobileSize = viewportW < 640;
  const cardWidth = isMobileSize ? viewportW - 2 * OFFSET : CARD_WIDTH;

  const flipUp = popover.y + 300 > viewportH - OFFSET;

  let left = popover.x + OFFSET;
  let top = flipUp ? popover.y - OFFSET : popover.y + OFFSET;

  if (left + cardWidth > viewportW - OFFSET) {
    left = popover.x - cardWidth - OFFSET;
  }
  if (left < OFFSET) {
    left = OFFSET;
  }

  if (top < OFFSET) {
    top = OFFSET;
  }

  return (
    <div
      ref={ref}
      className="fixed z-40 w-[calc(100vw-24px)] sm:w-[360px] max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.16)]"
      style={{ top, left, transform: flipUp ? "translateY(-100%)" : undefined }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/6 px-4 py-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#8c8691] uppercase">
           {getWeekdayDateFormatter().format(popover.date)}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.04] hover:text-[#25242a]"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-3">
        <div className="space-y-1.5">
          {popover.items.map((item) => (
            <CalendarEvent
              key={getDisplayItemKey(item)}
              item={item}
              compact
              onOpen={(it, x, y) => {
                onOpenEvent(it, x, y);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const AddPopover = ({
  ref,
  popover,
  onClose,
  onConfirm,
}: {
  ref: React.Ref<HTMLDivElement>;
  popover: AddPopoverState;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  const { t } = useI18n();
  if (!popover) return null;

  const OFFSET = 12;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;

  let left = popover.x + OFFSET;
  let top = popover.y + OFFSET;

  if (left + 200 > viewportW - OFFSET) {
    left = popover.x - 200 - OFFSET;
  }
  if (left < OFFSET) left = OFFSET;
  if (top + 60 > viewportH - OFFSET) {
    top = popover.y - 60 - OFFSET;
  }
  if (top < OFFSET) top = OFFSET;

  const timeLabel = popover.time
    ? new Date(`2000-01-01T${popover.time}`).toLocaleTimeString(getDateLocale(), { hour: "numeric", minute: "2-digit", hour12: useSettingsStore.getState().timeFormat === "12h" })
    : null;

  return (
    <div
      ref={ref}
      className="fixed z-50 overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.16)]"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          onConfirm();
          onClose();
        }}
        className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#25242a]">
          <Plus className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#25242a]">{t("calendar.addEvent")}</p>
          {timeLabel && (
            <p className="text-[11px] text-[#8c8691]">{timeLabel}</p>
          )}
        </div>
      </button>
    </div>
  );
};
