"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { useFocusStore } from "@/lib/stores/use-focus-store";
import { useI18n } from "@/lib/i18n";
import { filterSessionsByTimeRange, type TimeRange } from "@/lib/focus-stats-utils";
import { BasicStats } from "./basic-stats";
import { DailyDistribution } from "./daily-distribution";
import { HourlyDistribution } from "./hourly-distribution";
import { MonthlyDistribution } from "./monthly-distribution";
import { TagStats } from "./tag-stats";
import { ContributionHeatmap } from "./contribution-heatmap";

export function FocusStatsDisplay() {
  const { t } = useI18n();
  const sessions = useFocusStore((s) => s.sessions);
  const [isOpen, setIsOpen] = useState(false);
  const [activeRange, setActiveRange] = useState<TimeRange>("today");

  const filteredSessions = useMemo(
    () => filterSessionsByTimeRange(sessions, activeRange),
    [sessions, activeRange],
  );

  const TIME_RANGE_TABS: { key: TimeRange; label: string }[] = [
    { key: "today", label: t("focus.today") },
    { key: "week", label: t("focus.thisWeek") },
    { key: "month", label: t("focus.thisMonth") },
    { key: "year", label: t("focus.thisYear") },
    { key: "all", label: t("focus.allTime") },
  ];

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-6 py-8 text-center">
        <p className="text-[11px] font-semibold tracking-[0.24em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
          {t("focus.noFocusSessions")}
        </p>
        <p className="mt-2 text-sm text-[#6a6570] dark:text-[#a09ba5]">
          {t("focus.startSessionHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/8 dark:border-white/10 bg-white/75 dark:bg-white/[0.06] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors"
      >
        <span className="text-xs font-semibold tracking-[0.16em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
          {t("focus.statistics")}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[#7d7880] dark:text-[#a9a4ae] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          <div className="relative flex gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl">
            {/* Sliding background */}
            <div
              className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-all duration-300 ease-in-out dark:bg-[#3a3840]"
              style={{
                left: `calc(4px + ${TIME_RANGE_TABS.findIndex((t) => t.key === activeRange)} * ((100% - 24px) / 5 + 4px))`,
                width: "calc((100% - 24px) / 5)",
              }}
            />
            {TIME_RANGE_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveRange(key)}
                className={`relative z-10 flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  activeRange === key
                    ? "text-[#25242a] dark:text-[#e8e6ea]"
                    : "text-[#7d7880] hover:text-[#25242a] dark:text-[#a9a4ae] dark:hover:text-[#e8e6ea]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase mb-2">
              {t("focus.overview")}
            </p>
            <BasicStats sessions={filteredSessions} allSessions={sessions} />
          </div>

          <div className="border-t border-black/6 dark:border-white/10 pt-3">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase mb-2">
              {t("focus.hourlyDistribution")}
            </p>
            <HourlyDistribution sessions={filteredSessions} />
          </div>

          {activeRange === "week" && (
            <div className="border-t border-black/6 dark:border-white/10 pt-3">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase mb-2">
                {t("focus.dailyBreakdown")}
              </p>
              <DailyDistribution sessions={filteredSessions} />
            </div>
          )}

          {activeRange === "year" && (
            <div className="border-t border-black/6 dark:border-white/10 pt-3">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase mb-2">
                {t("focus.monthlyBreakdown")}
              </p>
              <MonthlyDistribution sessions={filteredSessions} />
            </div>
          )}

          {activeRange === "all" && (
            <div className="border-t border-black/6 dark:border-white/10 pt-3">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase mb-2">
                {t("focus.activityHistory")}
              </p>
              <ContributionHeatmap sessions={sessions} />
            </div>
          )}

          <div className="border-t border-black/6 dark:border-white/10 pt-3">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase mb-2">
              {t("focus.byTag")}
            </p>
            <TagStats sessions={filteredSessions} />
          </div>
        </div>
      )}
    </div>
  );
}
