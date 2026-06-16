"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { formatDateInput, isRecurringItem } from "@/lib/all-page-utils";
import { ItemCard } from "@/components/all-page/item-card";
import type { DisplayItem } from "@/lib/types/all-page";
import { useI18n } from "@/lib/i18n";

interface EventPopoverState {
  item: DisplayItem;
  x: number;
  y: number;
}

interface DragState {
  item: DisplayItem;
  startY: number;
  currentPageY: number;
  originalStartMinutes: number;
  originalEndMinutes: number | null;
  hasMoved: boolean;
  undoStartMinutes: number;
  originalTimezone: string;
}

interface ToastMessage {
  id: number;
  itemTitle: string;
  newTime: string;
  undoAction?: () => void;
}

const HOUR_HEIGHT = 96;
const LABEL_WIDTH = 56;
const MIN_TASK_HEIGHT = 32;
const TIMELINE_PADDING_HOURS = 1;
const MIN_RANGE_HOURS = 8;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;

type LayoutedItem = { item: DisplayItem; column: number; totalColumns: number };

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

type CrossDayType = "single" | "start" | "end" | "middle";

function getCrossDayType(item: DisplayItem): CrossDayType {
  if (!item.time.start || !item.time.end) return "single";
  const today = new Date();
  const startDate = new Date(item.time.start);
  const endDate = new Date(item.time.end);
  const isCross = startDate.getFullYear() !== endDate.getFullYear() ||
    startDate.getMonth() !== endDate.getMonth() ||
    startDate.getDate() !== endDate.getDate();
  if (!isCross) return "single";
  const isStartDay = sameDay(today, startDate);
  const isEndDay = sameDay(today, endDate);
  if (isStartDay) return "start";
  if (isEndDay) return "end";
  return "middle";
}

