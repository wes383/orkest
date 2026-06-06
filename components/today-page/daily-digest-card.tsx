"use client";

import { Clock, CheckCircle2, CalendarPlus, Play } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import type { TodayViewModel } from "@/lib/types/today-page";
import {
  buildTaskSummaryDigest,
  getTimeOfDay,
} from "@/lib/daily-digest-utils";

export function DailyDigestCard({ viewModel }: { viewModel: TodayViewModel }) {
  const { t } = useI18n();

  const taskSummary = buildTaskSummaryDigest(viewModel);
  const timeOfDay = getTimeOfDay();

  const timeOfDayLabel = t(`digest.card.timeOfDay.${timeOfDay}`);
  const greeting = t("digest.card.greeting", { timeOfDay: timeOfDayLabel });

  const isAllDone = taskSummary.remainingTasks === 0 && taskSummary.totalTasks > 0;
  const isEmpty = taskSummary.totalTasks === 0;

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">
          {greeting}
        </h2>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-black/8 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-[#202020]/75">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
            {t("today.left")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">
            {taskSummary.remainingTasks}
          </p>
        </div>
        <div className="rounded-2xl border border-black/8 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-[#202020]/75">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
            {t("today.done")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">
            {taskSummary.completedTasks}
          </p>
        </div>
        <div className="rounded-2xl border border-black/8 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-[#202020]/75">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
            {t("today.overdue")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">
            {taskSummary.overdueTasks}
          </p>
        </div>
      </div>

      {taskSummary.inProgressTasks.length > 0 && (
        <div className="mt-4 flex items-start gap-2">
          <Play className="h-4 w-4 shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
              {t("digest.summary.inProgress")}
            </p>
            {taskSummary.inProgressTasks.map((task, index) => (
              <p key={index} className="text-sm font-medium text-[#25242a] dark:text-[#f5f5f5] truncate">
                {task.title}
                {task.startTime && task.endTime && (
                  <span className="font-normal text-[#6f6a72] dark:text-[#a09ba5]"> · {task.startTime} - {task.endTime}</span>
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      {taskSummary.nextUpTitle && (
        <div className="mt-3 flex items-start gap-2">
          <Clock className="h-4 w-4 shrink-0 mt-0.5 text-[#8c8691] dark:text-[#a09ba5]" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
              {t("digest.summary.nextUp")}
            </p>
            <p className="text-sm font-medium text-[#25242a] dark:text-[#f5f5f5] truncate">
              {taskSummary.nextUpTitle}
              {taskSummary.nextUpTime && taskSummary.nextUpEndTime && (
                <span className="font-normal text-[#6f6a72] dark:text-[#a09ba5]"> · {taskSummary.nextUpTime} - {taskSummary.nextUpEndTime}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="mt-4 flex flex-col items-center py-6 text-center">
          <CalendarPlus className="mb-2 h-8 w-8 text-[#b0a9b2] dark:text-[#6a6570]" />
          <p className="text-sm font-medium text-[#25242a] dark:text-[#e8e6ea]">{t("empty.today.title")}</p>
          <p className="mt-1 text-xs text-[#6a6570] dark:text-[#a09ba5]">{t("empty.today.description")}</p>
        </div>
      ) : isAllDone ? (
        <div className="mt-4 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          <p className="text-sm text-[#6f6a72] dark:text-[#a09ba5]">
            {t("digest.summary.allDone")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
