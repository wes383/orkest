"use client";

import { Calendar, CheckCircle2, Clock, TrendingUp, TrendingDown, Minus, Lightbulb, Timer } from "lucide-react";

import { useI18n } from "@/lib/i18n";

export type AiWeeklyReviewTaskStats = {
  total: number;
  completed: number;
  completionRate: number;
};

export type AiWeeklyReviewTimeStats = {
  totalMinutes: number;
  byCategory: Array<{ category: string; minutes: number; percentage: number }>;
};

export type AiWeeklyReviewFocusStats = {
  totalMinutes: number;
  sessionCount: number;
  averageMinutes: number;
  longestMinutes: number;
};

export type AiWeeklyReviewComparison = {
  currentWeek: number;
  previousWeek: number;
  change: number;
  trend: "up" | "down" | "same";
};

export type AiWeeklyReviewData = {
  weekStart: string;
  weekEnd: string;
  taskStats: AiWeeklyReviewTaskStats;
  timeStats: AiWeeklyReviewTimeStats;
  focusStats: AiWeeklyReviewFocusStats;
  comparison: AiWeeklyReviewComparison;
  suggestions: string[];
};

type AiWeeklyReviewCardProps = {
  data: AiWeeklyReviewData;
  isFullscreen?: boolean;
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

function TrendIcon({ trend }: { trend: "up" | "down" | "same" }) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-400" />;
}

export function AiWeeklyReviewCard({ data, isFullscreen }: AiWeeklyReviewCardProps) {
  const { t } = useI18n();

  return (
    <div className={`my-2.5 rounded-2xl border border-black/8 bg-white/80 p-4 dark:border-white/10 dark:bg-white/6 ${isFullscreen ? "max-w-2xl" : ""}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#7e7982] dark:text-[#a3a3a3]" />
          <p className="text-xs font-semibold tracking-[0.15em] text-[#8c8691] uppercase dark:text-[#737373]">
            {t("review.title")}
          </p>
        </div>
        <p className="text-xs font-medium text-[#7e7982] dark:text-[#a3a3a3]">
          {data.weekStart} - {data.weekEnd}
        </p>
      </div>

      {/* Task Stats */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {/* Total Tasks */}
        <div className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.06]">
          <p className="text-[10px] font-medium text-[#8c8691] dark:text-[#737373]">{t("review.totalTasks")}</p>
          <p className="text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">{data.taskStats.total}</p>
        </div>

        {/* Completed */}
        <div className="rounded-lg bg-green-50 p-2 dark:bg-green-900/20">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
            <p className="text-[10px] font-medium text-green-600 dark:text-green-400">{t("review.completed")}</p>
          </div>
          <p className="text-lg font-semibold text-green-700 dark:text-green-300">{data.taskStats.completed}</p>
        </div>

        {/* Completion Rate */}
        <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20">
          <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400">{t("review.rate")}</p>
          <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">{data.taskStats.completionRate}%</p>
        </div>
      </div>

      {/* Completion Progress Bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-medium text-[#8c8691] dark:text-[#737373]">{t("review.completionRate")}</p>
          <p className="text-[10px] font-semibold text-[#25242a] dark:text-[#f5f5f5]">{data.taskStats.completionRate}%</p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
          <div 
            className="h-full rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${data.taskStats.completionRate}%` }}
          />
        </div>
      </div>

      {/* Week Comparison */}
      <div className="mb-3 rounded-lg border border-black/8 bg-black/[0.02] p-2.5 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-[0.1em] text-[#8c8691] uppercase dark:text-[#737373]">
            {t("review.vsLastWeek")}
          </p>
          <div className="flex items-center gap-1">
            <TrendIcon trend={data.comparison.trend} />
            <span className={`text-xs font-semibold ${
              data.comparison.trend === "up" 
                ? "text-green-600 dark:text-green-400" 
                : data.comparison.trend === "down" 
                  ? "text-red-600 dark:text-red-400" 
                  : "text-gray-400"
            }`}>
              {data.comparison.change > 0 ? "+" : ""}{data.comparison.change} {t("review.tasks")}
            </span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[#8c8691] dark:text-[#737373]">
          <span>{t("review.thisWeek")}: <span className="font-semibold text-[#25242a] dark:text-[#f5f5f5]">{data.comparison.currentWeek}</span></span>
          <span>{t("review.lastWeek")}: <span className="font-semibold text-[#25242a] dark:text-[#f5f5f5]">{data.comparison.previousWeek}</span></span>
        </div>
      </div>

      {/* Time Allocation */}
      {data.timeStats.byCategory.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1">
            <Clock className="h-3 w-3 text-[#7e7982] dark:text-[#a3a3a3]" />
            <p className="text-[10px] font-semibold tracking-[0.1em] text-[#8c8691] uppercase dark:text-[#737373]">
              {t("review.timeAllocation")}
            </p>
          </div>
          <div className="space-y-1.5">
            {data.timeStats.byCategory.map((cat, index) => (
              <div key={index}>
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-[#5f5a63] dark:text-[#a3a3a3]">{cat.category}</span>
                  <span className="text-[10px] text-[#8c8691] dark:text-[#737373]">
                    {formatMinutes(cat.minutes)} ({cat.percentage}%)
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
                  <div 
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-[#8c8691] dark:text-[#737373]">
            {t("review.total")}: {formatMinutes(data.timeStats.totalMinutes)}
          </p>
        </div>
      )}

      {/* Focus Stats */}
      {data.focusStats.sessionCount > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1">
            <Timer className="h-3 w-3 text-[#7e7982] dark:text-[#a3a3a3]" />
            <p className="text-[10px] font-semibold tracking-[0.1em] text-[#8c8691] uppercase dark:text-[#737373]">
              {t("review.focusSessions")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-purple-50 p-1.5 dark:bg-purple-900/20">
              <p className="text-[10px] text-purple-600 dark:text-purple-400">{t("review.total")}</p>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                {formatMinutes(data.focusStats.totalMinutes)}
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 p-1.5 dark:bg-purple-900/20">
              <p className="text-[10px] text-purple-600 dark:text-purple-400">{t("review.sessions")}</p>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                {data.focusStats.sessionCount}
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 p-1.5 dark:bg-purple-900/20">
              <p className="text-[10px] text-purple-600 dark:text-purple-400">{t("review.average")}</p>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                {formatMinutes(data.focusStats.averageMinutes)}
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 p-1.5 dark:bg-purple-900/20">
              <p className="text-[10px] text-purple-600 dark:text-purple-400">{t("review.longest")}</p>
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                {formatMinutes(data.focusStats.longestMinutes)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {data.suggestions.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1">
            <Lightbulb className="h-3 w-3 text-yellow-500" />
            <p className="text-[10px] font-semibold tracking-[0.1em] text-[#8c8691] uppercase dark:text-[#737373]">
              {t("review.suggestions")}
            </p>
          </div>
          <div className="space-y-1">
            {data.suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-2 rounded-lg bg-yellow-50 px-2.5 py-1.5 dark:bg-yellow-900/20">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-yellow-500" />
                <p className="text-xs text-yellow-800 dark:text-yellow-200">{suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
