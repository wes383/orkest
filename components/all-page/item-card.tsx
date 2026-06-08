"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle, Circle, Pencil, Trash2 } from "lucide-react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useSettingsStore, getDateLocale } from "@/lib/stores/use-settings-store";
import { useI18n } from "@/lib/i18n";
import {
  PRIORITY_CONFIG,
  formatDateInput,
  formatDueDate,
  formatItemTime,
  getDisplayItemKey,
  getTimelinePointColorForItem,
  canDeleteRecurringSeriesFromDisplayItem,
} from "@/lib/all-page-utils";
import type { DisplayItem, ManualItemRecord, Reminder } from "@/lib/types/all-page";
import type { CandidateItem } from "@/lib/ai/candidate-search";


const DRAG_CURSOR_CLASS = "is-item-dragging";
const DRAG_VISUAL_EVENT = "orkest:item-drag-visual";

type DragPreviewSubtaskData = {
  items: ManualItemRecord[];
  isCompleted: (subtask: ManualItemRecord) => boolean;
  progressLabel: string | null;
  completedCount: number;
};

export function createDragPreviewElement(
  item: DisplayItem,
  width: number,
  subtaskData?: DragPreviewSubtaskData,
  forceDateIfNotToday = false,
) {
  const preview = document.createElement("div");
  const previewTime = formatItemTime(item, forceDateIfNotToday);
  const isDark = document.documentElement.classList.contains("dark");

  preview.style.position = "fixed";
  preview.style.top = "0";
  preview.style.left = "0";
  preview.style.width = `${width}px`;
  preview.style.pointerEvents = "none";
  preview.style.zIndex = "9999";
  preview.style.padding = "24px";
  preview.style.marginLeft = "-16px";
  preview.style.borderRadius = "12px";
  preview.style.backgroundColor = isDark ? "rgba(32, 32, 32, 0.82)" : "rgba(244, 240, 236, 0.32)";
  preview.style.backdropFilter = "blur(18px) saturate(140%)";
  preview.style.setProperty("-webkit-backdrop-filter", "blur(18px) saturate(140%)");
  preview.style.border = isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(255, 255, 255, 0.3)";
  preview.style.color = isDark ? "#f5f5f5" : "#333139";
  preview.style.boxSizing = "border-box";
  preview.style.fontFamily = "\"Inter\", sans-serif";
  preview.style.boxShadow = isDark
    ? "0 16px 42px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
    : "0 10px 30px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.35)";
  preview.style.transform = "translate(-200vw, -200vh)";

  if (previewTime) {
    const time = document.createElement("p");
    time.textContent = previewTime;
    time.style.margin = "0 0 8px";
    time.style.fontSize = "14px";
    time.style.fontWeight = "500";
    time.style.letterSpacing = "0.05em";
    time.style.textTransform = "uppercase";
    time.style.color = isDark ? "#a3a3a3" : "#7e7982";
    preview.appendChild(time);
  }

  if (item.tags && item.tags.length > 0) {
    const tagsContainer = document.createElement("div");
    tagsContainer.style.display = "flex";
    tagsContainer.style.flexWrap = "wrap";
    tagsContainer.style.gap = "6px";
    tagsContainer.style.marginBottom = "8px";
    tagsContainer.style.marginLeft = "-2px";

    item.tags.forEach((tag) => {
      const tagEl = document.createElement("span");
      tagEl.textContent = tag;
      tagEl.style.backgroundColor = isDark ? "rgba(255, 255, 255, 0.09)" : "#e5e7eb";
      tagEl.style.color = isDark ? "#d4d4d4" : "#4b5563";
      tagEl.style.padding = "4px 12px";
      tagEl.style.borderRadius = "9999px";
      tagEl.style.fontSize = "14px";
      tagEl.style.fontWeight = "500";
      tagsContainer.appendChild(tagEl);
    });
    preview.appendChild(tagsContainer);
  }

  const title = document.createElement("div");
  title.textContent = item.title;
  title.style.fontFamily = "var(--font-display), sans-serif";
  title.style.fontSize = "32px";
  title.style.lineHeight = "1.08";
  title.style.fontWeight = "500";
  title.style.letterSpacing = "-0.01em";
  preview.appendChild(title);

  if (item.description) {
    const description = document.createElement("p");
    description.textContent = item.description;
    description.style.margin = "12px 0 0";
    description.style.fontSize = "16px";
    description.style.lineHeight = "1.75";
    description.style.color = isDark ? "#a3a3a3" : "#706b74";
    preview.appendChild(description);
  }

  if (subtaskData && subtaskData.items.length > 0) {
    const subtaskSection = document.createElement("div");
    subtaskSection.style.marginTop = "12px";

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "6px";

    subtaskData.items.forEach((subtask) => {
      const completed = subtaskData.isCompleted(subtask);
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.padding = "2px 4px";

      // Icon
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("width", "16");
      icon.setAttribute("height", "16");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("fill", "none");
      icon.setAttribute("stroke", "currentColor");
      icon.setAttribute("stroke-width", "2");
      icon.setAttribute("stroke-linecap", "round");
      icon.setAttribute("stroke-linejoin", "round");

      if (completed) {
        icon.style.color = "#22c55e"; // text-green-500
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M22 11.08V12a10 10 0 1 1-5.93-9.14");
        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("points", "22 4 12 14.01 9 11.01");
        icon.appendChild(path);
        icon.appendChild(polyline);
      } else {
        icon.style.color = isDark ? "#6f675f" : "#d1d5db"; // text-gray-300
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "10");
        icon.appendChild(circle);
      }

      const text = document.createElement("span");
      text.textContent = subtask.title;
      text.style.fontSize = "14px";
      if (completed) {
        text.style.color = isDark ? "#737373" : "#b0a9b2";
        text.style.textDecoration = "line-through";
      } else {
        text.style.color = isDark ? "#a3a3a3" : "#706b74";
      }

      row.appendChild(icon);
      row.appendChild(text);
      list.appendChild(row);
    });

    subtaskSection.appendChild(list);

    // Progress
    const progressRow = document.createElement("div");
    progressRow.style.marginTop = "8px";
    progressRow.style.display = "flex";
    progressRow.style.alignItems = "center";
    progressRow.style.gap = "8px";
    progressRow.style.paddingLeft = "4px";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.style.transform = "rotate(-90deg)";

    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("cx", "8");
    bgCircle.setAttribute("cy", "8");
    bgCircle.setAttribute("r", "5.5");
    bgCircle.setAttribute("fill", "none");
    bgCircle.setAttribute("stroke", isDark ? "rgba(255, 255, 255, 0.14)" : "#e5e7eb");
    bgCircle.setAttribute("stroke-width", "3");

    const fgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    fgCircle.setAttribute("cx", "8");
    fgCircle.setAttribute("cy", "8");
    fgCircle.setAttribute("r", "5.5");
    fgCircle.setAttribute("fill", "none");
    fgCircle.setAttribute("stroke", "#4ade80");
    fgCircle.setAttribute("stroke-width", "3");
    fgCircle.setAttribute("stroke-linecap", "round");

    const circumference = 2 * Math.PI * 5.5;
    const offset = circumference * (1 - subtaskData.completedCount / subtaskData.items.length);
    fgCircle.setAttribute("stroke-dasharray", `${circumference}`);
    fgCircle.setAttribute("stroke-dashoffset", `${offset}`);

    svg.appendChild(bgCircle);
    svg.appendChild(fgCircle);

    const progressText = document.createElement("span");
    progressText.textContent = `${subtaskData.progressLabel} completed`;
    progressText.style.fontSize = "12px";
    progressText.style.fontWeight = "500";
    progressText.style.color = isDark ? "#737373" : "#9f99a3";

    progressRow.appendChild(svg);
    progressRow.appendChild(progressText);
    subtaskSection.appendChild(progressRow);

    preview.appendChild(subtaskSection);
  }

  if (item.priority || item.time.due || item.recurrence) {
    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.alignItems = "center";
    footer.style.gap = "8px";
    footer.style.marginTop = "12px";

    if (item.priority) {
      const priority = document.createElement("p");
      priority.textContent = PRIORITY_CONFIG[item.priority].label;
      priority.style.fontSize = "12px";
      priority.style.fontWeight = "600";
      priority.style.letterSpacing = "0.05em";
      priority.style.textTransform = "uppercase";

      let color = isDark ? "#a3a3a3" : "#7e7982";
      if (item.priority === "urgent") color = isDark ? "#fca5a5" : "#dc2626";
      else if (item.priority === "high") color = isDark ? "#fdba74" : "#ea580c";
      else if (item.priority === "medium") color = isDark ? "#d4d4d4" : "#2563eb";
      else if (item.priority === "low") color = isDark ? "#d4d4d4" : "#4b5563";

      priority.style.color = color;
      footer.appendChild(priority);
    }

    if (item.time.due) {
      const due = document.createElement("p");
      due.textContent = `Due: ${formatDueDate(item.time.due)}`;
      due.style.fontSize = "12px";
      due.style.fontWeight = "500";
      due.style.color = isDark ? "#737373" : "#9ca3af";
      footer.appendChild(due);
    }

    preview.appendChild(footer);
  }

  return preview;
}

