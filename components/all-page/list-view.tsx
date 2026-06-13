"use client";

import { useMemo, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { CheckCircle, Circle, ListTodo, MessageCircle, Trash2, X } from "lucide-react";
import { ItemCard } from "./item-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { Button } from "@/components/ui/button";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useI18n } from "@/lib/i18n";
import type { Section, DisplayItem, ListFilterConfig, ListSortConfig } from "@/lib/types/all-page";
import {
  getAnchorDate,
  getDateCategory,
  groupItemsByDay,
  formatDayLabel,
  sortDisplayItems,
  sortUnscheduledItems,
  getWeekStartDate,
  PRIORITY_CONFIG,
  DATE_LABEL_COLORS,
} from "@/lib/all-page-utils";

function startOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function makeLocalDate(dateString: string) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getPresetRange(config: ListFilterConfig) {
  if (config.timePreset === "none") {
    return null;
  }

  const today = startOfLocalDay(new Date());
  let start = new Date(today);
  let end = endOfLocalDay(today);

  if (config.timePreset === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end = endOfLocalDay(start);
  } else if (config.timePreset === "week") {
    start = getWeekStartDate(start);
    end = endOfLocalDay(start);
    end.setDate(start.getDate() + 6);
  } else if (config.timePreset === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = endOfLocalDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  } else if (config.timePreset === "custom") {
    const customStart = makeLocalDate(config.customStartDate);
    const customEnd = makeLocalDate(config.customEndDate);
    start = customStart ? startOfLocalDay(customStart) : new Date(-8640000000000000);
    end = customEnd ? endOfLocalDay(customEnd) : new Date(8640000000000000);
  }

  return { start, end };
}

function getScheduleRanges(item: DisplayItem) {
  const ranges: Array<{ start: Date; end: Date }> = [];
  const occurrenceDate = item.occurrenceDate;

  if (occurrenceDate) {
    ranges.push({ start: startOfLocalDay(occurrenceDate), end: endOfLocalDay(occurrenceDate) });
  }

  if (item.time.start || item.time.end) {
    const start = item.time.start ?? item.time.end!;
    const end = item.time.end ?? item.time.start!;
    ranges.push({ start: startOfLocalDay(start), end: endOfLocalDay(end) });
  }

  if (item.time.due) {
    ranges.push({ start: startOfLocalDay(item.time.due), end: endOfLocalDay(item.time.due) });
  }

  return ranges;
}

function rangeOverlaps(
  left: { start: Date; end: Date },
  right: { start: Date; end: Date },
) {
  return left.start <= right.end && left.end >= right.start;
}

function matchesFilters(item: DisplayItem, config: ListFilterConfig) {
  // Text search filter (cheapest check, runs first)
  if (config.searchQuery?.trim()) {
    const q = config.searchQuery.trim().toLowerCase();
    const title = item.title?.toLowerCase() ?? "";
    const desc = item.description?.toLowerCase() ?? "";
    if (!title.includes(q) && !desc.includes(q)) return false;
  }

  const timeRange = getPresetRange(config);
  if (timeRange) {
    const scheduleRanges = getScheduleRanges(item);
    if (
      scheduleRanges.length === 0 ||
      !scheduleRanges.some((range) => rangeOverlaps(range, timeRange))
    ) {
      return false;
    }
  }

  if (config.status === "active" && item.status === "completed") {
    return false;
  }
  if (config.status === "completed" && item.status !== "completed") {
    return false;
  }

  if (config.selectedTags?.length > 0) {
    const itemTags = item.tags ?? [];
    const matches =
      config.tagMatchMode === "and"
        ? config.selectedTags.every((tag) => itemTags.includes(tag))
        : config.selectedTags.some((tag) => itemTags.includes(tag));
    if (!matches) {
      return false;
    }
  }

  if (config.selectedPriorities?.length > 0) {
    const priority = item.priority ?? "none";
    if (!config.selectedPriorities.includes(priority)) {
      return false;
    }
  }

  if (config.selectedProjectIds?.length > 0) {
    const projectId = item.projectId ?? null;
    // Single-select mode: items must match the selected project. Items with
    // no project are excluded when a project filter is active.
    if (projectId === null || !config.selectedProjectIds.includes(projectId)) {
      return false;
    }
  }

  return true;
}

export function filterSections(sections: Section[], filterConfig: ListFilterConfig): Section[] {
  return sections
    .map((section) => ({
      ...section,
      groups: section.groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => matchesFilters(item, filterConfig)),
        }))
        .filter((group) => group.items.length > 0),
    }))
    .filter((section) => section.groups.length > 0);
}

function hasActiveFilters(config: ListFilterConfig) {
  return (
    config.timePreset !== "none" ||
    config.status !== "all" ||
    config.selectedTags.length > 0 ||
    config.selectedPriorities.length > 0 ||
    !!config.searchQuery?.trim()
  );
}