function layoutOverlappingItems(items: DisplayItem[]): LayoutedItem[] {
  if (items.length === 0) return [];

  function getStartMinutes(item: DisplayItem) {
    if (!item.time.start) return 0;
    const type = getCrossDayType(item);
    if (type === "end" || type === "middle") return 0;
    return item.time.start.getHours() * 60 + item.time.start.getMinutes();
  }

  function getEndMinutes(item: DisplayItem) {
    if (!item.time.end) {
      return getStartMinutes(item) + 20;
    }
    const type = getCrossDayType(item);
    if (type === "start" || type === "middle") return 1440;
    return item.time.end.getHours() * 60 + item.time.end.getMinutes();
  }

  const sorted = [...items].sort((a, b) => {
    const aStart = getStartMinutes(a);
    const bStart = getStartMinutes(b);
    if (aStart !== bStart) return aStart - bStart;
    return getEndMinutes(a) - getEndMinutes(b);
  });

  const groups: DisplayItem[][] = [];
  let currentGroup: DisplayItem[] = [sorted[0]];
  let groupEnd = getEndMinutes(sorted[0]);

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const itemStart = getStartMinutes(item);
    if (itemStart < groupEnd) {
      currentGroup.push(item);
      groupEnd = Math.max(groupEnd, getEndMinutes(item));
    } else {
      groups.push(currentGroup);
      currentGroup = [item];
      groupEnd = getEndMinutes(item);
    }
  }
  groups.push(currentGroup);

  const result: LayoutedItem[] = [];
  for (const group of groups) {
    const columns: number[] = [];
    for (const item of group) {
      const itemStart = getStartMinutes(item);
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (columns[col] <= itemStart) {
          columns[col] = getEndMinutes(item);
          result.push({ item, column: col, totalColumns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push(getEndMinutes(item));
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

function calculateTimelineRange(timedItems: DisplayItem[]): { startHour: number; endHour: number } {
  if (timedItems.length === 0) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }

  let minStartHour = 24;
  let maxEndHour = 0;

  for (const item of timedItems) {
    const type = getCrossDayType(item);
    if (item.time.start && type !== "end" && type !== "middle") {
      const startHourValue = item.time.start.getHours() + item.time.start.getMinutes() / 60;
      minStartHour = Math.min(minStartHour, startHourValue);
    }
    if (type === "end" || type === "middle") {
      minStartHour = Math.min(minStartHour, 0);
    }
    if (item.time.end && type !== "start" && type !== "middle") {
      const endHourValue = item.time.end.getHours() + item.time.end.getMinutes() / 60;
      maxEndHour = Math.max(maxEndHour, endHourValue);
    } else if (item.time.start && type !== "start" && type !== "middle") {
      const startHourValue = item.time.start.getHours() + item.time.start.getMinutes() / 60;
      maxEndHour = Math.max(maxEndHour, startHourValue + 1);
    }
    if (type === "start" || type === "middle") {
      maxEndHour = Math.max(maxEndHour, 24);
    }
  }

  let startHour = Math.floor(minStartHour) - TIMELINE_PADDING_HOURS;
  let endHour = Math.ceil(maxEndHour) + TIMELINE_PADDING_HOURS + 1;

  startHour = Math.max(0, startHour);
  endHour = Math.min(24, endHour);

  if (endHour - startHour < MIN_RANGE_HOURS) {
    const mid = (startHour + endHour) / 2;
    startHour = Math.floor(mid - MIN_RANGE_HOURS / 2);
    endHour = Math.ceil(mid + MIN_RANGE_HOURS / 2);
  }

  startHour = Math.max(0, startHour);
  endHour = Math.min(24, endHour);

  if (endHour <= startHour) {
    endHour = Math.min(24, startHour + MIN_RANGE_HOURS);
  }

  return { startHour, endHour };
}

function formatHourLabel(hour: number): string {
  const is12h = useSettingsStore.getState().timeFormat === "12h";
  if (is12h) {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  }
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatTimeShort(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const is12h = useSettingsStore.getState().timeFormat === "12h";
  if (is12h) {
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    const minStr = m === 0 ? "" : `:${m.toString().padStart(2, "0")}`;
    return `${hour12}${minStr} ${ampm}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTimeRange(item: DisplayItem): string {
  if (!item.time.start) return "";
  const type = getCrossDayType(item);
  if (type === "middle") return "12 AM - 12 AM";
  if (type === "start") {
    const start = formatTimeShort(item.time.start);
    return `${start} - 12 AM`;
  }
  if (type === "end") {
    const end = formatTimeShort(item.time.end!);
    return `12 AM - ${end}`;
  }
  if (!item.time.end || item.time.allDay) return formatTimeShort(item.time.start);
  return `${formatTimeShort(item.time.start)} - ${formatTimeShort(item.time.end)}`;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return formatTimeShort(new Date(2000, 0, 1, h, m));
}

function snapTo5Minutes(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

function getDragPreviewTime(startMinutes: number, endMinutes: number | null): string {
  const startTime = minutesToTime(startMinutes);
  if (endMinutes === null) return startTime;
  const endTime = minutesToTime(endMinutes);
  return `${startTime} - ${endTime}`;
}

function getTaskTop(item: DisplayItem, startHour: number): number {
  if (!item.time.start) return 0;
  const type = getCrossDayType(item);
  const startMinutes = type === "end" || type === "middle"
    ? 0
    : item.time.start.getHours() * 60 + item.time.start.getMinutes();
  const timelineStartMinutes = startHour * 60;
  return ((startMinutes - timelineStartMinutes) / 60) * HOUR_HEIGHT;
}

function getTaskHeight(item: DisplayItem): number {
  if (!item.time.start || !item.time.end || item.time.allDay) return MIN_TASK_HEIGHT;
  const type = getCrossDayType(item);
  const startMinutes = type === "end" || type === "middle"
    ? 0
    : item.time.start.getHours() * 60 + item.time.start.getMinutes();
  const endMinutes = type === "start" || type === "middle"
    ? 1440
    : item.time.end.getHours() * 60 + item.time.end.getMinutes();
  const durationMinutes = endMinutes - startMinutes;
  const height = (durationMinutes / 60) * HOUR_HEIGHT;
  return Math.max(height, MIN_TASK_HEIGHT);
}

function getCurrentTimeTop(now: Date, startHour: number): number {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const timelineStartMinutes = startHour * 60;
  return ((currentMinutes - timelineStartMinutes) / 60) * HOUR_HEIGHT;
}

function getPriorityBorderColor(priority?: string): string {
  switch (priority) {
    case "urgent": return "bg-red-500";
    case "high": return "bg-orange-500";
    case "medium": return "bg-blue-500";
    case "low": return "bg-gray-300";
    default: return "bg-gray-300";
  }
}

function getPriorityBackgroundColor(priority?: string): string {
  switch (priority) {
    case "urgent": return "bg-red-50";
    case "high": return "bg-orange-50";
    case "medium": return "bg-blue-50";
    case "low": return "bg-gray-50";
    default: return "bg-gray-50";
  }
}

function TimelineTaskCard({
  item,
  top,
  height,
  column,
  totalColumns,
  dragState,
  wasDraggingRef,
  onOpen,
  onDragStart,
}: {
  item: DisplayItem;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  dragState: DragState | null;
  wasDraggingRef: React.RefObject<boolean>;
  onOpen: (item: DisplayItem, x: number, y: number) => void;
  onDragStart: (item: DisplayItem, startY: number) => void;
}) {
  const isCompleted = item.status === "completed";
  const isDragging = dragState?.item.id === item.id;
  const hasMoved = isDragging && dragState.hasMoved;

  const rawDeltaY = isDragging ? dragState.currentPageY - dragState.startY : 0;
  const maxDeltaUp = isDragging ? -(dragState.originalStartMinutes / 60) * HOUR_HEIGHT : 0;
  const duration = isDragging && dragState.originalEndMinutes !== null
    ? dragState.originalEndMinutes - dragState.originalStartMinutes
    : 0;
  const maxDownStartMinutes = duration > 0 ? 1435 - duration : 1435;
  const maxDeltaDown = isDragging
    ? ((maxDownStartMinutes - dragState.originalStartMinutes) / 60) * HOUR_HEIGHT
    : 0;
  const deltaY = isDragging ? Math.max(maxDeltaUp, Math.min(maxDeltaDown, rawDeltaY)) : 0;
  const displayTop = top + deltaY;

  const previewTime = hasMoved
    ? getDragPreviewTime(
        snapTo5Minutes(dragState.originalStartMinutes + deltaY / HOUR_HEIGHT * 60),
        dragState.originalEndMinutes !== null
          ? snapTo5Minutes(dragState.originalStartMinutes + deltaY / HOUR_HEIGHT * 60) + (dragState.originalEndMinutes - dragState.originalStartMinutes)
          : null
      )
    : null;

  return (
    <button
      type="button"
      className={`group absolute rounded-xl shadow-sm border border-black/8 hover:shadow-md hover:border-black/12 transition-colors overflow-hidden text-left ${getPriorityBackgroundColor(item.priority)} ${isDragging ? "z-30 shadow-lg opacity-90 cursor-grabbing" : "cursor-pointer"} ${isCompleted ? "opacity-55" : ""}`}
      style={{
        top: `${displayTop}px`,
        height: `${height}px`,
        left: `calc(${LABEL_WIDTH}px + ${column} * (100% - ${LABEL_WIDTH}px) / ${totalColumns} + 2px)`,
        width: `calc((100% - ${LABEL_WIDTH}px) / ${totalColumns} - 4px)`,
        willChange: isDragging ? "top" : "auto",
      }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          onDragStart(item, e.clientY);
        }}
        onClick={(e) => {
          if (hasMoved || wasDraggingRef.current) return;
          e.stopPropagation();
          onOpen(item, e.clientX, e.clientY);
        }}
    >
      <div className="h-full flex items-center justify-between gap-2 px-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-1 h-5 rounded-full shrink-0 ${getPriorityBorderColor(item.priority)}`} />
          <h3 className={`text-sm font-medium truncate ${isCompleted ? "line-through text-[#b0a9b2]" : "text-[#25242a]"}`}>
            {item.title}
          </h3>
        </div>
        {hasMoved && previewTime ? (
          <span className="text-xs text-white font-medium whitespace-nowrap shrink-0 tabular-nums bg-[#25242a] px-1.5 py-0.5 rounded">
            {previewTime}
          </span>
        ) : (
          <span className="text-xs text-[#6f6a72] whitespace-nowrap shrink-0 tabular-nums">
            {formatTimeRange(item)}
          </span>
        )}
      </div>
    </button>
  );
}

function CurrentTimeIndicator({ now, startHour, totalHeight }: { now: Date; startHour: number; totalHeight: number }) {
  const top = getCurrentTimeTop(now, startHour);
  const isInView = top >= 0 && top <= totalHeight;

  if (!isInView) return null;

  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{ top: `${top}px`, left: `${LABEL_WIDTH}px`, right: 0 }}
    >
      <div className="h-px bg-green-500" />
    </div>
  );
}

function AllDayTaskCard({ item, onOpen }: { item: DisplayItem; onOpen: (item: DisplayItem, x: number, y: number) => void }) {
  const todayKey = formatDateInput(new Date());
  const removeItemFromTodayPlan = useAllPageStore((s) => s.removeItemFromTodayPlan);
  const handleToggleComplete = useAllPageStore((s) => s.handleToggleComplete);

  const isCompleted = item.status === "completed";

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border border-black/6 bg-white/40 px-4 py-2.5 transition-colors hover:bg-white/70 w-full text-left cursor-pointer ${isCompleted ? "opacity-55" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item, e.clientX, e.clientY);
      }}
    >
      <div className={`w-1.5 h-8 rounded-full shrink-0 ${getPriorityBorderColor(item.priority)}`} />
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-medium truncate ${isCompleted ? "line-through text-[#b0a9b2]" : "text-[#25242a]"}`}>
          {item.title}
        </h4>
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleComplete(item);
          }}
          className={`flex items-center justify-center rounded-full p-1 transition-colors ${
            isCompleted
              ? "text-gray-400 hover:bg-gray-100"
              : "text-green-500 hover:bg-green-50"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        {(item.plannedTodayDates ?? []).includes(todayKey) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeItemFromTodayPlan(item);
            }}
            className="flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function EventPopover({
  ref,
  popover,
  onClose,
}: {
  ref: React.Ref<HTMLDivElement>;
  popover: EventPopoverState;
  onClose: () => void;
}) {
  const { t } = useI18n();
  if (!popover) return null;

  const CARD_WIDTH = 420;
  const OFFSET = 12;

  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 768;

  const flipUp = popover.y + 300 > viewportH - OFFSET;

  let left = popover.x + OFFSET;
  let top = flipUp ? popover.y - OFFSET : popover.y + OFFSET;

  if (left + CARD_WIDTH > viewportW - OFFSET) {
    left = popover.x - CARD_WIDTH - OFFSET;
  }
  if (left < OFFSET) {
    left = OFFSET;
  }
  if (top < OFFSET) {
    top = OFFSET;
  }

  const crossDayType = getCrossDayType(popover.item);
  const isCrossDay = crossDayType !== "single";

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[420px] max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-black/8 bg-white dark:bg-[#202020] dark:border-white/10 shadow-[0_18px_55px_rgba(0,0,0,0.16)]"
      style={{ top, left, transform: flipUp ? "translateY(-100%)" : undefined }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/6 px-4 py-3">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#8c8691] uppercase">{t("today.event")}</p>
        <button type="button" onClick={onClose} className="flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 cursor-pointer">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-3">
        <div className="rounded-xl bg-white dark:bg-[#282828]">
          <ItemCard item={popover.item} disableLeadingBleed compactActions disableHover forceDateIfNotToday={isCrossDay} onAction={onClose} />
        </div>
      </div>
    </div>
  );
}

export function TimelineSection({
  items,
  now,
}: {
  items: DisplayItem[];
  now: Date;
}) {
  const { t } = useI18n();
  const [eventPopover, setEventPopover] = useState<EventPopoverState | null>(null);
  const eventPopoverRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const wasDraggingRef = useRef(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rescheduleItemFromCalendar = useAllPageStore((s) => s.rescheduleItemFromCalendar);

  useEffect(() => {
    if (!eventPopover) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEventPopover(null);
      }
    }

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      
      // Check if click is inside the event popover
      if (eventPopoverRef.current && eventPopoverRef.current.contains(target)) {
        return;
      }
      
      // Check if click is inside a flyout menu (the "more" menu)
      let current = target as HTMLElement | null;
      while (current) {
        if (typeof current.hasAttribute === "function" && current.hasAttribute("data-flyout-panel")) {
          return; // Click is inside a flyout menu, don't close
        }
        current = current.parentElement;
      }
      
      // Click is outside both the popover and any flyout menus
      setEventPopover(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [eventPopover]);

  useEffect(() => {
    if (!dragState) return;

    let rafId: number | null = null;
    let scrollRafId: number | null = null;
    let lastPageY = dragState.currentPageY;

    function handleMouseMove(e: MouseEvent) {
      lastPageY = e.pageY;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          setDragState((prev) => prev ? { ...prev, currentPageY: lastPageY, hasMoved: true } : null);
          rafId = null;
        });
      }

      const SCROLL_THRESHOLD = 60;
      const MAX_SCROLL_SPEED = 16;
      const viewportH = window.innerHeight;
      const edgeDist = Math.min(e.clientY, viewportH - e.clientY);

      if (edgeDist < SCROLL_THRESHOLD && scrollRafId === null) {
        const scrollSpeed = Math.round((1 - edgeDist / SCROLL_THRESHOLD) * MAX_SCROLL_SPEED);
        const scrollDir = e.clientY < SCROLL_THRESHOLD ? -1 : 1;

        function autoScroll() {
          window.scrollBy(0, scrollDir * scrollSpeed);
          scrollRafId = requestAnimationFrame(autoScroll);
        }
        scrollRafId = requestAnimationFrame(autoScroll);
      } else if (edgeDist >= SCROLL_THRESHOLD && scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
        scrollRafId = null;
      }
    }

    function handleMouseUp(e: MouseEvent) {
      if (!dragState) return;

      if (dragState.hasMoved) {
        const type = getCrossDayType(dragState.item);

        if (type !== "single") {
          if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
          }
          setToast({
            id: Date.now(),
            itemTitle: dragState.item.title,
            newTime: t("today.multiDayDragBlocked"),
          });
          toastTimerRef.current = setTimeout(() => {
            setToast(null);
            toastTimerRef.current = null;
          }, 5000);
        } else if (dragState.item.isRecurringInstance || isRecurringItem(dragState.item)) {
          if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
          }
          setToast({
            id: Date.now(),
            itemTitle: dragState.item.title,
            newTime: t("today.recurringDragBlocked"),
          });
          toastTimerRef.current = setTimeout(() => {
            setToast(null);
            toastTimerRef.current = null;
          }, 5000);
        } else {
          const rawDeltaY = e.pageY - dragState.startY;
          const maxDeltaUp = -(dragState.originalStartMinutes / 60) * HOUR_HEIGHT;
          const duration = dragState.originalEndMinutes ? dragState.originalEndMinutes - dragState.originalStartMinutes : 0;
          const maxDownStartMinutes = duration > 0 ? 1435 - duration : 1435;
          const maxDeltaDown = ((maxDownStartMinutes - dragState.originalStartMinutes) / 60) * HOUR_HEIGHT;
          const deltaY = Math.max(maxDeltaUp, Math.min(maxDeltaDown, rawDeltaY));
          const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60;
          const newStartMinutes = snapTo5Minutes(dragState.originalStartMinutes + deltaMinutes);
          const newEndMinutes = newStartMinutes + duration;

          const startHour = Math.floor(newStartMinutes / 60);
          const startMinute = newStartMinutes % 60;
          const dateStr = formatDateInput(dragState.item.time.start);

          const target: { date: string; time?: string } = {
            date: dateStr,
            time: `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`,
          };

          const originalItem = dragState.item;
          rescheduleItemFromCalendar(dragState.item, target);
          wasDraggingRef.current = true;
          setTimeout(() => { wasDraggingRef.current = false; }, 100);

          if (newStartMinutes !== dragState.originalStartMinutes) {
            const newTimeStr = duration > 0
              ? `${minutesToTime(newStartMinutes)} - ${minutesToTime(newEndMinutes)}`
              : minutesToTime(newStartMinutes);

            if (toastTimerRef.current) {
              clearTimeout(toastTimerRef.current);
            }

            setToast({
              id: Date.now(),
              itemTitle: originalItem.title,
              newTime: newTimeStr,
              undoAction: () => {
                const undoTarget: { date: string; time?: string } = {
                  date: dateStr,
                  time: `${String(Math.floor(dragState.undoStartMinutes / 60)).padStart(2, "0")}:${String(dragState.undoStartMinutes % 60).padStart(2, "0")}`,
                };
                rescheduleItemFromCalendar(originalItem, undoTarget, dragState.originalTimezone);
                setToast(null);
              },
            });

            toastTimerRef.current = setTimeout(() => {
              setToast(null);
              toastTimerRef.current = null;
            }, 5000);
          }
        }
      }
      setDragState(null);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDragState(null);
      }
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
      }
    };
  }, [dragState, rescheduleItemFromCalendar, t]);

  function handleOpenEvent(item: DisplayItem, x: number, y: number) {
    setEventPopover({ item, x, y });
  }

  function handleDragStart(item: DisplayItem, startY: number) {
    if (!item.time.start) return;

    const type = getCrossDayType(item);
    const startMinutes = type === "end" || type === "middle"
      ? 0
      : item.time.start.getHours() * 60 + item.time.start.getMinutes();
    const endMinutes = item.time.end
      ? type === "start" || type === "middle"
        ? 1440
        : item.time.end.getHours() * 60 + item.time.end.getMinutes()
      : null;

    const undoStartMinutes = item.time.start
      ? item.time.start.getHours() * 60 + item.time.start.getMinutes()
      : 0;

    setDragState({
      item,
      startY: startY + window.scrollY,
      currentPageY: startY + window.scrollY,
      originalStartMinutes: startMinutes,
      originalEndMinutes: endMinutes,
      hasMoved: false,
      undoStartMinutes,
      originalTimezone: item.time.timezone || (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Shanghai"),
    });
  }

  const timedItems = items.filter((item) => item.time.start && !item.time.allDay);
  const allDayItems = items.filter((item) => item.time.allDay);

  if (timedItems.length === 0 && allDayItems.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-black/10 bg-white/60 px-6 py-10 text-center">
        <p className="text-[11px] font-semibold tracking-[0.24em] text-[#8c8691] uppercase">
          {t("today.noSchedule")}
        </p>
        <h2 className="mt-4 font-display text-2xl font-semibold text-[#25242a]">
          {t("today.noTimeTasks")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6a6570]">
          {t("today.timelineHint")}
        </p>
      </div>
    );
  }

  const { startHour, endHour } = calculateTimelineRange(timedItems);
  const totalHeight = (endHour - startHour) * HOUR_HEIGHT;

  return (
    <div>
      {allDayItems.length > 0 && (
        <div className="mb-6 pb-6 border-b border-black/6">
          <p className="text-xs font-semibold text-[#8c8691] uppercase mb-3 tracking-wider">{t("today.allDay")}</p>
          <div className="space-y-1.5">
            {allDayItems.map((item) => (
              <AllDayTaskCard key={`${item.id}:${item.occurrenceKey ?? "base"}`} item={item} onOpen={handleOpenEvent} />
            ))}
          </div>
        </div>
      )}

      <div className="relative pl-2 pr-1">
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {Array.from({ length: (endHour - startHour) * 2 + 1 }, (_, i) => {
            const hour = startHour + Math.floor(i / 2);
            const minute = (i % 2) * 30;
            const isHour = minute === 0;
            return (
              <div
                key={`${hour}-${minute}`}
                className="absolute left-0 right-0 flex items-start"
                style={{ top: `${i * HOUR_HEIGHT / 2}px`, height: `${HOUR_HEIGHT / 2}px` }}
              >
                <span
                  className="shrink-0 text-right pr-4 text-xs font-medium tabular-nums whitespace-nowrap"
                  style={{ width: `${LABEL_WIDTH}px`, visibility: isHour ? "visible" : "hidden" }}
                >
                  {formatHourLabel(hour)}
                </span>
                <div className={`flex-1 ${isHour ? "border-t border-black/6" : "border-t border-black/3"}`} />
              </div>
            );
          })}

          <CurrentTimeIndicator now={now} startHour={startHour} totalHeight={totalHeight} />

          {layoutOverlappingItems(timedItems).map(({ item, column, totalColumns }) => (
            <TimelineTaskCard
              key={`${item.id}:${item.occurrenceKey ?? "base"}`}
              item={item}
              top={getTaskTop(item, startHour)}
              height={getTaskHeight(item)}
              column={column}
              totalColumns={totalColumns}
              dragState={dragState}
              wasDraggingRef={wasDraggingRef}
              onOpen={handleOpenEvent}
              onDragStart={handleDragStart}
            />
          ))}
        </div>
      </div>

      {eventPopover && (
        <EventPopover ref={eventPopoverRef} popover={eventPopover} onClose={() => setEventPopover(null)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#25242a] text-white px-4 py-2.5 rounded-xl shadow-lg">
          <span className="text-sm">
            <span className="font-medium">{toast.itemTitle}</span> {toast.newTime}
          </span>
          {toast.undoAction && (
            <button
              type="button"
              onClick={toast.undoAction}
              className="text-sm font-medium text-white/70 hover:text-white underline underline-offset-2 cursor-pointer"
            >
              {t("today.undo")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