export function ItemCard({
  item,
  disableDrag = false,
  extraActions,
  disableLeadingBleed = false,
  forceDateIfNotToday = false,
  compactActions = false,
  hidePriority = false,
  disableHover = false,
  inlineMetadata = false,
  ignoreDensity = false,
  onAction,
}: {
  item: DisplayItem;
  disableDrag?: boolean;
  extraActions?: ReactNode;
  disableLeadingBleed?: boolean;
  forceDateIfNotToday?: boolean;
  compactActions?: boolean;
  hidePriority?: boolean;
  disableHover?: boolean;
  inlineMetadata?: boolean;
  ignoreDensity?: boolean;
  onAction?: () => void;
}) {
  const selectedItem = useAllPageStore((s) => s.selectedItem);
  const setSelectedItem = useAllPageStore((s) => s.setSelectedItem);
  const handleToggleComplete = useAllPageStore((s) => s.handleToggleComplete);
  const handleEditItem = useAllPageStore((s) => s.handleEditItem);
  const handleDeleteItem = useAllPageStore((s) => s.handleDeleteItem);
  const handleToggleSubtaskComplete = useAllPageStore((s) => s.handleToggleSubtaskComplete);
  const manualItems = useAllPageStore((s) => s.manualItems);
  useSettingsStore((s) => s.locale);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const density = useSettingsStore((s) => s.density);
  const isCompact = !ignoreDensity && density === "compact";
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragPreviewCleanupRef = useRef<(() => void) | null>(null);

  const itemKey = getDisplayItemKey(item);
  const isSelected = selectedItem === itemKey;

  const DAY_NAME_KEYS = ["calendar.daySun", "calendar.dayMon", "calendar.dayTue", "calendar.dayWed", "calendar.dayThu", "calendar.dayFri", "calendar.daySat"];

  function formatRecurrenceTranslated(): string {
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

  const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Shanghai";
  const itemTz = item.time.timezone;
  const showTzBadge = itemTz && itemTz !== browserTz;

  function getTzBadgeLabel(tz: string): string {
    const shortName = tz.split("/").pop()!.replace(/_/g, " ");
    let offset = "";
    try {
      const parts = new Intl.DateTimeFormat("en", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      }).formatToParts(new Date());
      const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
      offset = off.replace("GMT", "UTC");
    } catch {
      offset = "";
    }
    const is12h = timeFormat === "12h";
    const fmt = (d: Date) => new Intl.DateTimeFormat(getDateLocale(), {
      hour: "numeric",
      minute: "2-digit",
      hour12: is12h,
      timeZone: tz,
    }).format(d);
    const start = item.time.start;
    const end = item.time.end;
    const due = item.time.due;
    const timePart = start && end
      ? `${fmt(start)} - ${fmt(end)}`
      : start
        ? fmt(start)
        : end
          ? fmt(end)
          : due
            ? fmt(due)
            : null;
    return timePart ? `${timePart} · ${shortName}${offset ? ` (${offset})` : ""}` : `${shortName}${offset ? ` (${offset})` : ""}`;
  }

  function formatReminderMinutes(minutes: number): string {
    if (minutes < 60) return t("reminder.timeMin" as "reminder.timeMin", { minutes });
    if (minutes < 1440) return t("reminder.timeHour" as "reminder.timeHour", { hours: Math.floor(minutes / 60) });
    if (minutes < 10080) return t("reminder.timeDay" as "reminder.timeDay", { days: Math.floor(minutes / 1440) });
    return t("reminder.timeWeek" as "reminder.timeWeek", { weeks: Math.floor(minutes / 10080) });
  }

  function formatReminderLabel(r: Reminder): string {
    const isAllDay = r.dayOffset != null || r.triggerTime != null;
    if (isAllDay) {
      const time = r.triggerTime ?? "09:00";
      const days = r.dayOffset ?? 0;
      if (days === 0) return t("reminder.sameDayAt" as "reminder.sameDayAt", { time });
      if (days % 7 === 0) return t("reminder.timeWeekAt" as "reminder.timeWeekAt", { weeks: days / 7, time });
      return t("reminder.timeDayAt" as "reminder.timeDayAt", { days, time });
    }
    return t("reminder.timeBefore" as "reminder.timeBefore", { time: formatReminderMinutes(r.minutesBefore) });
  }

  const subtasks = manualItems.filter(
    (r) => r.parentId === item.id && !r.deletedAt,
  );

  const occurrenceKey = item.isRecurringInstance ? item.occurrenceKey : undefined;

  const isSubtaskCompleted = (subtask: typeof subtasks[number]) => {
    if (occurrenceKey) {
      return (subtask.completedOccurrenceKeys ?? []).includes(occurrenceKey);
    }
    return subtask.status === "completed";
  };

  const completedCount = subtasks.filter(isSubtaskCompleted).length;
  const subtaskProgress = subtasks.length > 0
    ? `${completedCount}/${subtasks.length}`
    : null;

  useEffect(() => {
    if (deleteDialogOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalScrollbarGutter = document.documentElement.style.scrollbarGutter;
      document.body.style.overflow = "hidden";
      document.documentElement.style.scrollbarGutter = "auto";
      return () => {
        document.body.style.overflow = originalOverflow;
        document.documentElement.style.scrollbarGutter = originalScrollbarGutter;
      };
    }
  }, [deleteDialogOpen]);

  useEffect(() => {
    return () => {
      dragPreviewCleanupRef.current?.();
      document.body.classList.remove(DRAG_CURSOR_CLASS);
      window.dispatchEvent(new CustomEvent(DRAG_VISUAL_EVENT, {
        detail: {
          enabled: false,
        },
      }));
    };
  }, []);

  function cleanupDragPreview() {
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = null;
  }

  function updateDragPreviewPosition(preview: HTMLElement, x: number, y: number, offset: { x: number; y: number }) {
    if (x <= 0 && y <= 0) {
      return;
    }

    preview.style.transform = `translate(${x - offset.x}px, ${y - offset.y}px)`;
  }

  function mountDragPreview(pointerOffset: { x: number; y: number }) {
    const source = surfaceRef.current;
    if (!source) {
      return null;
    }

    const rect = source.getBoundingClientRect();
    const preview = createDragPreviewElement(item, rect.width, {
      items: subtasks,
      isCompleted: isSubtaskCompleted,
      progressLabel: subtaskProgress,
      completedCount: completedCount,
    }, forceDateIfNotToday);
    document.body.appendChild(preview);

    const handleDocumentDragOver = (event: DragEvent) => {
      updateDragPreviewPosition(preview, event.clientX, event.clientY, pointerOffset);
    };

    document.addEventListener("dragover", handleDocumentDragOver, true);

    dragPreviewCleanupRef.current = () => {
      document.removeEventListener("dragover", handleDocumentDragOver, true);
      preview.remove();
    };

    return preview;
  }

  function setDraggingCursor(enabled: boolean) {
    document.body.classList.toggle(DRAG_CURSOR_CLASS, enabled);
    window.dispatchEvent(new CustomEvent(DRAG_VISUAL_EVENT, {
      detail: {
        enabled,
        color: enabled ? getTimelinePointColorForItem(item) : undefined,
      },
    }));
  }

  function handleDragStart(e: React.DragEvent) {
    if (disableDrag) {
      e.preventDefault();
      return;
    }

    const daysOfWeek = item.recurrence?.daysOfWeek ?? [];
    const daysOfWeekBoolean = Array(7).fill(false);
    for (const day of daysOfWeek) {
      if (day >= 0 && day <= 6) {
        daysOfWeekBoolean[day] = true;
      }
    }

    const subtaskTitles = subtasks.map((s) => s.title);

    const dragData: CandidateItem = {
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
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);

    const sourceRect = surfaceRef.current?.getBoundingClientRect();
    if (sourceRect) {
      const pointerOffset = {
        x: Math.max(0, e.clientX - sourceRect.left),
        y: Math.max(0, e.clientY - sourceRect.top),
      };
      const preview = mountDragPreview(pointerOffset);
      if (preview) {
        updateDragPreviewPosition(preview, e.clientX, e.clientY, pointerOffset);

        const transparentDragImage = document.createElement("canvas");
        transparentDragImage.width = 1;
        transparentDragImage.height = 1;
        e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
      }
    }
    setDraggingCursor(true);
  }

  function handleDragEnd() {
    if (disableDrag) {
      return;
    }

    cleanupDragPreview();
    setIsDragging(false);
    setDraggingCursor(false);
  }

  return (
    <article
      data-item-id={item.id}
      className={`group/item cursor-pointer ${isSelected ? "is-selected" : ""}`}
      onClick={(e) => {
        if (compactActions) return;
        e.stopPropagation();
        setSelectedItem(isSelected ? null : itemKey);
      }}
      draggable={!disableDrag}
      onDragStart={disableDrag ? undefined : handleDragStart}
      onDragEnd={disableDrag ? undefined : handleDragEnd}
    >
      <div
        ref={surfaceRef}
        className={`${disableLeadingBleed ? "" : "-ml-4"} rounded-xl ${isCompact ? "p-3" : "p-6"} opacity-100 transition-colors duration-200 ${isSelected || isDragging ? "bg-black/2" : disableHover ? "" : "hover:bg-black/2"}`}
      >
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {formatItemTime(item, forceDateIfNotToday) && (
                  <p className={`mb-2 ${isCompact ? "text-xs" : "text-sm"} font-medium tracking-[0.05em] tabular-nums text-[#7e7982] uppercase`}>
                    {formatItemTime(item, forceDateIfNotToday)}
                    {showTzBadge && (
                      <span className="ml-1.5 inline-block -translate-y-0.5 rounded bg-[#7e7982]/12 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#7e7982]">
                        {getTzBadgeLabel(itemTz!)}
                      </span>
                    )}
                    {isCompact && inlineMetadata && (item.priority || item.time.due || item.recurrence || item.estimateMinutes || (item.reminders && item.reminders.length > 0)) && (
                      <span className="ml-1.5 hidden lg:inline-flex flex-wrap items-center gap-1 align-middle">
                        {item.priority && !hidePriority && (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.05em] uppercase ${PRIORITY_CONFIG[item.priority].color.split(" ")[1]}`}>
                            {t(`priority.${item.priority}` as "priority.low" | "priority.medium" | "priority.high" | "priority.urgent")}
                          </span>
                        )}
                        {item.time.due && (
                          <span className="inline-flex items-center rounded-full border border-black/6 px-2 py-0.5 text-[10px] font-medium text-gray-400 dark:border-white/10">
                            {t("recurrence.due")}: {formatDueDate(item.time.due)}
                          </span>
                        )}
                        {item.recurrence && (
                          <span className="inline-flex items-center rounded-full border border-black/6 px-2 py-0.5 text-[10px] font-medium text-gray-400 dark:border-white/10">
                            {formatRecurrenceTranslated()}
                          </span>
                        )}
                        {item.estimateMinutes && (
                          <span className="inline-flex items-center rounded-full border border-black/6 px-2 py-0.5 text-[10px] font-medium text-gray-400 dark:border-white/10">
                            {item.estimateMinutes} {t("recurrence.min")}
                          </span>
                        )}
                        {item.reminders && item.reminders.length > 0 && item.reminders.map((r) => (
                          <span key={r.id} className="inline-flex items-center gap-1 rounded-full border border-black/6 px-2 py-0.5 text-[10px] font-medium text-gray-400 dark:border-white/10">
                            <Bell className="h-3 w-3" />
                            <span>{formatReminderLabel(r)}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </p>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div className={`mb-2 -ml-0.5 flex flex-wrap items-center ${isCompact ? "gap-1" : "gap-1.5"}`}>
                    {item.tags.map((tag) => (
                      <span key={tag} className={`rounded-full bg-gray-200 ${isCompact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"} font-medium text-gray-600`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <h4 className={`font-display ${isCompact ? "text-[clamp(0.95rem,1.5vw,1.2rem)]" : compactActions ? "text-[clamp(1.1rem,2vw,1.5rem)]" : "text-[clamp(1.65rem,3vw,2.35rem)]"} leading-[1.08] font-medium tracking-[-0.01em] transition-all ${
                  item.status === "completed"
                    ? "line-through text-[#b0a9b2]"
                    : "text-[#333139]"
                }`}>
                  {item.title}
                </h4>
              </div>
              {compactActions && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleComplete(item);
                      onAction?.();
                    }}
                    className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
                      item.status === "completed"
                        ? "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        : "text-green-500 hover:bg-green-50 hover:text-green-600"
                    }`}
                    title={item.status === "completed" ? t("recurrence.undoComplete") : t("recurrence.complete")}
                  >
                    {item.status === "completed" ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditItem(item);
                      onAction?.();
                    }}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canDeleteRecurringSeriesFromDisplayItem(item)) {
                        setDeleteDialogOpen(true);
                      } else {
                        handleDeleteItem(
                          item,
                          item.isRecurringInstance ? "single" : "series",
                        );
                        onAction?.();
                      }
                    }}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            {item.description ? (
              <p className={`${isCompact ? "mt-1.5 text-sm leading-5" : "mt-3 text-[1rem] leading-7"} max-w-2xl text-[#706b74]`}>
                {item.description}
              </p>
            ) : null}
            {subtasks.length > 0 && (
              <div className="mt-3">
                <div className={`${isCompact ? "space-y-0.5" : "space-y-1.5"}`}>
                  {subtasks.map((subtask) => {
                    const completed = isSubtaskCompleted(subtask);
                    return (
                    <button
                      key={subtask.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSubtaskComplete(subtask, occurrenceKey);
                      }}
                      className="group/sub flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-1 py-0.5 transition-colors hover:bg-black/2 text-left"
                    >
                      {completed ? (
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover/sub:text-gray-400" />
                      )}
                      <span
                        className={`${isCompact ? "text-xs" : "text-sm"} transition-colors ${
                          completed
                            ? "text-[#b0a9b2] line-through"
                            : "text-[#706b74]"
                        }`}
                      >
                        {subtask.title}
                      </span>
                    </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-2 pl-1">
                  <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 -rotate-90">
                    <circle cx="8" cy="8" r="5.5" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                      cx="8" cy="8" r="5.5" fill="none" stroke="#4ade80" strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 5.5}`}
                      strokeDashoffset={`${2 * Math.PI * 5.5 * (1 - completedCount / subtasks.length)}`}
                      className="transition-all duration-300"
                    />
                  </svg>
                  <span className="text-xs font-medium text-[#9f99a3]">{subtaskProgress} {t("recurrence.completed")}</span>
                </div>
              </div>
            )}
            {(item.priority || item.time.due || item.recurrence || item.estimateMinutes || (item.reminders && item.reminders.length > 0)) && (
              <div className={`mt-3 flex flex-wrap items-center gap-1.5 ${inlineMetadata ? "lg:hidden" : ""}`}>
                {item.priority && !hidePriority && (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-[0.05em] uppercase ${PRIORITY_CONFIG[item.priority].color.split(" ")[1]}`}>
                    {t(`priority.${item.priority}` as "priority.low" | "priority.medium" | "priority.high" | "priority.urgent")}
                  </span>
                )}
                {item.time.due && (
                  <span className="inline-flex items-center rounded-full border border-black/6 px-2 py-0.5 text-xs font-medium text-gray-400 dark:border-white/10">
                    {t("recurrence.due")}: {formatDueDate(item.time.due)}
                  </span>
                )}
                {item.recurrence && (
                  <span className="inline-flex items-center rounded-full border border-black/6 px-2 py-0.5 text-xs font-medium text-gray-400 dark:border-white/10">
                    {formatRecurrenceTranslated()}
                  </span>
                )}
                {item.estimateMinutes && (
                  <span className="inline-flex items-center rounded-full border border-black/6 px-2 py-0.5 text-xs font-medium text-gray-400 dark:border-white/10">
                    {item.estimateMinutes} {t("recurrence.min")}
                  </span>
                )}
                {item.reminders && item.reminders.length > 0 && item.reminders.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1 rounded-full border border-black/6 px-2 py-0.5 text-xs font-medium text-gray-400 dark:border-white/10">
                    <Bell className="h-3 w-3" />
                    <span>{formatReminderLabel(r)}</span>
                    <span className="text-gray-300">·</span>
                    <span>{r.method === "push" ? t("reminder.methodPush") : t("reminder.methodEmail")}</span>
                  </span>
                ))}
              </div>
            )}
            {!compactActions && (
              <div className={`grid transition-[grid-template-rows] duration-200 ${isSelected ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleComplete(item);
                      }}
                      className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        item.status === "completed"
                          ? "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          : "border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                      }`}
                    >
                      {item.status === "completed" ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          {t("recurrence.undoComplete")}
                        </>
                      ) : (
                        <>
                          <Circle className="h-4 w-4" />
                          {item.isRecurringInstance ? t("recurrence.completeThis") : t("recurrence.complete")}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditItem(item);
                      }}
                      className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                    >
                      <Pencil className="h-4 w-4" />
                      {t("recurrence.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canDeleteRecurringSeriesFromDisplayItem(item)) {
                          setDeleteDialogOpen(true);
                        } else {
                          handleDeleteItem(
                            item,
                            item.isRecurringInstance ? "single" : "series",
                          );
                        }
                      }}
                      className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("recurrence.delete")}
                    </button>
                    {extraActions}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setDeleteDialogOpen(false)}
        >
          <div
            className="w-72 rounded-3xl border border-black/5 bg-white p-0 shadow-[0_24px_64px_rgba(28,24,35,0.16)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sr-only" role="dialog" aria-label={t("recurrence.deleteTitle")} />
            <div className="px-6 pt-6 pb-2">
              <p className="text-base font-semibold text-[#25242a]">{t("recurrence.deleteTitle")}</p>
              <p className="mt-1 text-xs text-[#9f99a3]">{t("recurrence.deleteSubtitle")}</p>
            </div>
            <div className="space-y-0.5 px-2 pb-2">
              <button
                type="button"
                onClick={() => {
                  handleDeleteItem(item, "single");
                  setDeleteDialogOpen(false);
                  onAction?.();
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
              >
                <Trash2 className="h-4 w-4 shrink-0 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-[#25242a]">{t("recurrence.deleteThisOccurrence")}</p>
                  <p className="text-[11px] text-[#9f99a3]">{t("recurrence.deleteThisOccurrenceDesc")}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteItem(item, "series");
                  setDeleteDialogOpen(false);
                  onAction?.();
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
              >
                <Trash2 className="h-4 w-4 shrink-0 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-[#25242a]">{t("recurrence.deleteEntireSeries")}</p>
                  <p className="text-[11px] text-[#9f99a3]">{t("recurrence.deleteEntireSeriesDesc")}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-[#7d7880] transition-colors hover:bg-black/[0.03]"
              >
                {t("itemForm.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