function getTimedItems(sections: Section[]): DisplayItem[] {
  const items: DisplayItem[] = [];

  for (const section of sections) {
    if (section.id === "no-date") continue;
    items.push(...section.groups.flatMap((g) => g.items));
  }

  return [...items].sort(
    (a, b) => getAnchorDate(a).getTime() - getAnchorDate(b).getTime(),
  );
}

function getUnscheduledItems(sections: Section[]): DisplayItem[] {
  const noDateSection = sections.find((s) => s.id === "no-date");
  if (!noDateSection) return [];
  return noDateSection.groups.flatMap((g) => g.items);
}

function getAllItems(sections: Section[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const section of sections) {
    items.push(...section.groups.flatMap((g) => g.items));
  }
  return items;
}

export function getListItemKey(item: DisplayItem) {
  return `${item.id}:${item.occurrenceKey ?? "base"}`;
}

export function getFilteredListItems(
  sections: Section[],
  filterConfig: ListFilterConfig,
) {
  return getAllItems(filterSections(sections, filterConfig));
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
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 px-5 py-3 rounded-2xl border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.15)] bg-white/50 dark:bg-[#1e1e1e]/80 dark:border-white/10 backdrop-blur-[18px] saturate-150"
    >
      <span className="w-full text-center sm:w-auto sm:text-left text-sm font-medium text-[#525059] dark:text-[#d4d4d4] sm:mr-1">
        {selectedCount} {t("batch.selected")}
      </span>
      <div className="flex items-center gap-2 sm:gap-3">
        {allActive && (
          <Button
            size="sm"
            variant="outline"
            onClick={onComplete}
            className="h-8 gap-1.5 text-xs border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-800/50 dark:text-green-400 dark:hover:bg-green-950/40 dark:hover:text-green-300"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            {t("batch.complete")}
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
            {t("batch.undo")}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          className="h-8 gap-1.5 text-xs border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete")}
        </Button>
        <div className="w-px h-5 bg-black/10 dark:bg-white/15 mx-0.5 sm:mx-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-8 gap-1 text-xs text-[#7d7880] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#d4d4d4]"
        >
          <X className="h-3.5 w-3.5" />
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

function ListRow({
  item,
  hidePriority = false,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  item: DisplayItem;
  hidePriority?: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (itemKey: string) => void;
}) {
  const density = useSettingsStore((s) => s.density);
  const isCompact = density === "compact";
  const itemKey = `${item.id}:${item.occurrenceKey ?? "base"}`;
  
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border transition-colors ${
        isSelectionMode
          ? `cursor-pointer ${isSelected ? "border-blue-300 bg-blue-50/80 dark:border-blue-700/60 dark:bg-blue-950/40" : "border-black/6 bg-white/40 hover:bg-black/[0.04] dark:border-white/8 dark:bg-white/[0.04] dark:hover:bg-white/8"}`
          : "border-black/6 bg-white/40 hover:bg-white/70 dark:border-white/8 dark:bg-white/[0.04] dark:hover:bg-white/8"
      }`}
      onClick={isSelectionMode ? () => onToggleSelect?.(itemKey) : undefined}
    >
      <div className="flex-1 min-w-0">
        <ItemCard
          item={item}
          disableDrag={isSelectionMode}
          disableLeadingBleed
          forceDateIfNotToday
          compactActions
          hidePriority={hidePriority}
          inlineMetadata={isCompact}
        />
      </div>
    </div>
  );
}

export function ListView({
  sections,
  sortConfig,
  filterConfig,
  isSelectionMode,
  selectedIds,
  onSelectionModeChange,
  onSelectedIdsChange,
}: {
  sections: Section[];
  sortConfig: ListSortConfig;
  filterConfig: ListFilterConfig;
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  onSelectionModeChange: (value: boolean) => void;
  onSelectedIdsChange: Dispatch<SetStateAction<Set<string>>>;
}) {
  const handleBatchDelete = useAllPageStore((s) => s.handleBatchDelete);
  const handleBatchToggleComplete = useAllPageStore((s) => s.handleBatchToggleComplete);
  const openComposer = useAllPageStore((s) => s.openComposer);
  const ai = useAiChatContext();
  useSettingsStore((s) => s.locale);
  const density = useSettingsStore((s) => s.density);
  const isCompact = density === "compact";
  const { t } = useI18n();

  const filteredSections = useMemo(
    () => filterSections(sections, filterConfig),
    [sections, filterConfig],
  );
  const isFiltered = hasActiveFilters(filterConfig);

  const timedItemsRaw = getTimedItems(filteredSections);
  const unscheduledItemsRaw = getUnscheduledItems(filteredSections);

  const timedItems = sortConfig.mode === "time"
    ? sortDisplayItems(timedItemsRaw, sortConfig)
    : sortDisplayItems(timedItemsRaw, sortConfig);

  const unscheduledItems = sortConfig.mode === "time"
    ? sortUnscheduledItems(unscheduledItemsRaw, sortConfig.unscheduledSort)
    : sortDisplayItems(unscheduledItemsRaw, sortConfig);

  const timedGroups = groupItemsByDay(
    timedItems,
    sortConfig.mode === "time" ? sortConfig.timeDirection : "asc",
    sortConfig.mode === "time",
  );

  const allItems = useMemo(() => getAllItems(filteredSections), [filteredSections]);

  const getItemKey = useCallback((item: DisplayItem) => getListItemKey(item), []);

  const toggleItemSelection = useCallback((itemKey: string) => {
    onSelectedIdsChange((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  }, [onSelectedIdsChange]);

  const clearSelection = useCallback(() => {
    onSelectionModeChange(false);
    onSelectedIdsChange(new Set());
  }, [onSelectedIdsChange, onSelectionModeChange]);

  const selectedItems = useMemo(
    () => allItems.filter((item) => selectedIds.has(getItemKey(item))),
    [allItems, selectedIds, getItemKey],
  );

  const allCompleted = selectedItems.length > 0 && selectedItems.every((item) => item.status === "completed");
  const allActive = selectedItems.length > 0 && selectedItems.every((item) => item.status !== "completed");

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

  if (sortConfig.mode === "priority") {
    const priorityItems = sortDisplayItems(allItems, sortConfig);
    const priorityLabels: Record<string, string> = {
      urgent: t("priority.urgent") as string,
      high: t("priority.high") as string,
      medium: t("priority.medium") as string,
      low: t("priority.low") as string,
      none: t("listControls.noPriority") as string,
    };
    const allGroups = groupItemsByPriority(priorityItems, priorityLabels);
    const highPriorityGroups = allGroups.filter((g) => g.priority === "urgent" || g.priority === "high");
    const lowPriorityGroups = allGroups.filter((g) => g.priority !== "urgent" && g.priority !== "high");

    function renderPriorityColumn(groups: typeof allGroups) {
      return (
        <div className={`${isCompact ? "space-y-3" : "space-y-6"}`}>
          {groups.map((group) => {
            const p = group.priority;
            const labelColor = p && p in PRIORITY_CONFIG
              ? PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].textColor
              : "#9f99a3";
            return (
              <div key={p ?? "none"}>
                <div className="mb-2 flex items-center gap-3">
                  <h3
                    className="text-xs font-semibold tracking-[0.15em] uppercase"
                    style={{ color: labelColor }}
                  >
                    {group.label}
                  </h3>
                  {group.items.length > 0 && (
                    <span className="text-xs" style={{ color: labelColor }}>
                      {group.items.length}
                    </span>
                  )}
                </div>
                <div className={`${isCompact ? "space-y-0.5" : "space-y-1"}`}>
                  {group.items.map((item) => (
                    <ListRow
                      key={`${item.id}:${item.occurrenceKey ?? "base"}`}
                      item={item}
                      hidePriority
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.has(getItemKey(item))}
                      onToggleSelect={toggleItemSelection}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className={`${isCompact ? "space-y-4" : "space-y-8"}`}>
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-[0.2em] text-[#6f6a72] uppercase">
              {t("listControls.byPriority")}
            </h2>
          </div>
          {priorityItems.length > 0 ? (
            <div className={`grid gap-8 ${highPriorityGroups.length > 0 && lowPriorityGroups.length > 0 ? "lg:grid-cols-2" : ""}`}>
              {highPriorityGroups.length > 0 && renderPriorityColumn(highPriorityGroups)}
              {lowPriorityGroups.length > 0 && renderPriorityColumn(lowPriorityGroups)}
            </div>
          ) : (
            isFiltered ? (
              <p className="py-8 text-center text-sm text-[#9f99a3]">
                {t("listControls.noItemsMatchFilters") as string}
              </p>
            ) : (
              <EmptyState
                icon={ListTodo}
                title={t("empty.list.title")}
                description={t("empty.list.description")}
                compact
                action={{ label: t("empty.createTask"), onClick: () => openComposer() }}
                secondaryAction={{ label: t("welcome.askAi"), icon: MessageCircle, onClick: () => ai.setExpandedState(true) }}
              />
            )
          )}
        </div>

        {isSelectionMode && selectedItems.length > 0 && (
          <BatchActionBar
            selectedCount={selectedItems.length}
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

  if (sortConfig.mode === "created") {
    const createdItems = sortDisplayItems(allItems, sortConfig);

    return (
      <div className={`${isCompact ? "space-y-4" : "space-y-8"}`}>
        <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-[0.2em] text-[#6f6a72] uppercase">
                {t("listControls.byCreated")}
              </h2>
            </div>
          <div className={`${isCompact ? "space-y-0.5" : "space-y-1"}`}>
            {createdItems.length > 0 ? (
              createdItems.map((item) => (
                <ListRow
                  key={`${item.id}:${item.occurrenceKey ?? "base"}`}
                  item={item}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(getItemKey(item))}
                  onToggleSelect={toggleItemSelection}
                />
              ))
            ) : (
              isFiltered ? (
                <p className="py-8 text-center text-sm text-[#9f99a3]">
                  {t("listControls.noItemsMatchFilters") as string}
                </p>
              ) : (
                <EmptyState
                  icon={ListTodo}
                  title={t("empty.list.title")}
                  description={t("empty.list.description")}
                  compact
                  action={{ label: t("empty.createTask"), onClick: () => openComposer() }}
                  secondaryAction={{ label: t("welcome.askAi"), icon: MessageCircle, onClick: () => ai.setExpandedState(true) }}
                />
              )
            )}
          </div>
        </div>

        {isSelectionMode && selectedItems.length > 0 && (
          <BatchActionBar
            selectedCount={selectedItems.length}
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

  const hasScheduled = timedItems.length > 0;
  const hasUnscheduled = unscheduledItems.length > 0;

  if (!hasScheduled && !hasUnscheduled) {
    if (isFiltered) {
      return (
        <div className="py-12 text-center text-sm text-[#9f99a3]">
          {t("listControls.noItemsMatchFilters") as string}
        </div>
      );
    }
    return (
      <EmptyState
        icon={ListTodo}
        title={t("empty.list.title")}
        description={t("empty.list.description")}
        action={{ label: t("empty.createTask"), onClick: () => openComposer() }}
        secondaryAction={{ label: t("welcome.askAi"), icon: MessageCircle, onClick: () => ai.setExpandedState(true) }}
      />
    );
  }

  const gridCols = hasScheduled && hasUnscheduled
    ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    : "grid-cols-[minmax(0,1fr)]";

  return (
    <div className={`${isCompact ? "space-y-4" : "space-y-8"}`}>
      <div className={`grid gap-12 ${gridCols}`}>
        {hasScheduled && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold tracking-[0.2em] text-[#6f6a72] uppercase">
                  {t("listControls.scheduled")}
                </h2>
                <span className="text-xs text-[#9f99a3]">{timedItems.length}</span>
              </div>
            </div>
            <div className={`${isCompact ? "space-y-3" : "space-y-6"}`}>
              {timedGroups.map((group) => {
                const category = getDateCategory(group.date);
                const labelColor = DATE_LABEL_COLORS[category];
                return (
                  <div key={group.date.toISOString()}>
                    <h3
                      className={`${isCompact ? "mb-1" : "mb-2"} text-xs font-semibold tracking-[0.15em] uppercase`}
                      style={{ color: labelColor }}
                    >
                      {formatDayLabel(group.date)}
                    </h3>
                    <div className={`${isCompact ? "space-y-0.5" : "space-y-1"}`}>
                      {group.items.map((item) => (
                        <ListRow
                          key={`${item.id}:${item.occurrenceKey ?? "base"}`}
                          item={item}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedIds.has(getItemKey(item))}
                          onToggleSelect={toggleItemSelection}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasUnscheduled && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold tracking-[0.2em] text-[#6f6a72] uppercase">
                  {t("listControls.unscheduled")}
                </h2>
                <span className="text-xs text-[#9f99a3]">{unscheduledItems.length}</span>
              </div>
            </div>
            <div className={`${isCompact ? "space-y-0.5" : "space-y-1"}`}>
              {unscheduledItems.map((item) => (
                <ListRow
                  key={`${item.id}:${item.occurrenceKey ?? "base"}`}
                  item={item}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(getItemKey(item))}
                  onToggleSelect={toggleItemSelection}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {isSelectionMode && selectedItems.length > 0 && (
        <BatchActionBar
          selectedCount={selectedItems.length}
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

function groupItemsByPriority(items: DisplayItem[], priorityLabels: Record<string, string>) {
  const groups = new Map<string, { priority?: string; label: string; items: DisplayItem[] }>();

  const priorityOrder = ["urgent", "high", "medium", "low"];

  for (const item of items) {
    const p = item.priority ?? "none";
    if (!groups.has(p)) {
      groups.set(p, {
        priority: p,
        label: priorityLabels[p],
        items: [],
      });
    }
    groups.get(p)!.items.push(item);
  }

  const result: Array<{ priority?: string; label: string; items: DisplayItem[] }> = [];

  for (const p of priorityOrder) {
    const group = groups.get(p);
    if (group) {
      result.push(group);
    }
  }

  const noneGroup = groups.get("none");
  if (noneGroup) {
    result.push(noneGroup);
  }

  return result;
}
