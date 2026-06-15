"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Clock, Tag, Folder, CheckCircle, Flag, X, ChevronDown, Check, Filter, ArrowUpDown, CalendarClock, ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { PRIORITY_CONFIG } from "@/lib/all-page-utils";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { computeProjectsWithStats, sortProjectsWithStats } from "@/lib/projects/project-stats";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import type { ListFilterConfig, ListSortConfig, ListTimeFilterPreset, PriorityFilterValue } from "@/lib/types/all-page";
import type { Project } from "@/lib/types/item";

interface FilterBarProps {
  filterConfig: ListFilterConfig;
  onFilterChange: (update: Partial<ListFilterConfig>) => void;
  sortConfig?: ListSortConfig;
  onSortChange?: (update: Partial<ListSortConfig>) => void;
  projects: Project[];
  availableTags: string[];
  viewMode: "timeline" | "list" | "calendar" | "kanban" | "table";
  isListSelectionMode?: boolean;
  onToggleSelectMode?: () => void;
  onToggleSelectAll?: () => void;
  onSelectAllLabel?: string;
  allSelected?: boolean;
  selectionDisabled?: boolean;
}

function FilterDropdown({
  label,
  icon: Icon,
  value,
  children,
  onClear,
  align = "left",
}: {
  label: string;
  icon: React.ElementType;
  value?: string;
  children: (close: () => void) => React.ReactNode;
  onClear?: () => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState<{ left?: number; right?: number }>({});
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // After the menu mounts, clamp its position so it never extends past the
  // viewport edges. Without this, a right-aligned menu attached to a button
  // on the left side of a narrow viewport would overflow off-screen.
  useEffect(() => {
    if (!open) {
      setOffset({});
      return;
    }
    const menu = menuRef.current;
    if (!menu) return;

    function clamp() {
      const menuEl = menuRef.current;
      const parentEl = ref.current;
      if (!menuEl || !parentEl) return;
      const rect = menuEl.getBoundingClientRect();
      const parentRect = parentEl.getBoundingClientRect();
      const margin = 8;
      const viewportWidth = window.innerWidth;
      const next: { left?: number; right?: number } = {};
      if (rect.left < margin) {
        next.left = margin - parentRect.left;
      }
      if (rect.right > viewportWidth - margin) {
        next.right = parentRect.right - (viewportWidth - margin);
      }
      setOffset(next);
    }

    clamp();
    window.addEventListener("resize", clamp);
    window.addEventListener("scroll", clamp, true);
    return () => {
      window.removeEventListener("resize", clamp);
      window.removeEventListener("scroll", clamp, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
          value
            ? "border-black/12 bg-white text-[#25242a] dark:border-white/12 dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"
            : "border-black/8 bg-transparent text-[#7d7880] hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]"
        )}
      >
        <Icon className="h-3 w-3" />
        <span className="max-w-[6rem] truncate">{value || label}</span>
        {value && onClear ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        ) : (
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        )}
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{
            ...(offset.left !== undefined ? { left: offset.left } : null),
            ...(offset.right !== undefined ? { right: offset.right } : null),
          }}
          className={cn(
            "absolute top-full z-50 mt-1 min-w-[12rem] rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#202020] p-1.5 shadow-[0_20px_45px_rgba(28,24,35,0.10)] dark:shadow-[0_20px_45px_rgba(0,0,0,0.45)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  filterConfig,
  onFilterChange,
  sortConfig,
  onSortChange,
  projects,
  availableTags,
  viewMode,
  isListSelectionMode,
  onToggleSelectMode,
  onToggleSelectAll,
  onSelectAllLabel,
  allSelected,
  selectionDisabled,
}: FilterBarProps) {
  const { t } = useI18n();
  const sortMode = useProjectStore((s) => s.sortMode);
  const manualItems = useAllPageStore((s) => s.manualItems);

  const showTimeFilter = viewMode !== "calendar" && viewMode !== "kanban";
  const showStatusFilter = viewMode !== "kanban";
  const showSort = viewMode === "list" || viewMode === "kanban";

  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [mobileExpandedSections, setMobileExpandedSections] = useState<Set<string>>(new Set());

  const toggleMobileSection = (key: string) => {
    setMobileExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Lock body scroll when mobile modal is open
  useEffect(() => {
    if (!mobileModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileModalOpen]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterConfig.selectedProjectIds?.length) count++;
    if (filterConfig.timePreset !== "none") count++;
    if (filterConfig.selectedTags?.length) count++;
    if (filterConfig.status !== "all") count++;
    if (filterConfig.selectedPriorities?.length) count++;
    return count;
  }, [filterConfig]);

  const sortedProjects = useMemo(() => {
    const withStats = computeProjectsWithStats(projects, manualItems);
    return sortProjectsWithStats(withStats, sortMode);
  }, [projects, manualItems, sortMode]);

  const TIME_OPTIONS: Array<{ value: ListTimeFilterPreset; label: string }> = [
    { value: "today", label: t("listControls.today") },
    { value: "tomorrow", label: t("listControls.tomorrow") },
    { value: "week", label: t("listControls.thisWeek") },
    { value: "month", label: t("listControls.thisMonth") },
    { value: "custom", label: t("listControls.custom") },
  ];

  const STATUS_OPTIONS = [
    { value: "all" as const, label: t("listControls.all") },
    { value: "active" as const, label: t("listControls.active") },
    { value: "completed" as const, label: t("listControls.completed") },
  ];

  const PRIORITY_OPTIONS: Array<{ value: PriorityFilterValue; label: string }> = [
    { value: "urgent", label: t("listControls.urgent") },
    { value: "high", label: t("listControls.high") },
    { value: "medium", label: t("listControls.medium") },
    { value: "low", label: t("listControls.low") },
    { value: "none", label: t("listControls.noPriority") },
  ];

  const SORT_OPTIONS = [
    { value: "time" as const, label: t("listControls.date") },
    { value: "created" as const, label: t("listControls.created") },
    { value: "priority" as const, label: t("listControls.byPriority") },
  ];

  const sortedTags = useMemo(
    () => [...availableTags].sort((a, b) => a.localeCompare(b)),
    [availableTags],
  );

  const timeLabel = filterConfig.timePreset !== "none"
    ? filterConfig.timePreset === "custom"
      ? `${filterConfig.customStartDate} - ${filterConfig.customEndDate}`
      : TIME_OPTIONS.find((o) => o.value === filterConfig.timePreset)?.label
    : undefined;

  const statusLabel = filterConfig.status !== "all"
    ? STATUS_OPTIONS.find((o) => o.value === filterConfig.status)?.label
    : undefined;

  const projectLabel = filterConfig.selectedProjectIds && filterConfig.selectedProjectIds.length > 0
    ? filterConfig.selectedProjectIds.length === 1
      ? projects.find((p) => p.id === filterConfig.selectedProjectIds[0])?.name
      : `${filterConfig.selectedProjectIds.length} projects`
    : undefined;

  const priorityLabel = filterConfig.selectedPriorities && filterConfig.selectedPriorities.length > 0
    ? filterConfig.selectedPriorities.length === 1
      ? PRIORITY_OPTIONS.find((o) => o.value === filterConfig.selectedPriorities[0])?.label
      : `${filterConfig.selectedPriorities.length} priorities`
    : undefined;

  const tagLabel = filterConfig.selectedTags && filterConfig.selectedTags.length > 0
    ? filterConfig.selectedTags.length === 1
      ? `#${filterConfig.selectedTags[0]}`
      : `${filterConfig.selectedTags.length} tags`
    : undefined;

  const sortLabel = viewMode === "kanban"
    ? sortConfig?.unscheduledSort === "newest"
      ? t("listControls.newestFirst")
      : sortConfig?.unscheduledSort === "oldest"
        ? t("listControls.oldestFirst")
        : t("itemForm.priority")
    : sortConfig
      ? SORT_OPTIONS.find((o) => o.value === sortConfig.mode)?.label
      : undefined;

  const SortIcon = viewMode === "kanban"
    ? sortConfig?.unscheduledSort === "newest"
      ? ArrowDown
      : sortConfig?.unscheduledSort === "oldest"
        ? ArrowUp
        : Flag
    : sortConfig?.mode === "time"
      ? Clock
      : sortConfig?.mode === "created"
        ? CalendarClock
        : Flag;

  // ── Render helpers (shared between desktop dropdowns and mobile modal) ──

  const renderProjectOptions = (close: () => void) => (
    <div className="max-h-64 overflow-y-auto scrollbar-transparent-track space-y-0.5">
      <button
        type="button"
        onClick={() => { onFilterChange({ selectedProjectIds: [] }); close(); }}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
          !filterConfig.selectedProjectIds?.length
            ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
            : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        )}
      >
        {t("listControls.allProjects")}
        {!filterConfig.selectedProjectIds?.length && <Check className="h-3.5 w-3.5" />}
      </button>
      {sortedProjects.map((project) => {
        const selected = filterConfig.selectedProjectIds?.includes(project.id);
        return (
          <button
            key={project.id}
            type="button"
            onClick={() => { onFilterChange({ selectedProjectIds: selected ? [] : [project.id] }); close(); }}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
              selected
                ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
                : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color ?? "#a3a3a3" }} />
            <span className="flex-1 text-left truncate">{project.name}</span>
            {selected && <Check className="h-3.5 w-3.5" />}
          </button>
        );
      })}
    </div>
  );

  const renderTimeOptions = (close: () => void) => (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => { onFilterChange({ timePreset: "none", customStartDate: "", customEndDate: "" }); close(); }}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
          filterConfig.timePreset === "none"
            ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
            : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        )}
      >
        {t("listControls.anyTime")}
        {filterConfig.timePreset === "none" && <Check className="h-3.5 w-3.5" />}
      </button>
      {TIME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            if (option.value === "custom") {
              onFilterChange({ timePreset: "custom" });
            } else {
              onFilterChange({ timePreset: option.value, customStartDate: "", customEndDate: "" });
              close();
            }
          }}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
            filterConfig.timePreset === option.value
              ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
              : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          )}
        >
          {option.label}
          {filterConfig.timePreset === option.value && <Check className="h-3.5 w-3.5" />}
        </button>
      ))}
      {filterConfig.timePreset === "custom" && (
        <div className="space-y-2 px-3 pt-2 pb-1">
          <div>
            <label className="text-[10px] text-[#9f99a3] mb-1 block">{t("listControls.from")}</label>
            <Input type="date" value={filterConfig.customStartDate} onChange={(e) => onFilterChange({ customStartDate: e.target.value })} className="h-7 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-[#9f99a3] mb-1 block">{t("listControls.to")}</label>
            <Input type="date" value={filterConfig.customEndDate} onChange={(e) => onFilterChange({ customEndDate: e.target.value })} className="h-7 text-xs" />
          </div>
          <button
            type="button"
            onClick={() => close()}
            disabled={!filterConfig.customStartDate || !filterConfig.customEndDate}
            className="w-full rounded-lg bg-[#25242a] dark:bg-[#f5f5f5] px-3 py-1.5 text-xs font-medium text-white dark:text-[#111111] disabled:opacity-50"
          >
            {t("common.apply")}
          </button>
        </div>
      )}
    </div>
  );

  const renderTagOptions = () => (
    <div className="max-h-64 overflow-y-auto scrollbar-transparent-track space-y-0.5">
      {sortedTags.length === 0 ? (
        <p className="px-3 py-2 text-xs text-[#9f99a3]">{t("listControls.noTags")}</p>
      ) : (
        sortedTags.map((tag) => {
          const selected = filterConfig.selectedTags?.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onFilterChange({ selectedTags: selected ? filterConfig.selectedTags.filter((tt) => tt !== tag) : [...(filterConfig.selectedTags || []), tag] })}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                selected
                  ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
                  : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              )}
            >
              <span className="flex-1 text-left">#{tag}</span>
              {selected && <Check className="h-3.5 w-3.5" />}
            </button>
          );
        })
      )}
    </div>
  );

  const renderStatusOptions = (close: () => void) => (
    <div className="space-y-0.5">
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => { onFilterChange({ status: option.value }); close(); }}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
            filterConfig.status === option.value
              ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
              : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          )}
        >
          {option.label}
          {filterConfig.status === option.value && <Check className="h-3.5 w-3.5" />}
        </button>
      ))}
    </div>
  );

  const renderPriorityOptions = () => (
    <div className="space-y-0.5">
      {PRIORITY_OPTIONS.map((option) => {
        const selected = filterConfig.selectedPriorities?.includes(option.value);
        const config = option.value !== "none" ? PRIORITY_CONFIG[option.value] : null;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onFilterChange({ selectedPriorities: selected ? filterConfig.selectedPriorities.filter((p) => p !== option.value) : [...(filterConfig.selectedPriorities || []), option.value] })}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
              selected
                ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
                : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            )}
          >
            {config ? (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: config.textColor }} />
            ) : (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-300" />
            )}
            <span className="flex-1 text-left">{option.label}</span>
            {selected && <Check className="h-3.5 w-3.5" />}
          </button>
        );
      })}
    </div>
  );

  const renderSortOptions = (close: () => void) => (
    <div className="space-y-2 p-1">
      {viewMode === "kanban" ? (
        <>
          <p className="text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("listControls.unscheduled")}</p>
          {(["newest", "oldest", "priority"] as const).map((sort) => (
            <button
              key={sort}
              type="button"
              onClick={() => { onSortChange?.({ unscheduledSort: sort }); close(); }}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                sortConfig?.unscheduledSort === sort
                  ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
                  : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              )}
            >
              {sort === "newest" ? t("listControls.newestFirst") : sort === "oldest" ? t("listControls.oldestFirst") : t("itemForm.priority")}
              {sortConfig?.unscheduledSort === sort && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </>
      ) : (
        <>
          <p className="text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("listControls.sortBy")}</p>
          {([ { value: "time" as const, label: t("listControls.date") }, { value: "created" as const, label: t("listControls.created") }, { value: "priority" as const, label: t("itemForm.priority") } ]).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSortChange?.({ mode: option.value })}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                sortConfig?.mode === option.value
                  ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]"
                  : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              )}
            >
              {option.label}
              {sortConfig?.mode === option.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}

          <div className="border-t border-black/8 dark:border-white/10" />

          {sortConfig?.mode === "time" && (
            <>
              <button
                type="button"
                onClick={() => onSortChange?.({ timeDirection: sortConfig.timeDirection === "asc" ? "desc" : "asc" })}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                {sortConfig.timeDirection === "asc" ? t("listControls.ascending") : t("listControls.descending")}
              </button>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("listControls.allDayEvents")}</p>
              <button type="button" onClick={() => onSortChange?.({ allDayPreference: "allDayFirst" })} className={cn("flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors", sortConfig.allDayPreference === "allDayFirst" ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]" : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")}>
                {t("listControls.prioritizeAllDay")}{sortConfig.allDayPreference === "allDayFirst" && <Check className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => onSortChange?.({ allDayPreference: "timedFirst" })} className={cn("flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors", sortConfig.allDayPreference === "timedFirst" ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]" : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")}>
                {t("listControls.prioritizeTimed")}{sortConfig.allDayPreference === "timedFirst" && <Check className="h-3.5 w-3.5" />}
              </button>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("listControls.unscheduled")}</p>
              {(["newest", "oldest", "priority"] as const).map((sort) => (
                <button key={sort} type="button" onClick={() => onSortChange?.({ unscheduledSort: sort })} className={cn("flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors", sortConfig.unscheduledSort === sort ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]" : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")}>
                  {sort === "newest" ? t("listControls.newestFirst") : sort === "oldest" ? t("listControls.oldestFirst") : t("itemForm.priority")}{sortConfig.unscheduledSort === sort && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </>
          )}

          {sortConfig?.mode === "created" && (
            <button type="button" onClick={() => onSortChange?.({ createdDirection: sortConfig.createdDirection === "asc" ? "desc" : "asc" })} className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              {sortConfig.createdDirection === "asc" ? t("listControls.oldestFirst") : t("listControls.newestFirst")}
            </button>
          )}

          {sortConfig?.mode === "priority" && (
            <>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("listControls.show")}</p>
              <button type="button" onClick={() => onSortChange?.({ prioritySchedulePreference: "scheduledFirst" })} className={cn("flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors", sortConfig.prioritySchedulePreference === "scheduledFirst" ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]" : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")}>
                {t("listControls.scheduledFirst")}{sortConfig.prioritySchedulePreference === "scheduledFirst" && <Check className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => onSortChange?.({ prioritySchedulePreference: "unscheduledFirst" })} className={cn("flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors", sortConfig.prioritySchedulePreference === "unscheduledFirst" ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]" : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")}>
                {t("listControls.unscheduledFirst")}{sortConfig.prioritySchedulePreference === "unscheduledFirst" && <Check className="h-3.5 w-3.5" />}
              </button>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("listControls.thenBy")}</p>
              <button type="button" onClick={() => onSortChange?.({ prioritySubField: "startTime" })} className={cn("flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors", sortConfig.prioritySubField === "startTime" ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]" : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")}>
                {t("listControls.startTime")}{sortConfig.prioritySubField === "startTime" && <Check className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => onSortChange?.({ prioritySubField: "createdAt" })} className={cn("flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors", sortConfig.prioritySubField === "createdAt" ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]" : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]")}>
                {t("listControls.created")}{sortConfig.prioritySubField === "createdAt" && <Check className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => onSortChange?.({ prioritySubDirection: sortConfig.prioritySubDirection === "asc" ? "desc" : "asc" })} className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                {sortConfig.prioritySubDirection === "asc" ? t("listControls.ascending") : t("listControls.descending")}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      {/* ── Mobile: select + filter trigger row ── */}
      <div className="lg:hidden flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {viewMode === "list" && isListSelectionMode !== undefined && onToggleSelectMode && (
            <>
              {isListSelectionMode ? (
                <button
                  type="button"
                  onClick={onToggleSelectAll}
                  disabled={selectionDisabled}
                  className="flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-black/8 bg-white px-3 text-[11px] font-medium tracking-wide text-[#7d7880] transition-colors hover:text-[#25242a] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {allSelected ? t("common.deselectAll") : onSelectAllLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onToggleSelectMode}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[11px] font-medium tracking-wide transition-colors",
                  isListSelectionMode
                    ? "border-black/12 bg-white text-[#25242a] shadow-sm"
                    : "border-black/8 bg-[#f4f0ec]/50 text-[#7d7880] hover:text-[#5f5a63]"
                )}
              >
                {isListSelectionMode ? t("common.cancel") : t("listControls.select")}
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setMobileExpandedSections(new Set()); setMobileModalOpen(true); }}
          className={cn(
            "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors",
            activeFilterCount > 0
              ? "border-black/12 bg-white text-[#25242a] dark:border-white/12 dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"
              : "border-black/8 bg-transparent text-[#7d7880] hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{t("listControls.filterSort")}</span>
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#25242a] px-1 text-[9px] font-semibold text-white dark:bg-[#f5f5f5] dark:text-[#101010]">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile modal ── */}
      {mobileModalOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center overscroll-contain">
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50" onClick={() => setMobileModalOpen(false)} />
          <div className="relative max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-2xl sm:rounded-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/8 dark:border-white/10 px-4 py-3 shrink-0">
              <span className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">
                {t("listControls.filterAndSort")}
              </span>
              <div className="flex items-center gap-1.5">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onFilterChange({ status: "all", selectedTags: [], selectedPriorities: [], selectedProjectIds: [], timePreset: "none", customStartDate: "", customEndDate: "" });
                    }}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium text-[#7d7880] hover:bg-black/[0.04] dark:text-[#a3a3a3] dark:hover:bg-white/[0.06] transition-colors"
                  >
                    {t("common.clearFilters")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileModalOpen(false)}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[#7d7880] hover:bg-black/[0.04] dark:text-[#a3a3a3] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto overscroll-contain touch-pan-y scrollbar-transparent-track p-4 space-y-1 flex-1 min-h-0">
              {/* Project */}
              <div>
                <button type="button" onClick={() => toggleMobileSection("project")} className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors">
                  <Folder className="h-3.5 w-3.5 text-[#9f99a3]" />
                  <span className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("itemForm.project")}</span>
                  {projectLabel && <span className="text-[11px] text-[#525059] dark:text-[#d4d4d4] truncate">{projectLabel}</span>}
                  <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-[#9f99a3] transition-transform", mobileExpandedSections.has("project") && "rotate-180")} />
                </button>
                {mobileExpandedSections.has("project") && (
                  <div className="pl-1">{renderProjectOptions(() => {})}</div>
                )}
              </div>

              {/* Time */}
              {showTimeFilter && (
                <div>
                  <button type="button" onClick={() => toggleMobileSection("time")} className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors">
                    <Clock className="h-3.5 w-3.5 text-[#9f99a3]" />
                    <span className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("itemForm.time")}</span>
                    {timeLabel && <span className="text-[11px] text-[#525059] dark:text-[#d4d4d4] truncate">{timeLabel}</span>}
                    <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-[#9f99a3] transition-transform", mobileExpandedSections.has("time") && "rotate-180")} />
                  </button>
                  {mobileExpandedSections.has("time") && (
                    <div className="pl-1">{renderTimeOptions(() => {})}</div>
                  )}
                </div>
              )}

              {/* Tags */}
              <div>
                <button type="button" onClick={() => toggleMobileSection("tags")} className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors">
                  <Tag className="h-3.5 w-3.5 text-[#9f99a3]" />
                  <span className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("itemForm.tags")}</span>
                  {tagLabel && <span className="text-[11px] text-[#525059] dark:text-[#d4d4d4] truncate">{tagLabel}</span>}
                  <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-[#9f99a3] transition-transform", mobileExpandedSections.has("tags") && "rotate-180")} />
                </button>
                {mobileExpandedSections.has("tags") && (
                  <div className="pl-1">{renderTagOptions()}</div>
                )}
              </div>

              {/* Status */}
              {showStatusFilter && (
                <div>
                  <button type="button" onClick={() => toggleMobileSection("status")} className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors">
                    <CheckCircle className="h-3.5 w-3.5 text-[#9f99a3]" />
                    <span className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("itemForm.status")}</span>
                    {statusLabel && <span className="text-[11px] text-[#525059] dark:text-[#d4d4d4] truncate">{statusLabel}</span>}
                    <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-[#9f99a3] transition-transform", mobileExpandedSections.has("status") && "rotate-180")} />
                  </button>
                  {mobileExpandedSections.has("status") && (
                    <div className="pl-1">{renderStatusOptions(() => {})}</div>
                  )}
                </div>
              )}

              {/* Priority */}
              <div>
                <button type="button" onClick={() => toggleMobileSection("priority")} className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors">
                  <Flag className="h-3.5 w-3.5 text-[#9f99a3]" />
                  <span className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("itemForm.priority")}</span>
                  {priorityLabel && <span className="text-[11px] text-[#525059] dark:text-[#d4d4d4] truncate">{priorityLabel}</span>}
                  <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-[#9f99a3] transition-transform", mobileExpandedSections.has("priority") && "rotate-180")} />
                </button>
                {mobileExpandedSections.has("priority") && (
                  <div className="pl-1">{renderPriorityOptions()}</div>
                )}
              </div>

              {/* Sort */}
              {showSort && sortConfig && onSortChange && (
                <div>
                  <button type="button" onClick={() => toggleMobileSection("sort")} className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors">
                    <ArrowUpDown className="h-3.5 w-3.5 text-[#9f99a3]" />
                    <span className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">{t("listControls.sort")}</span>
                    {sortLabel && <span className="text-[11px] text-[#525059] dark:text-[#d4d4d4] truncate">{sortLabel}</span>}
                    <ChevronDown className={cn("ml-auto h-3.5 w-3.5 text-[#9f99a3] transition-transform", mobileExpandedSections.has("sort") && "rotate-180")} />
                  </button>
                  {mobileExpandedSections.has("sort") && (
                    <div className="pl-1">{renderSortOptions(() => setMobileModalOpen(false))}</div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-black/8 dark:border-white/10 px-4 py-3 shrink-0">
              <button
                type="button"
                onClick={() => setMobileModalOpen(false)}
                className="w-full rounded-xl bg-[#25242a] dark:bg-[#f5f5f5] px-4 py-2.5 text-sm font-medium text-white dark:text-[#101010] transition-colors hover:bg-[#3a3940] dark:hover:bg-[#e0e0e0]"
              >
                {t("common.apply")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Desktop: inline filter bar ── */}
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-[#9f99a3]" />

          <FilterDropdown
            label={t("itemForm.project")}
            icon={Folder}
            value={projectLabel}
            onClear={() => onFilterChange({ selectedProjectIds: [] })}
          >
            {(close) => renderProjectOptions(close)}
          </FilterDropdown>

          {showTimeFilter && (
            <FilterDropdown
              label={t("itemForm.time")}
              icon={Clock}
              value={timeLabel}
              onClear={() => onFilterChange({ timePreset: "none", customStartDate: "", customEndDate: "" })}
            >
              {(close) => renderTimeOptions(close)}
            </FilterDropdown>
          )}

          <FilterDropdown
            label={t("itemForm.tags")}
            icon={Tag}
            value={tagLabel}
            onClear={() => onFilterChange({ selectedTags: [] })}
          >
            {(close) => renderTagOptions()}
          </FilterDropdown>

          {showStatusFilter && (
            <FilterDropdown
              label={t("itemForm.status")}
              icon={CheckCircle}
              value={statusLabel}
              onClear={() => onFilterChange({ status: "all" })}
            >
              {(close) => renderStatusOptions(close)}
            </FilterDropdown>
          )}

          <FilterDropdown
            label={t("itemForm.priority")}
            icon={Flag}
            value={priorityLabel}
            onClear={() => onFilterChange({ selectedPriorities: [] })}
          >
            {(close) => renderPriorityOptions()}
          </FilterDropdown>
        </div>

        {showSort && sortConfig && onSortChange && (
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-[#9f99a3]" />
            <FilterDropdown
              label={t("listControls.sort")}
              icon={SortIcon}
              value={sortLabel}
              align="right"
            >
              {(close) => renderSortOptions(close)}
            </FilterDropdown>
          </div>
        )}
      </div>
    </>
  );
}
