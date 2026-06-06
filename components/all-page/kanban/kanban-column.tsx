"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useI18n } from "@/lib/i18n";
import { translate } from "@/lib/i18n/dictionary";
import { isOverdueDisplayItem, toItemFromManualRecord } from "@/lib/all-page-utils";
import type { DisplayItem, KanbanColumnId, KanbanColumn as KanbanColumnType, ManualItemRecord } from "@/lib/types/all-page";
import { KanbanCard } from "./kanban-card";

export const KANBAN_DRAG_MIME = "application/x-orkest-kanban-item";

type KanbanColumnProps = {
  column: KanbanColumnType;
  now: Date;
  onDropComplete?: (itemTitle: string, targetColumn: KanbanColumnId, originalRecord: ManualItemRecord) => void;
};

type DragPayload = {
  itemId: string;
  occurrenceKey?: string;
  sourceColumn?: KanbanColumnId;
};

function readDragPayload(dataTransfer: DataTransfer): DragPayload | null {
  const raw = dataTransfer.getData(KANBAN_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (!parsed || typeof parsed.itemId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function KanbanColumn({ column, now, onDropComplete }: KanbanColumnProps) {
  const { t, locale } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const density = useSettingsStore((s) => s.density);
  const isCompact = density === "compact";

  const title = translate(locale, column.titleKey as Parameters<typeof translate>[1]);
  const emptyMessage = (() => {
    if (column.id === "backlog") return t("kanban.empty.backlog");
    if (column.id === "today") return t("kanban.empty.today");
    return t("kanban.empty.done");
  })();

  const items = useAllPageStore((s) => s.manualItems);
  const handleMoveItemToColumn = useAllPageStore((s) => s.handleMoveItemToColumn);

  function findItemForDrop(payload: DragPayload): DisplayItem | null {
    for (const record of items) {
      if (record.id !== payload.itemId) continue;
      if (record.deletedAt) return null;
      if (payload.occurrenceKey) {
        if (record.completedOccurrences?.includes(payload.occurrenceKey)) {
          return null;
        }
        if (record.status === "completed") {
          return null;
        }
      }
      return toItemFromManualRecord(record) as DisplayItem;
    }
    return null;
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes(KANBAN_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!isDragOver) setIsDragOver(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const payload = readDragPayload(event.dataTransfer);
    if (!payload) return;
    if (payload.sourceColumn === column.id) return;
    const source = findItemForDrop(payload);
    if (!source) return;
    const result = handleMoveItemToColumn(source, column.id as KanbanColumnId);
    if (result && onDropComplete) {
      onDropComplete(source.title, column.id as KanbanColumnId, result.originalRecord);
    }
  }

  return (
    <section
      aria-label={title}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex min-w-0 flex-col rounded-2xl border transition-colors ${
        isDragOver
          ? "border-[#25242a]/40 bg-[#f4f0ec]/70 dark:border-white/30 dark:bg-[#1a1a1a]/80"
          : "border-black/6 bg-[#f4f0ec]/40 dark:border-white/8 dark:bg-[#1a1a1a]/60"
      } backdrop-blur-sm`}
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="truncate text-xs font-semibold tracking-[0.15em] text-[#525059] uppercase dark:text-[#a3a3a3]">
            {title}
          </h3>
          <span className="text-xs font-medium text-[#9f99a3] dark:text-[#6a6570]">
            {column.count}
          </span>
        </div>
        {column.isCollapsible && column.count > 0 ? (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[#9f99a3] transition-colors hover:bg-black/5 hover:text-[#525059] dark:hover:bg-white/8 dark:hover:text-[#d4d4d4]"
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </header>

      {!collapsed && (
        <div className={`scrollbar-transparent-track flex-1 ${isCompact ? "space-y-1" : "space-y-2"} overflow-y-auto px-2 pt-2 pb-2`} style={{ maxHeight: "calc(100vh - 160px)" }}>
          {column.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/8 bg-white/30 px-3 py-6 text-center dark:border-white/8 dark:bg-white/[0.02]">
              <p className="text-xs text-[#9f99a3] dark:text-[#6a6570]">{emptyMessage}</p>
            </div>
          ) : (
            column.items.map((item) => {
              const overdue = isOverdueDisplayItem(item, now);
              return (
                <KanbanCard
                  key={`${item.id}:${item.occurrenceKey ?? "base"}`}
                  item={item}
                  isOverdue={overdue}
                  sourceColumn={column.id}
                />
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
