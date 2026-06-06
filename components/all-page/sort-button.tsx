"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from "lucide-react";
import type { ListSortConfig } from "@/lib/types/all-page";
import { useI18n } from "@/lib/i18n";

interface SortButtonProps {
  config: ListSortConfig;
  onChange: (update: Partial<ListSortConfig>) => void;
}

export function SortButton({ config, onChange }: SortButtonProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleDirection(
    field: "timeDirection" | "createdDirection" | "prioritySubDirection",
  ) {
    const current =
      field === "timeDirection"
        ? config.timeDirection
        : field === "createdDirection"
          ? config.createdDirection
          : config.prioritySubDirection;
    onChange({ [field]: current === "asc" ? "desc" : "asc" });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${
          open
            ? "border-black/12 bg-white text-[#25242a] shadow-sm"
            : "border-black/8 bg-[#f4f0ec]/50 text-[#7d7880] hover:text-[#5f5a63]"
        }`}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        Sort
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close sort options"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-white/25 backdrop-blur-[3px]"
          />
          <div className="fixed top-40 right-4 left-4 z-50 rounded-2xl border border-black/8 bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.12)] sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-64 sm:max-w-[calc(100vw-2rem)]">
          {/* Mode selection */}
          <div className="mb-3 flex rounded-full border border-black/8 p-0.5">
            <button
              type="button"
              onClick={() => onChange({ mode: "time" })}
              className={`flex-1 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                config.mode === "time"
                  ? "bg-[#25242a] text-white"
                  : "text-[#7d7880] hover:text-[#5f5a63]"
              }`}
            >
              Date
            </button>
            <button
              type="button"
              onClick={() => onChange({ mode: "created" })}
              className={`flex-1 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                config.mode === "created"
                  ? "bg-[#25242a] text-white"
                  : "text-[#7d7880] hover:text-[#5f5a63]"
              }`}
            >
              Created
            </button>
            <button
              type="button"
              onClick={() => onChange({ mode: "priority" })}
              className={`flex-1 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                config.mode === "priority"
                  ? "bg-[#25242a] text-white"
                  : "text-[#7d7880] hover:text-[#5f5a63]"
              }`}
            >
              Priority
            </button>
          </div>

          {config.mode === "time" ? (
            <>
              {/* Direction */}
              <div className="mb-3 space-y-1.5">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                  Order
                </p>
                <button
                  type="button"
                  onClick={() => toggleDirection("timeDirection")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03]"
                >
                  {config.timeDirection === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                  {config.timeDirection === "asc" ? "Ascending" : "Descending"}
                </button>
              </div>

              {/* All-day preference */}
              <div className="mb-3 space-y-1.5">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                  All-day events
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ allDayPreference: "allDayFirst" })
                  }
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03]"
                >
                  Prioritize all-day
                  {config.allDayPreference === "allDayFirst" && (
                    <Check className="h-3.5 w-3.5 text-[#25242a]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ allDayPreference: "timedFirst" })
                  }
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03]"
                >
                  Prioritize timed
                  {config.allDayPreference === "timedFirst" && (
                    <Check className="h-3.5 w-3.5 text-[#25242a]" />
                  )}
                </button>
              </div>

              {/* Unscheduled sort */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                  Unscheduled
                </p>
                {(["newest", "oldest", "priority"] as const).map((sort) => (
                  <button
                    key={sort}
                    type="button"
                    onClick={() => onChange({ unscheduledSort: sort })}
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#333139] capitalize transition-colors hover:bg-black/[0.03]"
                  >
                    {sort === "newest"
                      ? t("listControls.newestFirst")
                      : sort === "oldest"
                        ? t("listControls.oldestFirst")
                        : t("listControls.priority")}
                    {config.unscheduledSort === sort && (
                      <Check className="h-3.5 w-3.5 text-[#25242a]" />
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : config.mode === "created" ? (
            <>
              {/* Direction */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                  Order
                </p>
                <button
                  type="button"
                  onClick={() => toggleDirection("createdDirection")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03]"
                >
                  {config.createdDirection === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                  {config.createdDirection === "asc" ? t("listControls.oldestFirst") : t("listControls.newestFirst")}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Schedule preference */}
              <div className="mb-3 space-y-1.5">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                  Show
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ prioritySchedulePreference: "scheduledFirst" })
                  }
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03]"
                >
                  Scheduled first
                  {config.prioritySchedulePreference === "scheduledFirst" && (
                    <Check className="h-3.5 w-3.5 text-[#25242a]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ prioritySchedulePreference: "unscheduledFirst" })
                  }
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03]"
                >
                  Unscheduled first
                  {config.prioritySchedulePreference === "unscheduledFirst" && (
                    <Check className="h-3.5 w-3.5 text-[#25242a]" />
                  )}
                </button>
              </div>

              {/* Priority sub-sort */}
              <div className="mb-3 space-y-1.5">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                  Then by
                </p>
                <button
                  type="button"
                  onClick={() => onChange({ prioritySubField: "startTime" })}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03]"
                >
                  Start time
                  {config.prioritySubField === "startTime" && (
                    <Check className="h-3.5 w-3.5 text-[#25242a]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ prioritySubField: "createdAt" })}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03]"
                >
                  Created
                  {config.prioritySubField === "createdAt" && (
                    <Check className="h-3.5 w-3.5 text-[#25242a]" />
                  )}
                </button>
              </div>

              {/* Priority direction */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                  Order
                </p>
                <button
                  type="button"
                  onClick={() => toggleDirection("prioritySubDirection")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#333139] transition-colors hover:bg-black/[0.03]"
                >
                  {config.prioritySubDirection === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                  {config.prioritySubDirection === "asc"
                    ? "Ascending"
                    : "Descending"}
                </button>
              </div>
            </>
          )}
          </div>
        </>
      )}
    </div>
  );
}
