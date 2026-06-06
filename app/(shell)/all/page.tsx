"use client";

import { useCallback, useEffect, useSyncExternalStore, useState, useMemo, useRef } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";

import { AiOverlay } from "@/components/ai/ai-overlay";
import { BatchPreviewItemRenderer } from "@/components/ai/batch-preview-item";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { SectionList } from "@/components/all-page/section-list";
import {
  getFilteredListItems,
  getListItemKey,
  ListView,
  filterSections,
} from "@/components/all-page/list-view";
import { ListControlsButton } from "@/components/all-page/list-controls-button";
import { TimelineFilterButton } from "@/components/all-page/timeline-filter-button";
import { CalendarView } from "@/components/all-page/calendar-view";
import { KanbanView } from "@/components/all-page/kanban/kanban-view";
import { useAuth } from "@/lib/auth/auth-provider";
import type { Section, ListFilterConfig, ListSortConfig } from "@/lib/types/all-page";
import type { AiBatchPreviewItem } from "@/lib/ai/chat-types";
import { toItemFromManualRecord, validateItemForm } from "@/lib/all-page-utils";
import { useI18n } from "@/lib/i18n";
import { AllPageSkeleton } from "@/components/ui/page-skeletons";


function subscribe() {
  return () => {};
}

function getSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function useMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getAvailableListTags(sections: Section[]) {
  const tags = new Set<string>();

  for (const section of sections) {
    for (const group of section.groups) {
      for (const item of group.items) {
        for (const tag of item.tags ?? []) {
          tags.add(tag);
        }
      }
    }
  }

  return Array.from(tags);
}

