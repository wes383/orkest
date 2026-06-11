"use client";

import { useCallback, useEffect, useSyncExternalStore, useState, useMemo, useRef } from "react";
import { Maximize2, Minimize2, Clock, List, Calendar, LayoutGrid, Table2, ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
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
import { CalendarView } from "@/components/all-page/calendar-view";
import { KanbanView } from "@/components/all-page/kanban/kanban-view";
import { TableView } from "@/components/all-page/table/table-view";
import { useAuth } from "@/lib/auth/auth-provider";
import type { Section, ListFilterConfig, ListSortConfig } from "@/lib/types/all-page";
import type { AiBatchPreviewItem } from "@/lib/ai/chat-types";
import { toItemFromManualRecord, validateItemForm } from "@/lib/all-page-utils";
import { useI18n } from "@/lib/i18n";
import { AllPageSkeleton } from "@/components/ui/page-skeletons";
import { AllPageSearch } from "@/components/all-page/all-page-search";
import { FilterBar } from "@/components/all-page/filter-bar";


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

  // Scroll-to-item from Command Palette
  const [hiddenItemId, setHiddenItemId] = useState<string | null>(null);

  const highlightAndScroll = useCallback((el: Element) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[#6d6770]", "dark:ring-[#a3a3a3]", "rounded-2xl");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-[#6d6770]", "dark:ring-[#a3a3a3]", "rounded-2xl");
    }, 2000);
  }, []);

  const clearListFilters = useCallback(() => {
    setListFilterConfig({
      status: "all",
      selectedTags: [],
      selectedPriorities: [],
      selectedProjectIds: [],
      searchQuery: "",
      timePreset: "none",
    });
  }, [setListFilterConfig]);

  const clearFiltersAndScrollTo = useCallback((itemId: string) => {
    clearListFilters();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-item-id="${itemId}"]`);
        if (el) highlightAndScroll(el);
      });
    });
  }, [clearListFilters, highlightAndScroll]);

  useEffect(() => {
    const handler = (e: Event) => {
      const itemId = (e as CustomEvent<{ itemId: string }>).detail?.itemId;
      if (!itemId) return;

      // Always switch to List view first
      setViewModeState("list");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-item-id="${itemId}"]`);
          if (el) {
            highlightAndScroll(el);
          } else {
            // Item hidden by filters — show toast
            setHiddenItemId(itemId);
          }
        });
      });
    };
    window.addEventListener("orkest:scroll-to-item", handler);
    return () => window.removeEventListener("orkest:scroll-to-item", handler);
  }, [highlightAndScroll, setListFilterConfig]);

  // Auto-dismiss the toast after 6 seconds
  useEffect(() => {
    if (!hiddenItemId) return;
    const timer = setTimeout(() => setHiddenItemId(null), 10000);
    return () => clearTimeout(timer);
  }, [hiddenItemId]);

  const allDefaultView = useSettingsStore((s) => s.allDefaultView);
  // Subscribe to dateFormatRegion to trigger re-render when it changes
  const dateFormatRegion = useSettingsStore((s) => s.dateFormatRegion);
  void dateFormatRegion;
  const density = useSettingsStore((s) => s.density);
  const setDensity = useSettingsStore((s) => s.setDensity);
  const [viewMode, setViewModeState] = useState<"timeline" | "list" | "calendar" | "kanban" | "table">(allDefaultView);
  const setViewMode = useCallback((mode: "timeline" | "list" | "calendar" | "kanban" | "table") => {
    setViewModeState(mode);
  }, []);
  const setViewModeWithScroll = useCallback((mode: "timeline" | "list" | "calendar" | "kanban" | "table") => {
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
  const [isHeaderWrapped, setIsHeaderWrapped] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [timelineFilterConfig, setTimelineFilterConfig] = useState<ListFilterConfig>({
    timePreset: "none",
    customStartDate: "",
    customEndDate: "",
    status: "all",
    selectedTags: [],
    tagMatchMode: "or",
    selectedPriorities: [],
    selectedProjectIds: [],
    searchQuery: "",
  });

  const handleTimelineFilterChange = useCallback((update: Partial<ListFilterConfig>) => {
    if (
      "selectedTags" in update ||
      "tagMatchMode" in update ||
      "selectedPriorities" in update ||
      "status" in update ||
      "selectedProjectIds" in update
    ) {
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
    selectedProjectIds: [],
    searchQuery: "",
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
    if (
      "selectedTags" in update ||
      "tagMatchMode" in update ||
      "selectedPriorities" in update ||
      "selectedProjectIds" in update
    ) {
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

  // Sync URL ?project= with listFilterConfig.selectedProjectIds
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!searchParams) return;
    const projectId = searchParams.get("project");
    const current = listFilterConfig.selectedProjectIds ?? [];
    if (projectId && (current.length !== 1 || current[0] !== projectId)) {
      setListFilterConfig({ selectedProjectIds: [projectId] });
    } else if (!projectId && current.length > 0) {
      setListFilterConfig({ selectedProjectIds: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      searchQuery: listFilterConfig.searchQuery,
      selectedProjectIds: listFilterConfig.selectedProjectIds,
    }),
    [
      timelineFilterConfig,
      listFilterConfig.selectedTags,
      listFilterConfig.tagMatchMode,
      listFilterConfig.selectedPriorities,
      listFilterConfig.status,
      listFilterConfig.searchQuery,
      listFilterConfig.selectedProjectIds,
    ],
  );
  const effectiveKanbanFilter = useMemo(
    () => ({
      ...kanbanFilterConfig,
      selectedTags: listFilterConfig.selectedTags,
      tagMatchMode: listFilterConfig.tagMatchMode,
      selectedPriorities: listFilterConfig.selectedPriorities,
      searchQuery: listFilterConfig.searchQuery,
      selectedProjectIds: listFilterConfig.selectedProjectIds,
    }),
    [
      kanbanFilterConfig,
      listFilterConfig.selectedTags,
      listFilterConfig.tagMatchMode,
      listFilterConfig.selectedPriorities,
      listFilterConfig.searchQuery,
      listFilterConfig.selectedProjectIds,
    ],
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

  // Close view dropdown when clicking outside
  useEffect(() => {
    if (!viewDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setViewDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [viewDropdownOpen]);

  // Monitor header height and layout to detect wrapping
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const leftGroup = el.querySelector(".lg\\:justify-start");
        const rightGroup = el.querySelector(".lg\\:justify-end");
        if (leftGroup && rightGroup) {
          const leftRect = leftGroup.getBoundingClientRect();
          const rightRect = rightGroup.getBoundingClientRect();
          // If the top of the right group is below the left group, it means they wrapped
          setIsHeaderWrapped(rightRect.top > leftRect.top + 10);
        } else {
          // Fallback to height threshold
          const height = entry.contentRect.height;
          setIsHeaderWrapped(height > 45);
        }
      }
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [showStickyHeader, viewMode]);

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

        <div
          ref={headerRef}
          className={`-mt-4 mb-[-3.5rem] flex flex-col gap-7 lg:mb-0 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:gap-y-4 px-2 lg:px-3 ${
            showStickyHeader && viewMode !== "calendar" && viewMode !== "kanban"
              ? `sticky top-3 z-30 mx-auto -mb-3 w-fit max-w-[calc(100%-1.5rem)] rounded-2xl px-2 py-1.5 gap-3 lg:mx-0 lg:w-auto lg:max-w-none lg:-mb-4 lg:px-3 lg:py-2 lg:gap-3 ${
                  isHeaderWrapped ? "lg:rounded-2xl" : "lg:rounded-full"
                }`
              : ""
          }`}
        >
          {showStickyHeader && viewMode !== "calendar" && viewMode !== "kanban" && (
            <div
              className={`absolute inset-0 -z-10 rounded-2xl border border-black/8 dark:border-white/10 shadow-lg bg-white/55 dark:bg-[#1e1e1e]/70 ${
                isHeaderWrapped ? "lg:rounded-2xl" : "lg:rounded-full"
              }`}
              style={{
                backdropFilter: "blur(18px) saturate(140%)",
                WebkitBackdropFilter: "blur(18px) saturate(140%)",
              }}
            />
          )}
          <div className="flex items-center justify-center gap-2 lg:justify-start">
            <div ref={viewDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
                className="flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-black/8 dark:border-white/10 bg-[#f4f0ec]/[0.5] dark:bg-[#2a2a2a] px-4 text-xs font-medium tracking-wide text-[#525059] dark:text-[#d4d4d4] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                {viewMode === "timeline" && <Clock className="h-3.5 w-3.5" />}
                {viewMode === "list" && <List className="h-3.5 w-3.5" />}
                {viewMode === "calendar" && <Calendar className="h-3.5 w-3.5" />}
                {viewMode === "kanban" && <LayoutGrid className="h-3.5 w-3.5" />}
                {viewMode === "table" && <Table2 className="h-3.5 w-3.5" />}
                {t(`settings.view.${viewMode}`)}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${viewDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {viewDropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#202020] p-1.5 shadow-[0_20px_45px_rgba(28,24,35,0.10)] dark:shadow-[0_20px_45px_rgba(0,0,0,0.45)]">
                  <div className="space-y-0.5">
                    {([
                      { key: "timeline", icon: Clock },
                      { key: "list", icon: List },
                      { key: "calendar", icon: Calendar },
                      { key: "kanban", icon: LayoutGrid },
                      { key: "table", icon: Table2 },
                    ] as const).map(({ key, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          (showStickyHeader ? setViewModeWithScroll : setViewMode)(key);
                          setViewDropdownOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                          viewMode === key
                            ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
                            : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t(`settings.view.${key}`)}
                      </button>
                    ))}
                  </div>
                  <div className="my-1 border-t border-black/8 dark:border-white/10" />
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDensity("default");
                        setViewDropdownOpen(false);
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                        density === "default"
                          ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
                          : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      {t("settings.density.default")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDensity("compact");
                        setViewDropdownOpen(false);
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                        density === "compact"
                          ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
                          : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      <Minimize2 className="h-3.5 w-3.5" />
                      {t("settings.density.compact")}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="lg:hidden flex items-center gap-2">
              {viewMode === "list" && (
                <>
                  {isListSelectionMode ? (
                    <button
                      type="button"
                      onClick={toggleSelectAllVisibleListItems}
                      disabled={visibleListItemKeys.length === 0}
                      className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-black/8 bg-white px-3 py-1.5 text-[11px] font-medium tracking-wide text-[#7d7880] transition-colors hover:text-[#25242a] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {allVisibleListItemsSelected ? t("common.deselectAll") : t("ai.selectAll")}
                    </button>
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
                    className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors ${
                      isListSelectionMode
                        ? "border-black/12 bg-white text-[#25242a] shadow-sm"
                        : "border-black/8 bg-[#f4f0ec]/50 text-[#7d7880] hover:text-[#5f5a63]"
                    }`}
                  >
                    {isListSelectionMode ? t("common.cancel") : t("listControls.select")}
                  </button>
                </>
              )}
              <AllPageSearch />
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
          <div className="hidden lg:flex items-center justify-end gap-2 shrink-0">
            {viewMode === "list" && (
              <>
                {isListSelectionMode ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleSelectAllVisibleListItems}
                      disabled={visibleListItemKeys.length === 0}
                      className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-black/8 bg-white px-4 py-1.5 text-xs font-medium tracking-wide text-[#7d7880] transition-colors hover:text-[#25242a] disabled:cursor-not-allowed disabled:opacity-45"
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
                  className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                    isListSelectionMode
                      ? "border-black/12 bg-white text-[#25242a] shadow-sm"
                      : "border-black/8 bg-[#f4f0ec]/50 text-[#7d7880] hover:text-[#5f5a63]"
                  }`}
                >
                  {isListSelectionMode ? t("common.cancel") : t("listControls.select")}
                </button>
              </>
            )}
            <AllPageSearch />
          </div>
        </div>

        <div className="px-2 lg:px-3 -mt-2 lg:-mt-10 -mb-4">
          <FilterBar
            filterConfig={listFilterConfig}
            onFilterChange={setListFilterConfig}
            sortConfig={listSortConfig}
            onSortChange={setListSortConfig}
            projects={projects}
            availableTags={availableListTags}
            viewMode={viewMode}
          />
        </div>

        {(() => {
          if (viewMode === "timeline") {
            return (
              <SectionList
                sections={filteredTimelineSections}
                onSwitchToList={() => {
                  setViewMode("list");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            );
          }
          if (viewMode === "list") {
            return (
              <ListView
                sections={sections}
                sortConfig={listSortConfig}
                filterConfig={listFilterConfig}
                isSelectionMode={isListSelectionMode}
                selectedIds={listSelectedIds}
                onSelectionModeChange={setIsListSelectionMode}
                onSelectedIdsChange={setListSelectedIds}
              />
            );
          }
          if (viewMode === "kanban") {
            return (
              <KanbanView
                sections={sections}
                filterConfig={effectiveKanbanFilter}
                sortConfig={kanbanSortConfig}
              />
            );
          }
          if (viewMode === "table") {
            return (
              <TableView
                sections={sections}
                filterConfig={listFilterConfig}
                selectedIds={listSelectedIds}
                onSelectedIdsChange={setListSelectedIds}
                onClearFilters={clearListFilters}
              />
            );
          }
          return (
            <CalendarView
              sections={sections}
              filterConfig={listFilterConfig}
              onNavigateRef={calendarNavigateRef}
            />
          );
        })()}
      </div>

      <AiOverlay
        ai={ai}
        renderAiBatchPreviewItem={renderAiBatchPreviewItem}
        quickPrompts={[t("ai.prompt.addTask"), t("ai.prompt.updateSelected"), t("ai.prompt.planWeek"), t("ai.prompt.review"), t("ai.prompt.search"), t("ai.prompt.overdue")]}
      />

      {/* Toast: task hidden by filters */}
      {hiddenItemId && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm shadow-lg dark:border-white/10 dark:bg-[#1e1e1e]">
            <span className="text-[#6d6770] dark:text-[#a3a3a3]">{t("all.hiddenByFilter")}</span>
            <button
              onClick={() => {
                clearFiltersAndScrollTo(hiddenItemId);
                setHiddenItemId(null);
              }}
              className="shrink-0 cursor-pointer rounded-full bg-[#25242a] px-3 py-1 text-xs font-medium text-white hover:bg-[#3a3940] dark:bg-[#f5f5f5] dark:text-[#101010] dark:hover:bg-[#e0e0e0]"
            >
              {t("common.clearFilters")}
            </button>
            <button
              onClick={() => setHiddenItemId(null)}
              className="shrink-0 cursor-pointer rounded-full px-2 py-1 text-xs text-[#9b95a0] hover:bg-black/5 hover:text-[#6d6770] dark:hover:bg-white/10 dark:hover:text-[#a3a3a3]"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
