"use client";

import { useEffect, useRef } from "react";

import { ItemCard } from "../item-card";
import { createDragPreviewElement } from "../item-card";
import { useI18n } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { formatDateInput } from "@/lib/all-page-utils";
import type { DisplayItem, KanbanColumnId } from "@/lib/types/all-page";
import type { CandidateItem } from "@/lib/ai/candidate-search";
import { KANBAN_DRAG_MIME } from "./kanban-column";

type KanbanCardProps = {
  item: DisplayItem;
  isOverdue?: boolean;
  sourceColumn: KanbanColumnId;
};

type DragPayload = {
  itemId: string;
  occurrenceKey?: string;
  sourceColumn: KanbanColumnId;
};

const DRAG_CURSOR_CLASS = "is-item-dragging";
const DRAG_VISUAL_EVENT = "orkest:item-drag-visual";

export function KanbanCard({ item, isOverdue = false, sourceColumn }: KanbanCardProps) {
  const { t } = useI18n();
  const density = useSettingsStore((s) => s.density);
  const isCompact = density === "compact";
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  function handleDragStart(event: React.DragEvent<HTMLDivElement>) {
    dragCleanupRef.current?.();

    document.body.classList.add(DRAG_CURSOR_CLASS);
    window.dispatchEvent(new CustomEvent(DRAG_VISUAL_EVENT, {
      detail: { enabled: true, color: "#7b7580" },
    }));

    const payload: DragPayload = {
      itemId: item.id,
      occurrenceKey: item.occurrenceKey,
      sourceColumn,
    };
    event.dataTransfer.setData(KANBAN_DRAG_MIME, JSON.stringify(payload));

    const daysOfWeekBoolean: Array<boolean | number> = [];
    const daysOfWeek = item.recurrence?.daysOfWeek ?? [];
    for (const day of daysOfWeek) {
      if (day >= 0 && day <= 6) {
        daysOfWeekBoolean[day] = true;
      }
    }

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
    };
    event.dataTransfer.setData("application/json", JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = "move";

    const sourceRect = event.currentTarget.getBoundingClientRect();
    const pointerOffset = {
      x: Math.max(0, event.clientX - sourceRect.left),
      y: Math.max(0, event.clientY - sourceRect.top),
    };
    const preview = createDragPreviewElement(item, sourceRect.width, undefined, true);
    document.body.appendChild(preview);

    const transparentDragImage = document.createElement("canvas");
    transparentDragImage.width = 1;
    transparentDragImage.height = 1;
    event.dataTransfer.setDragImage(transparentDragImage, 0, 0);

    const handleDocumentDragOver = (e: DragEvent) => {
      preview.style.transform = `translate(${e.clientX - pointerOffset.x}px, ${e.clientY - pointerOffset.y}px)`;
    };

    const cleanup = () => {
      document.removeEventListener("dragover", handleDocumentDragOver, true);
      document.removeEventListener("dragend", handleGlobalDragEnd, true);
      preview.remove();
      document.body.classList.remove(DRAG_CURSOR_CLASS);
      window.dispatchEvent(new CustomEvent(DRAG_VISUAL_EVENT, {
        detail: { enabled: false },
      }));
      dragCleanupRef.current = null;
    };

    const handleGlobalDragEnd = () => {
      cleanup();
    };

    document.addEventListener("dragover", handleDocumentDragOver, true);
    document.addEventListener("dragend", handleGlobalDragEnd, true);

    dragCleanupRef.current = cleanup;
  }

  return (
    <div
      data-item-id={item.id}
      draggable
      onDragStart={handleDragStart}
      className={`group relative cursor-grab rounded-xl border border-black/6 bg-white/70 ${isCompact ? "p-0.5" : "p-1"} transition-colors active:cursor-grabbing hover:bg-white dark:border-white/8 dark:bg-white/[0.04] dark:hover:bg-white/[0.06]`}
    >
      {isOverdue ? (
        <span
          className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm dark:bg-red-500"
          title={t("kanban.overdueBadge")}
        >
          {t("kanban.overdueBadge")}
        </span>
      ) : null}
      <ItemCard
        item={item}
        disableDrag
        disableLeadingBleed
        forceDateIfNotToday
        compactActions
        hidePriority={false}
      />
    </div>
  );
}