export default function AllPage() {
  const mounted = useMounted();
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const sections = useAllPageStore((s) => s.sections);
  const isComposerOpen = useAllPageStore((s) => s.isComposerOpen);
  const setSelectedItem = useAllPageStore((s) => s.setSelectedItem);
  const openComposerWithForm = useAllPageStore((s) => s.openComposerWithForm);
  const setComposerSubmitOverride = useAllPageStore((s) => s.setComposerSubmitOverride);
  const setTranslator = useAllPageStore((s) => s.setTranslator);
  const isLoaded = useAllPageStore((s) => s.isLoaded);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);
  const isSyncing = useAllPageStore((s) => s.isSyncing);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const listSortConfig = useAllPageStore((s) => s.listSortConfig);
  const setListSortConfig = useAllPageStore((s) => s.setListSortConfig);
  const listFilterConfig = useAllPageStore((s) => s.listFilterConfig);
  const setListFilterConfig = useAllPageStore((s) => s.setListFilterConfig);

  useEffect(() => {
    setTranslator(((key: string, values?: Record<string, string | number>) => t(key as Parameters<typeof t>[0], values)) as (key: string, values?: Record<string, string | number>) => string);
  }, [t, setTranslator]);

  const allDefaultView = useSettingsStore((s) => s.allDefaultView);
  // Subscribe to dateFormatRegion to trigger re-render when it changes
  const dateFormatRegion = useSettingsStore((s) => s.dateFormatRegion);
  void dateFormatRegion;
  const density = useSettingsStore((s) => s.density);
  const setDensity = useSettingsStore((s) => s.setDensity);
  const [viewMode, setViewModeState] = useState<"timeline" | "list" | "calendar" | "kanban">(allDefaultView);
  const setViewMode = useCallback((mode: "timeline" | "list" | "calendar" | "kanban") => {
    setViewModeState(mode);
  }, []);
  const setViewModeWithScroll = useCallback((mode: "timeline" | "list" | "calendar" | "kanban") => {
    setViewModeState(mode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const calendarNavigateRef = useRef<((direction: -1 | 1) => void) | null>(null);

  useKeyboardShortcuts([
    {
      key: "v",
      handler: () => {
        const order = ["timeline", "list", "calendar", "kanban"] as const;
        const currentIndex = order.indexOf(viewMode as typeof order[number]);
        const next = order[(currentIndex + 1) % order.length];
        setViewModeWithScroll(next);
      },
    },
    {
      key: "ArrowLeft",
      handler: () => {
        if (viewMode === "calendar") {
          calendarNavigateRef.current?.(-1);
        }
      },
    },
    {
      key: "ArrowRight",
      handler: () => {
        if (viewMode === "calendar") {
          calendarNavigateRef.current?.(1);
        }
      },
    },
  ]);
  const [isListSelectionMode, setIsListSelectionMode] = useState(false);
  const [listSelectedIds, setListSelectedIds] = useState<Set<string>>(new Set());
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [timelineFilterConfig, setTimelineFilterConfig] = useState<ListFilterConfig>({
    timePreset: "none",
    customStartDate: "",
    customEndDate: "",
    status: "all",
    selectedTags: [],
    tagMatchMode: "or",
    selectedPriorities: [],
  });

  const handleTimelineFilterChange = useCallback((update: Partial<ListFilterConfig>) => {
    if ("selectedTags" in update || "tagMatchMode" in update || "selectedPriorities" in update || "status" in update) {
      setListFilterConfig(update);
    } else {
      setTimelineFilterConfig((current) => ({ ...current, ...update }));
    }
  }, [setListFilterConfig]);

  const [kanbanFilterConfig, setKanbanFilterConfig] = useState<ListFilterConfig>({
    timePreset: "none",
    customStartDate: "",
    customEndDate: "",
    status: "all",
    selectedTags: [],
    tagMatchMode: "or",
    selectedPriorities: [],
  });
  const [kanbanSortConfig, setKanbanSortConfig] = useState<ListSortConfig>({
    mode: "time",
    timeDirection: "asc",
    allDayPreference: "allDayFirst",
    unscheduledSort: "newest",
    createdDirection: "desc",
    prioritySubField: "startTime",
    prioritySubDirection: "asc",
    prioritySchedulePreference: "scheduledFirst",
  });

  const handleKanbanFilterChange = useCallback((update: Partial<ListFilterConfig>) => {
    if ("selectedTags" in update || "tagMatchMode" in update || "selectedPriorities" in update) {
      setListFilterConfig(update);
    } else {
      setKanbanFilterConfig((current) => ({ ...current, ...update }));
    }
  }, [setListFilterConfig]);
  const handleKanbanSortChange = useCallback((update: Partial<ListSortConfig>) => {
    setKanbanSortConfig((current) => ({ ...current, ...update }));
  }, []);

  // Shared AI Chat context
  const ai = useAiChatContext();

  useEffect(() => {
    ai.setPageContext("all");
  }, [ai]);

  const projects = useProjectStore((s) => s.projects);

  const availableListTags = useMemo(
    () => getAvailableListTags(sections),
    [sections],
  );
  const effectiveTimelineFilter = useMemo(
    () => ({
      ...timelineFilterConfig,
      selectedTags: listFilterConfig.selectedTags,
      tagMatchMode: listFilterConfig.tagMatchMode,
      selectedPriorities: listFilterConfig.selectedPriorities,
      status: listFilterConfig.status,
    }),
    [timelineFilterConfig, listFilterConfig.selectedTags, listFilterConfig.tagMatchMode, listFilterConfig.selectedPriorities, listFilterConfig.status],
  );
  const effectiveKanbanFilter = useMemo(
    () => ({
      ...kanbanFilterConfig,
      selectedTags: listFilterConfig.selectedTags,
      tagMatchMode: listFilterConfig.tagMatchMode,
      selectedPriorities: listFilterConfig.selectedPriorities,
    }),
    [kanbanFilterConfig, listFilterConfig.selectedTags, listFilterConfig.tagMatchMode, listFilterConfig.selectedPriorities],
  );
  const filteredTimelineSections = useMemo(
    () => filterSections(sections, effectiveTimelineFilter),
    [sections, effectiveTimelineFilter],
  );
  const visibleListItemKeys = useMemo(
    () =>
      getFilteredListItems(sections, listFilterConfig).map((item) =>
        getListItemKey(item),
      ),
    [sections, listFilterConfig],
  );
  const allVisibleListItemsSelected =
    visibleListItemKeys.length > 0 &&
    visibleListItemKeys.every((key) => listSelectedIds.has(key));

  const clearListSelection = useCallback(() => {
    setIsListSelectionMode(false);
    setListSelectedIds(new Set());
  }, []);

  const toggleSelectAllVisibleListItems = useCallback(() => {
    const visibleKeys = new Set(visibleListItemKeys);

    if (allVisibleListItemsSelected) {
      setListSelectedIds(
        (current) => new Set([...current].filter((key) => !visibleKeys.has(key))),
      );
      return;
    }

    setListSelectedIds(
      (current) => new Set([...current, ...visibleListItemKeys]),
    );
  }, [allVisibleListItemsSelected, visibleListItemKeys]);

  useEffect(() => {
    let ticking = false;
    let lastScrollY = window.scrollY;
    let scrollDelta = 0;

    function handleScroll() {
      if (ticking) return;

      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const scrollThreshold = 200;
        const deadZone = 30;

        if (currentScrollY > scrollThreshold) {
          scrollDelta += lastScrollY - currentScrollY;

          if (scrollDelta > deadZone) {
            setShowStickyHeader(true);
            scrollDelta = deadZone;
          } else if (scrollDelta < -deadZone) {
            setShowStickyHeader(false);
            scrollDelta = -deadZone;
          }
        } else {
          setShowStickyHeader(false);
          scrollDelta = 0;
        }

        lastScrollY = currentScrollY;
        ticking = false;
      });

      ticking = true;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load items from Supabase when user is available
  useEffect(() => {
    if (user && !isLoaded) {
      loadItemsFromCloud(user.id);
    }
  }, [user, isLoaded, loadItemsFromCloud]);

  function handleEditBatchPreview(index: number) {
    if (ai.aiLoading) return;

    const draft = ai.aiBatchPreview[index];
    if (!draft) return;
    if (draft.kind === "delete") return;

    setComposerSubmitOverride((form) => {
      const validationError = validateItemForm(form, ((key: string, values?: Record<string, string | number>) => t(key as Parameters<typeof t>[0], values)) as (key: string, values?: Record<string, string | number>) => string);
      if (validationError) {
        return validationError;
      }

      ai.setAiBatchPreview((current) => {
        const next = current.map((item, i) => (i === index ? { ...item, formState: form } : item));
        return next;
      });

      return null;
    });

    if (draft.kind === "update" && draft.targetItemId) {
      const targetRecord = manualItems.find((record) => record.id === draft.targetItemId);
      if (targetRecord) {
        openComposerWithForm(draft.formState, toItemFromManualRecord(targetRecord));
      }
    } else {
      openComposerWithForm(draft.formState);
    }

    if (!ai.isFullscreen) ai.setExpandedState(false);
  }

  function handleToggleBatchPreviewSelection(index: number, selected: boolean) {
    ai.setAiBatchPreview((current) => current.map((item, i) => i === index ? { ...item, selected } : item));
  }

  function renderAiBatchPreviewItem(item: AiBatchPreviewItem, index: number) {
    return (
      <BatchPreviewItemRenderer
        key={item.id}
        item={item}
        index={index}
        projects={projects}
        onToggleSelection={handleToggleBatchPreviewSelection}
        onEdit={handleEditBatchPreview}
        isFullscreen={ai.isFullscreen}
      />
    );
  }

  if (!mounted || authLoading || (isSyncing && !isLoaded)) {
    return <AllPageSkeleton />;
  }

  return (
    <section
      className="min-h-screen bg-[#fcfbfa] px-8 py-8 text-[#2b2a30] transition-[padding] duration-300 ease-in-out sm:px-14 lg:py-12 lg:pr-14 lg:pl-14 group-data-[sidebar-collapsed=true]/sidebar:lg:pr-24 group-data-[sidebar-collapsed=true]/sidebar:lg:pl-32"
      onClick={() => {
        if (isComposerOpen) {
          return;
        }

        setSelectedItem(null);
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-18">
        <header className="grid gap-4 border-b border-black/6 pb-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="max-w-4xl">
            <h1 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.1] font-semibold tracking-[-0.02em] text-[#25242a]">
              {t("nav.all")}
            </h1>
          </div>
        </header>

        <div className={`-mt-8 mb-[-3.5rem] flex flex-col gap-7 lg:mb-0 lg:flex-row lg:items-center lg:justify-between lg:gap-3 px-2 lg:px-3 ${
          showStickyHeader && viewMode !== "calendar" && viewMode !== "kanban" ? "sticky top-3 z-30 mx-auto -mb-3 w-fit max-w-[calc(100%-1.5rem)] rounded-2xl px-2 py-1.5 gap-3 lg:rounded-full lg:mx-0 lg:w-auto lg:max-w-none lg:-mb-4 lg:px-3 lg:py-2 lg:gap-3" : ""
        }`}>
          {showStickyHeader && viewMode !== "calendar" && viewMode !== "kanban" && (
            <div
              className="absolute inset-0 -z-10 rounded-2xl border border-black/8 dark:border-white/10 shadow-lg bg-white/55 dark:bg-[#1e1e1e]/70 lg:rounded-full"
              style={{
                backdropFilter: "blur(18px) saturate(140%)",
                WebkitBackdropFilter: "blur(18px) saturate(140%)",
              }}
            />
          )}
          <div className="flex items-center justify-center gap-3 lg:justify-start">
            <div className="relative grid grid-cols-4 rounded-full border border-black/8 dark:border-white/10 bg-[#f4f0ec]/[0.5] dark:bg-[#2a2a2a] p-0.5">
              {/* Sliding background */}
              <div
                className="absolute top-0.5 bottom-0.5 rounded-full bg-[#ffffff] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#d4d4d4]"
                style={{
                  left: `calc(2px + ${viewMode === "timeline" ? 0 : viewMode === "list" ? 1 : viewMode === "calendar" ? 2 : 3} * (100% - 4px) / 4)`,
                  width: "calc((100% - 4px) / 4)",
                }}
              />
              <button
                type="button"
                onClick={() => (showStickyHeader ? setViewModeWithScroll : setViewMode)("timeline")}
                className={`relative z-10 flex cursor-pointer items-center justify-center rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                  viewMode === "timeline"
                    ? "text-[#1a1a1a] dark:text-[#000000]"
                    : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                }`}
              >
                {t("settings.view.timeline")}
              </button>
              <button
                type="button"
                onClick={() => (showStickyHeader ? setViewModeWithScroll : setViewMode)("list")}
                className={`relative z-10 flex cursor-pointer items-center justify-center rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                  viewMode === "list"
                    ? "text-[#1a1a1a] dark:text-[#000000]"
                    : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                }`}
              >
                {t("settings.view.list")}
              </button>
              <button
                type="button"
                onClick={() => (showStickyHeader ? setViewModeWithScroll : setViewMode)("calendar")}
                className={`relative z-10 flex cursor-pointer items-center justify-center rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                  viewMode === "calendar"
                    ? "text-[#1a1a1a] dark:text-[#000000]"
                    : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                }`}
              >
                {t("settings.view.calendar")}
              </button>
              <button
                type="button"
                onClick={() => (showStickyHeader ? setViewModeWithScroll : setViewMode)("kanban")}
                className={`relative z-10 flex cursor-pointer items-center justify-center rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                  viewMode === "kanban"
                    ? "text-[#1a1a1a] dark:text-[#000000]"
                    : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                }`}
              >
                {t("settings.view.kanban")}
              </button>
            </div>
            {showStickyHeader && viewMode !== "calendar" && viewMode !== "kanban" && (
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="shrink-0 cursor-pointer items-center rounded-full border border-black/8 dark:border-white/10 bg-[#f4f0ec]/50 dark:bg-white/8 px-3 py-1.5 text-xs font-medium tracking-wide text-[#7d7880] dark:text-[#a3a3a3] transition-colors hover:text-[#25242a] dark:hover:text-[#f5f5f5] flex"
              >
                {t("common.backToTop")}
              </button>
            )}
          </div>
          <div className="flex justify-center lg:justify-end gap-2">
            {viewMode !== "calendar" && viewMode !== "list" && (
              <button
                type="button"
                onClick={() => setDensity(density === "compact" ? "default" : "compact")}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-[#f4f0ec]/50 px-4 py-1.5 text-xs font-medium tracking-wide text-[#7d7880] transition-colors hover:text-[#5f5a63] dark:border-white/8 dark:bg-white/8 dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                title={density === "compact" ? t("settings.density.default") : t("settings.density.compact")}
              >
                {density === "compact" ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
                {density === "compact" ? t("settings.density.compact") : t("settings.density.default")}
              </button>
            )}
            {viewMode === "list" && (
              <>
                {isListSelectionMode ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleSelectAllVisibleListItems}
                      disabled={visibleListItemKeys.length === 0}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-white px-4 py-1.5 text-xs font-medium tracking-wide text-[#7d7880] transition-colors hover:text-[#25242a] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {allVisibleListItemsSelected ? t("common.deselectAll") : t("ai.selectAll")}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (isListSelectionMode) {
                      clearListSelection();
                      return;
                    }
                    setIsListSelectionMode(true);
                  }}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                    isListSelectionMode
                      ? "border-black/12 bg-white text-[#25242a] shadow-sm"
                      : "border-black/8 bg-[#f4f0ec]/50 text-[#7d7880] hover:text-[#5f5a63]"
                  }`}
                >
                  {isListSelectionMode ? t("common.cancel") : t("listControls.select")}
                </button>
                <button
                  type="button"
                  onClick={() => setDensity(density === "compact" ? "default" : "compact")}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-[#f4f0ec]/50 px-4 py-1.5 text-xs font-medium tracking-wide text-[#7d7880] transition-colors hover:text-[#5f5a63] dark:border-white/8 dark:bg-white/8 dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                  title={density === "compact" ? t("settings.density.default") : t("settings.density.compact")}
                >
                  {density === "compact" ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                  {density === "compact" ? t("settings.density.compact") : t("settings.density.default")}
                </button>
                <ListControlsButton
                  filterConfig={listFilterConfig}
                  sortConfig={listSortConfig}
                  availableTags={availableListTags}
                  onFilterChange={setListFilterConfig}
                  onSortChange={setListSortConfig}
                />
              </>
            )}
            {viewMode === "timeline" && (
              <TimelineFilterButton
                filterConfig={effectiveTimelineFilter}
                availableTags={availableListTags}
                onFilterChange={handleTimelineFilterChange}
              />
            )}
            {viewMode === "calendar" && (
              <TimelineFilterButton
                filterConfig={listFilterConfig}
                availableTags={availableListTags}
                onFilterChange={setListFilterConfig}
                showTimeFilter={false}
                title="Calendar Filter"
                compact
              />
            )}
            {viewMode === "kanban" && (
              <ListControlsButton
                filterConfig={effectiveKanbanFilter}
                sortConfig={kanbanSortConfig}
                availableTags={availableListTags}
                onFilterChange={handleKanbanFilterChange}
                onSortChange={handleKanbanSortChange}
                mode="kanban"
              />
            )}
          </div>
        </div>

        {viewMode === "timeline" ? (
          <SectionList
            sections={filteredTimelineSections}
            onSwitchToList={() => {
              setViewMode("list");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        ) : viewMode === "list" ? (
          <ListView
            sections={sections}
            sortConfig={listSortConfig}
            filterConfig={listFilterConfig}
            isSelectionMode={isListSelectionMode}
            selectedIds={listSelectedIds}
            onSelectionModeChange={setIsListSelectionMode}
            onSelectedIdsChange={setListSelectedIds}
          />
        ) : viewMode === "kanban" ? (
          <KanbanView
            sections={sections}
            filterConfig={effectiveKanbanFilter}
            sortConfig={kanbanSortConfig}
          />
        ) : (
          <CalendarView
            sections={sections}
            filterConfig={listFilterConfig}
            onNavigateRef={calendarNavigateRef}
          />
        )}
      </div>

      <AiOverlay
        ai={ai}
        renderAiBatchPreviewItem={renderAiBatchPreviewItem}
        quickPrompts={[t("ai.prompt.addTask"), t("ai.prompt.updateSelected"), t("ai.prompt.planWeek"), t("ai.prompt.review"), t("ai.prompt.search"), t("ai.prompt.overdue")]}
      />
    </section>
  );
}
