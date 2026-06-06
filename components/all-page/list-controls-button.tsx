"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { PRIORITY_CONFIG } from "@/lib/all-page-utils";
import { useScrollLock } from "@/lib/hooks/use-scroll-lock";
import { useI18n } from "@/lib/i18n";
import type {
  ListFilterConfig,
  ListSortConfig,
  ListTimeFilterPreset,
  PriorityFilterValue,
} from "@/lib/types/all-page";

interface ListControlsButtonProps {
  filterConfig: ListFilterConfig;
  sortConfig: ListSortConfig;
  availableTags: string[];
  onFilterChange: (update: Partial<ListFilterConfig>) => void;
  onSortChange: (update: Partial<ListSortConfig>) => void;
  mode?: "list" | "kanban";
}

function getActiveFilterCount(config: ListFilterConfig, includeTime: boolean) {
  let count = 0;
  if (includeTime && config.timePreset !== "none") count += 1;
  if (config.status !== "all") count += 1;
  if (config.selectedTags?.length > 0) count += 1;
  if (config.selectedPriorities?.length > 0) count += 1;
  return count;
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export function ListControlsButton({
  filterConfig,
  sortConfig,
  availableTags,
  onFilterChange,
  onSortChange,
  mode = "list",
}: ListControlsButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  const showTimeFilter = mode === "list";
  const activeFilterCount = getActiveFilterCount(filterConfig, showTimeFilter);
  const sortedTags = useMemo(
    () => [...availableTags].sort((a, b) => a.localeCompare(b)),
    [availableTags],
  );

  const TIME_OPTIONS: Array<{ value: ListTimeFilterPreset; label: string }> = [
    { value: "today", label: t("listControls.today") },
    { value: "tomorrow", label: t("listControls.tomorrow") },
    { value: "week", label: t("listControls.thisWeek") },
    { value: "month", label: t("listControls.thisMonth") },
    { value: "custom", label: t("listControls.custom") },
  ];

  const PRIORITY_OPTIONS: Array<{ value: PriorityFilterValue; label: string }> = [
    { value: "urgent", label: t("listControls.urgent") },
    { value: "high", label: t("listControls.high") },
    { value: "medium", label: t("listControls.medium") },
    { value: "low", label: t("listControls.low") },
    { value: "none", label: t("listControls.noPriority") },
  ];

  function clearFilters() {
    onFilterChange({
      timePreset: "none",
      customStartDate: "",
      customEndDate: "",
      status: "all",
      selectedTags: [],
      tagMatchMode: "or",
      selectedPriorities: [],
    });
  }

  function toggleDirection(
    field: "timeDirection" | "createdDirection" | "prioritySubDirection",
  ) {
    const current =
      field === "timeDirection"
        ? sortConfig.timeDirection
        : field === "createdDirection"
          ? sortConfig.createdDirection
          : sortConfig.prioritySubDirection;
    onSortChange({ [field]: current === "asc" ? "desc" : "asc" });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${
          open || activeFilterCount > 0
            ? "border-black/12 bg-white text-[#25242a] shadow-sm dark:border-white/12 dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"
            : "border-black/8 bg-[#f4f0ec]/50 text-[#7d7880] hover:text-[#5f5a63] dark:border-white/8 dark:bg-white/8 dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {t("listControls.filterSort")}
        {activeFilterCount > 0 ? (
          <span className="ml-0.5 rounded-full bg-[#25242a] px-1.5 py-0.5 text-[10px] leading-none text-white dark:bg-[#e5e5e5] dark:text-[#111111]">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close list controls"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-white/35 backdrop-blur-[5px] dark:bg-black/50"
          />
          <div className="fixed top-16 right-4 left-4 z-50 mx-auto max-h-[calc(100vh-5rem)] max-w-5xl overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.16)] sm:top-20 dark:border-white/10 dark:bg-[#202020]">
            <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-[#9f99a3] uppercase dark:text-[#737373]">
                  {t("listControls.title")}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">
                  {t("listControls.filterAndSort")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.04] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                aria-label="Close list controls"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
              <section className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">
                    {t("listControls.filters")}
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={activeFilterCount === 0}
                    className={`flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30 ${
                      activeFilterCount > 0
                        ? "cursor-pointer opacity-100"
                        : "pointer-events-none opacity-0"
                    }`}
                  >
                    <X className="h-3 w-3" />
                    {t("listControls.clear")}
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {showTimeFilter ? (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">
                        {t("itemForm.time")}
                      </p>
                      <button
                        type="button"
                        onClick={() => onFilterChange({ timePreset: "none" })}
                        className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-1.5 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03] dark:text-[#d4d4d4] dark:hover:bg-white/8"
                      >
                        {t("listControls.anyTime")}
                        {filterConfig.timePreset === "none" && (
                          <Check className="h-3.5 w-3.5 text-[#25242a] dark:text-[#f5f5f5]" />
                        )}
                      </button>
                      <div className="grid grid-cols-2 gap-1">
                        {TIME_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => onFilterChange({ timePreset: option.value })}
                            className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-1.5 text-left text-sm transition-colors ${
                              filterConfig.timePreset === option.value
                                ? "bg-black/[0.04] text-[#25242a] dark:bg-white/12 dark:text-[#f5f5f5]"
                                : "text-[#333139] hover:bg-black/[0.03] dark:text-[#d4d4d4] dark:hover:bg-white/8"
                            }`}
                          >
                            {option.label}
                            {filterConfig.timePreset === option.value && (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ))}
                      </div>
                      {filterConfig.timePreset === "custom" ? (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Input
                            type="date"
                            value={filterConfig.customStartDate}
                            onChange={(e) =>
                              onFilterChange({ customStartDate: e.target.value })
                            }
                            className="h-8 rounded-xl px-3 text-xs"
                            aria-label="Filter start date"
                          />
                          <Input
                            type="date"
                            value={filterConfig.customEndDate}
                            onChange={(e) =>
                              onFilterChange({ customEndDate: e.target.value })
                            }
                            className="h-8 rounded-xl px-3 text-xs"
                            aria-label="Filter end date"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    {showTimeFilter ? (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">
                        {t("listControls.status")}
                      </p>
                      <div className="relative grid grid-cols-3 gap-1 rounded-full border border-black/8 p-0.5 dark:border-white/10">
                        {/* Sliding background */}
                        <div
                          className="absolute top-0.5 bottom-0.5 rounded-full bg-[#25242a] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#e5e5e5]"
                          style={{
                            left: `calc(2px + ${filterConfig.status === "all" ? 0 : filterConfig.status === "active" ? 1 : 2} * ((100% - 12px) / 3 + 4px))`,
                            width: "calc((100% - 12px) / 3)",
                          }}
                        />
                        {[
                          { value: "all", label: t("listControls.all") },
                          { value: "active", label: t("listControls.open") },
                          { value: "completed", label: t("listControls.done") },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              onFilterChange({
                                status: option.value as ListFilterConfig["status"],
                              })
                            }
                            className={`relative z-10 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              filterConfig.status === option.value
                                ? "text-white dark:text-[#111111]"
                                : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    ) : null}

                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">
                        {t("itemForm.priority")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {PRIORITY_OPTIONS.map((option) => {
                          const selected = filterConfig.selectedPriorities.includes(
                            option.value,
                          );
                          const priorityConfig =
                            option.value !== "none"
                              ? PRIORITY_CONFIG[option.value]
                              : null;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                onFilterChange({
                                  selectedPriorities: toggleValue(
                                    filterConfig.selectedPriorities,
                                    option.value,
                                  ),
                                })
                              }
                              className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                                selected
                                  ? "bg-[#25242a] text-white shadow-sm dark:!bg-[#e5e5e5] dark:!text-[#111111]"
                                  : "bg-black/[0.035] text-[#5f5a63] hover:bg-black/[0.07] dark:bg-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/12"
                              }`}
                              style={
                                selected || !priorityConfig
                                  ? undefined
                                  : { color: priorityConfig.textColor }
                              }
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between md:flex-col md:items-start md:gap-1.5">
                    <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">
                      {t("itemForm.tags")}
                    </p>
                    <div className="relative grid grid-cols-2 rounded-full border border-black/8 p-0.5 dark:border-white/10">
                      {/* Sliding background */}
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded-full bg-[#25242a] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#e5e5e5]"
                        style={{
                          left: filterConfig.tagMatchMode === "or" ? "2px" : "50%",
                          width: "calc(50% - 2px)",
                        }}
                      />
                      {(["or", "and"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onFilterChange({ tagMatchMode: mode })}
                          className={`relative z-10 cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-medium uppercase transition-colors ${
                            filterConfig.tagMatchMode === mode
                              ? "text-white dark:text-[#111111]"
                              : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sortedTags.length > 0 ? (
                    <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1 md:pt-2">
                      {sortedTags.map((tag) => {
                        const selected = filterConfig.selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              onFilterChange({
                                selectedTags: toggleValue(
                                  filterConfig.selectedTags,
                                  tag,
                                ),
                              })
                            }
                            className={`max-w-full cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                              selected
                                ? "bg-[#25242a] text-white shadow-sm dark:!bg-[#e5e5e5] dark:!text-[#111111]"
                                : "bg-black/[0.035] text-[#5f5a63] hover:bg-black/[0.07] dark:bg-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/12"
                            }`}
                          >
                            <span className="block max-w-44 truncate">{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl px-3 py-1.5 text-sm text-[#9f99a3] dark:text-[#737373]">
                      {t("listControls.noTags")}
                    </p>
                  )}
                </div>
              </section>

              <section className="min-w-0 border-t border-black/8 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5 dark:border-white/10">
                <p className="mb-3 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">
                  {t("listControls.sort")}
                </p>

                {mode === "kanban" ? (
                  <OptionGroup title={t("listControls.unscheduled")}>
                    {(["newest", "oldest", "priority"] as const).map((sort) => (
                      <CheckOption
                        key={sort}
                        label={
                          sort === "newest"
                            ? t("listControls.newestFirst")
                            : sort === "oldest"
                              ? t("listControls.oldestFirst")
                              : t("itemForm.priority")
                        }
                        checked={sortConfig.unscheduledSort === sort}
                        onClick={() => onSortChange({ unscheduledSort: sort })}
                      />
                    ))}
                  </OptionGroup>
                ) : (
                  <>
                <div className="relative mb-3 grid grid-cols-3 rounded-full border border-black/8 p-0.5 dark:border-white/10">
                  {/* Sliding background */}
                  <div
                    className="absolute top-0.5 bottom-0.5 rounded-full bg-[#25242a] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#e5e5e5]"
                    style={{
                      left: `calc(2px + ${sortConfig.mode === "time" ? 0 : sortConfig.mode === "created" ? 1 : 2} * (100% - 4px) / 3)`,
                      width: "calc((100% - 4px) / 3)",
                    }}
                  />
                  {[
                    { value: "time", label: t("listControls.date") },
                    { value: "created", label: t("listControls.created") },
                    { value: "priority", label: t("itemForm.priority") },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        onSortChange({ mode: option.value as ListSortConfig["mode"] })
                      }
                      className={`relative z-10 flex-1 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        sortConfig.mode === option.value
                          ? "text-white dark:text-[#111111]"
                          : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {sortConfig.mode === "time" ? (
                  <>
                    <SortDirectionButton
                      label={
                        sortConfig.timeDirection === "asc"
                          ? t("listControls.ascending")
                          : t("listControls.descending")
                      }
                      direction={sortConfig.timeDirection}
                      onClick={() => toggleDirection("timeDirection")}
                    />

                    <OptionGroup title={t("listControls.allDayEvents")}>
                      <CheckOption
                        label={t("listControls.prioritizeAllDay")}
                        checked={sortConfig.allDayPreference === "allDayFirst"}
                        onClick={() =>
                          onSortChange({ allDayPreference: "allDayFirst" })
                        }
                      />
                      <CheckOption
                        label={t("listControls.prioritizeTimed")}
                        checked={sortConfig.allDayPreference === "timedFirst"}
                        onClick={() =>
                          onSortChange({ allDayPreference: "timedFirst" })
                        }
                      />
                    </OptionGroup>

                    <OptionGroup title={t("listControls.unscheduled")}>
                      {(["newest", "oldest", "priority"] as const).map((sort) => (
                        <CheckOption
                          key={sort}
                          label={
                            sort === "newest"
                              ? t("listControls.newestFirst")
                              : sort === "oldest"
                                ? t("listControls.oldestFirst")
                                : t("itemForm.priority")
                          }
                          checked={sortConfig.unscheduledSort === sort}
                          onClick={() => onSortChange({ unscheduledSort: sort })}
                        />
                      ))}
                    </OptionGroup>
                  </>
                ) : sortConfig.mode === "created" ? (
                  <SortDirectionButton
                    label={
                      sortConfig.createdDirection === "asc"
                        ? t("listControls.oldestFirst")
                        : t("listControls.newestFirst")
                    }
                    direction={sortConfig.createdDirection}
                    onClick={() => toggleDirection("createdDirection")}
                  />
                ) : (
                  <>
                    <OptionGroup title={t("listControls.show")}>
                      <CheckOption
                        label={t("listControls.scheduledFirst")}
                        checked={
                          sortConfig.prioritySchedulePreference === "scheduledFirst"
                        }
                        onClick={() =>
                          onSortChange({
                            prioritySchedulePreference: "scheduledFirst",
                          })
                        }
                      />
                      <CheckOption
                        label={t("listControls.unscheduledFirst")}
                        checked={
                          sortConfig.prioritySchedulePreference ===
                          "unscheduledFirst"
                        }
                        onClick={() =>
                          onSortChange({
                            prioritySchedulePreference: "unscheduledFirst",
                          })
                        }
                      />
                    </OptionGroup>

                    <OptionGroup title={t("listControls.thenBy")}>
                      <CheckOption
                        label={t("listControls.startTime")}
                        checked={sortConfig.prioritySubField === "startTime"}
                        onClick={() =>
                          onSortChange({ prioritySubField: "startTime" })
                        }
                      />
                      <CheckOption
                        label={t("listControls.created")}
                        checked={sortConfig.prioritySubField === "createdAt"}
                        onClick={() =>
                          onSortChange({ prioritySubField: "createdAt" })
                        }
                      />
                    </OptionGroup>

                    <SortDirectionButton
                      label={
                        sortConfig.prioritySubDirection === "asc"
                          ? t("listControls.ascending")
                          : t("listControls.descending")
                      }
                      direction={sortConfig.prioritySubDirection}
                      onClick={() => toggleDirection("prioritySubDirection")}
                    />
                  </>
                )}
                  </>
                )}
              </section>
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OptionGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 space-y-1">
      <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">
        {title}
      </p>
      {children}
    </div>
  );
}

function CheckOption({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03] dark:text-[#d4d4d4] dark:hover:bg-white/8"
    >
      {label}
      {checked && <Check className="h-3.5 w-3.5 text-[#25242a] dark:text-[#f5f5f5]" />}
    </button>
  );
}

function SortDirectionButton({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <div className="mb-3 space-y-1">
      <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">
        Order
      </p>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03] dark:text-[#d4d4d4] dark:hover:bg-white/8"
      >
        {direction === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )}
        {label}
      </button>
    </div>
  );
}
