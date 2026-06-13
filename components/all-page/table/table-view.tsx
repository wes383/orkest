"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { CheckCircle, Circle, Plus, Trash2, X } from "lucide-react";
import { TableHeader } from "./table-header";
import { TableRow } from "./table-row";
import { TableEmptyState } from "./table-empty-state";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { sortTableRows, type TableSortConfig } from "@/lib/table-sort";
import { getFilteredListItems, getListItemKey } from "@/components/all-page/list-view";
import type { Section, ListFilterConfig, DisplayItem } from "@/lib/types/all-page";

function hasActiveFilters(config: ListFilterConfig) {
  return (
    config.timePreset !== "none" ||
    config.status !== "all" ||
    config.selectedTags.length > 0 ||
    config.selectedPriorities.length > 0 ||
    !!config.searchQuery?.trim() ||
    (config.selectedProjectIds && config.selectedProjectIds.length > 0)
  );
}

function BatchActionBar({
  selectedCount,
  allCompleted,
  allActive,
  onComplete,
  onUndoComplete,
  onDelete,
  onCancel,
}: {
  selectedCount: number;
  allCompleted: boolean;
  allActive: boolean;
  onComplete: () => void;
  onUndoComplete: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.15)] bg-white/50 dark:bg-[#1e1e1e]/80 dark:border-white/10 backdrop-blur-[18px] saturate-150">
      <span className="text-sm font-medium text-[#525059] dark:text-[#d4d4d4] mr-1">
        {t("table.batch.selected", { count: selectedCount }) as string}
      </span>
      {allActive && (
        <Button
          size="sm"
          variant="outline"
          onClick={onComplete}
          className="h-8 gap-1.5 text-xs border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-800/50 dark:text-green-400 dark:hover:bg-green-950/40 dark:hover:text-green-300"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {t("table.batch.complete") as string}
        </Button>
      )}
      {allCompleted && (
        <Button
          size="sm"
          variant="outline"
          onClick={onUndoComplete}
          className="h-8 gap-1.5 text-xs dark:border-white/10 dark:text-[#d4d4d4] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
        >
          <Circle className="h-3.5 w-3.5" />
          {t("table.batch.undo") as string}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onDelete}
        className="h-8 gap-1.5 text-xs border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {t("table.batch.delete") as string}
      </Button>
      <div className="w-px h-5 bg-black/10 dark:bg-white/15 mx-1" />
      <Button
        size="sm"
        variant="ghost"
        onClick={onCancel}
        className="h-8 gap-1 text-xs text-[#7d7880] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#d4d4d4]"
      >
        <X className="h-3.5 w-3.5" />
        {t("table.batch.cancel") as string}
      </Button>
    </div>
  );
}

