"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { LayoutGrid, MessageCircle, Repeat } from "lucide-react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { useI18n } from "@/lib/i18n";
import { buildKanbanColumns } from "@/lib/all-page-utils";
import { filterSections } from "@/components/all-page/list-view";
import { useNow } from "@/lib/hooks/use-now";
import type { KanbanColumn, KanbanColumnId, ListFilterConfig, ListSortConfig, ManualItemRecord, Section } from "@/lib/types/all-page";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { EmptyState } from "@/components/ui/empty-state";
import { KanbanColumn as KanbanColumnView } from "./kanban-column";

type KanbanViewProps = {
  sections: Section[];
  filterConfig: ListFilterConfig;
  sortConfig?: ListSortConfig;
  doneLookbackDays?: number;
};

interface ToastMessage {
  id: number;
  itemTitle: string;
  columnLabel: string;
  isRecurring: boolean;
  isUnsupported?: boolean;
  undoAction?: () => void;
}

const COLUMN_LABEL_KEYS: Record<KanbanColumnId, TranslationKey> = {
  backlog: "kanban.column.backlog",
  today: "kanban.column.today",
  done: "kanban.column.done",
};

function collectDisplayItems(sections: Section[]) {
  const items = [];
  for (const section of sections) {
    for (const group of section.groups) {
      for (const item of group.items) {
        items.push(item);
      }
    }
  }
  return items;
}

export function KanbanView({
  sections,
  filterConfig,
  sortConfig,
  doneLookbackDays = 1,
}: KanbanViewProps) {
  const { t } = useI18n();
  const openComposer = useAllPageStore((s) => s.openComposer);
  const restoreMovedItem = useAllPageStore((s) => s.restoreMovedItem);
  const ai = useAiChatContext();
  const now = useNow();

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredSections = useMemo(
    () => filterSections(sections, filterConfig),
    [sections, filterConfig],
  );

  const allItems = useMemo(() => collectDisplayItems(filteredSections), [filteredSections]);
  const columns = useMemo<KanbanColumn[]>(() => {
    return buildKanbanColumns(allItems, now, { doneLookbackDays, sortConfig });
  }, [allItems, doneLookbackDays, sortConfig, now]);

  const isFiltered = useMemo(
    () =>
      filterConfig.timePreset !== "none" ||
      filterConfig.status !== "all" ||
      filterConfig.selectedTags.length > 0 ||
      filterConfig.selectedPriorities.length > 0 ||
      !!filterConfig.searchQuery?.trim(),
    [filterConfig],
  );

  const handleDropComplete = useCallback(
    (itemTitle: string, targetColumn: KanbanColumnId, originalRecord: ManualItemRecord, isRecurring: boolean) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      setToast({
        id: Date.now(),
        itemTitle,
        columnLabel: t(COLUMN_LABEL_KEYS[targetColumn]),
        isRecurring,
        undoAction: () => {
          restoreMovedItem(originalRecord);
          setToast(null);
          if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
          }
        },
      });

      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 5000);
    },
    [restoreMovedItem, t],
  );

  const handleDropUnsupported = useCallback(
    (itemTitle: string, targetColumn: KanbanColumnId, isRecurring: boolean) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      setToast({
        id: Date.now(),
        itemTitle,
        columnLabel: t(COLUMN_LABEL_KEYS[targetColumn]),
        isRecurring,
        isUnsupported: true,
      });

      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 3000);
    },
    [t],
  );

  const hasAnyItem = columns.some((c) => c.items.length > 0);

  if (!hasAnyItem) {
    return (
      <div className="rounded-2xl border border-dashed border-black/8 bg-white/40 p-6 dark:border-white/8 dark:bg-white/[0.04]">
        <EmptyState
          icon={isFiltered ? LayoutGrid : MessageCircle}
          title={t("kanban.empty.title")}
          description={t("empty.list.description")}
          action={{ label: t("empty.createTask"), onClick: () => openComposer() }}
          secondaryAction={{ label: t("welcome.askAi"), icon: MessageCircle, onClick: () => ai.setExpandedState(true) }}
        />
      </div>
    );
  }

  return (
    <div className="pb-2">
      <div className="grid items-start gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map((column) => (
          <KanbanColumnView
            key={column.id}
            column={column}
            now={now}
            onDropComplete={handleDropComplete}
            onDropUnsupported={handleDropUnsupported}
          />
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#25242a] text-white px-4 py-2.5 rounded-xl shadow-lg">
          {toast.isRecurring && <Repeat className="h-4 w-4 shrink-0" />}
          <span className="text-sm">
            {toast.isUnsupported ? (
              t("kanban.recurring.unsupported")
            ) : (
              <>
                <span className="font-medium">{toast.itemTitle}</span>{" "}
                {t("kanban.movedTo", { column: toast.columnLabel })}
              </>
            )}
          </span>
          {toast.undoAction && (
            <button
              type="button"
              onClick={toast.undoAction}
              className="text-sm font-medium text-white/70 hover:text-white underline underline-offset-2 cursor-pointer"
            >
              {t("common.undo")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