export function TableView({
  sections,
  filterConfig,
  selectedIds,
  onSelectedIdsChange,
  onClearFilters,
}: {
  sections: Section[];
  filterConfig: ListFilterConfig;
  selectedIds: Set<string>;
  onSelectedIdsChange: Dispatch<SetStateAction<Set<string>>>;
  onClearFilters: () => void;
}) {
  const { t } = useI18n();
  const handleBatchDelete = useAllPageStore((s) => s.handleBatchDelete);
  const handleBatchToggleComplete = useAllPageStore((s) => s.handleBatchToggleComplete);
  const handleEditItem = useAllPageStore((s) => s.handleEditItem);
  const handleToggleComplete = useAllPageStore((s) => s.handleToggleComplete);
  const openComposer = useAllPageStore((s) => s.openComposer);
  const density = useSettingsStore((s) => s.density);
  const isCompact = density === "compact";

  // Table-specific sort lives alongside the legacy sort config.
  const [tableSort, setTableSort] = useState<TableSortConfig>({
    column: "start",
    direction: "asc",
  });

  const filteredItems = useMemo(
    () => getFilteredListItems(sections, filterConfig),
    [sections, filterConfig],
  );
  const sortedItems = useMemo(
    () => sortTableRows(filteredItems, tableSort),
    [filteredItems, tableSort],
  );

  const isFiltered = hasActiveFilters(filterConfig);

  const toggleSelect = useCallback(
    (key: string) => {
      onSelectedIdsChange((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [onSelectedIdsChange],
  );

  const allKeys = useMemo(
    () => sortedItems.map((item) => getListItemKey(item)),
    [sortedItems],
  );
  const visibleSelectedCount = useMemo(
    () => allKeys.filter((k) => selectedIds.has(k)).length,
    [allKeys, selectedIds],
  );
  const allSelected = allKeys.length > 0 && visibleSelectedCount === allKeys.length;
  const someSelected = visibleSelectedCount > 0;

  const toggleSelectAll = useCallback(() => {
    const visible = new Set(allKeys);
    onSelectedIdsChange((prev) => {
      if (allSelected) {
        return new Set([...prev].filter((k) => !visible.has(k)));
      }
      return new Set([...prev, ...allKeys]);
    });
  }, [allKeys, allSelected, onSelectedIdsChange]);

  const clearSelection = useCallback(() => {
    onSelectedIdsChange(new Set());
  }, [onSelectedIdsChange]);

  const selectedItems: DisplayItem[] = useMemo(
    () => sortedItems.filter((item) => selectedIds.has(getListItemKey(item))),
    [sortedItems, selectedIds],
  );
  const allCompleted = selectedItems.length > 0 && selectedItems.every((i) => i.status === "completed");
  const allActive = selectedItems.length > 0 && selectedItems.every((i) => i.status !== "completed");

  const handleBatchComplete = useCallback(() => {
    handleBatchToggleComplete(selectedItems, "completed");
    clearSelection();
  }, [selectedItems, handleBatchToggleComplete, clearSelection]);

  const handleBatchUndoComplete = useCallback(() => {
    handleBatchToggleComplete(selectedItems, "active");
    clearSelection();
  }, [selectedItems, handleBatchToggleComplete, clearSelection]);

  const handleBatchDeleteAction = useCallback(() => {
    handleBatchDelete(selectedItems);
    clearSelection();
  }, [selectedItems, handleBatchDelete, clearSelection]);

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#7d7880] dark:text-[#a3a3a3]">
            {t("table.filteredCount", { count: sortedItems.length }) as string}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={onClearFilters}
              className="cursor-pointer rounded-full border border-black/8 bg-white px-2.5 py-0.5 text-[10px] font-medium text-[#525059] hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4] dark:hover:bg-white/10"
            >
              {t("common.clearFilters") as string}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openComposer()}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-[#25242a] px-3 py-1.5 text-xs font-medium tracking-wide text-white transition-colors hover:bg-[#3a3940] dark:bg-white dark:text-[#101010] dark:hover:bg-[#e0e0e0]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("table.toolbar.create")}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-transparent-track rounded-2xl border border-black/8 bg-white/40 dark:border-white/8 dark:bg-white/[0.04]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <TableHeader
            sort={tableSort}
            onSortChange={setTableSort}
            allSelected={allSelected}
            onToggleSelectAll={toggleSelectAll}
          />
          <tbody>
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-0">
                  <TableEmptyState
                    isFiltered={isFiltered}
                    onClearFilters={onClearFilters}
                  />
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => {
                const key = getListItemKey(item);
                return (
                  <TableRow
                    key={key}
                    item={item}
                    itemKey={key}
                    isSelected={selectedIds.has(key)}
                    isCompact={isCompact}
                    onToggleSelect={toggleSelect}
                    onOpen={handleEditItem}
                    onToggleComplete={handleToggleComplete}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {someSelected && (
        <BatchActionBar
          selectedCount={visibleSelectedCount}
          allCompleted={allCompleted}
          allActive={allActive}
          onComplete={handleBatchComplete}
          onUndoComplete={handleBatchUndoComplete}
          onDelete={handleBatchDeleteAction}
          onCancel={clearSelection}
        />
      )}
    </div>
  );
}
