"use client";

import { Clock, AlertTriangle, Calendar, Timer } from "lucide-react";

import type { Priority } from "@/lib/types/item";
import { PRIORITY_CONFIG, getPriorityLabel } from "@/lib/all-page-utils";
import { useI18n } from "@/lib/i18n";

export type AiDailyBriefingTask = {
  id: string;
  title: string;
  priority?: Priority;
  startTime?: string;
  endTime?: string;
  estimateMinutes?: number;
  hasTime?: boolean;
  allDay?: boolean;
  status?: string;
  dueDate?: string;
};

export type AiDailyBriefingConflict = {
  task1: string;
  task2: string;
  overlapStart: string;
  overlapEnd: string;
};

export type AiDailyBriefingData = {
  date: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  allDayEvents: Array<{ title: string; estimateMinutes?: number }>;
  totalEstimatedMinutes: number;
  topPriorities: AiDailyBriefingTask[];
  conflicts: AiDailyBriefingConflict[];
};

type AiDailyBriefingCardProps = {
  data: AiDailyBriefingData;
  isFullscreen?: boolean;
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function AiDailyBriefingCard({ data, isFullscreen }: AiDailyBriefingCardProps) {
  const { t } = useI18n();
  const completionRate = data.totalTasks > 0 
    ? Math.round((data.completedTasks / data.totalTasks) * 100) 
    : 0;

  return (
    <div className={`my-2.5 rounded-2xl border border-black/8 bg-white/80 p-4 dark:border-white/10 dark:bg-white/6 ${isFullscreen ? "max-w-2xl" : ""}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#7e7982] dark:text-[#a3a3a3]" />
          <p className="text-xs font-semibold tracking-[0.15em] text-[#8c8691] uppercase dark:text-[#737373]">
            {t("briefing.title")}
          </p>
        </div>
        <p className="text-xs font-medium text-[#7e7982] dark:text-[#a3a3a3]">
          {data.date}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        {/* Total Tasks */}
        <div className="rounded-lg bg-black/[0.03] p-2 dark:bg-white/[0.06]">
          <p className="text-[10px] font-medium text-[#8c8691] dark:text-[#737373]">{t("briefing.total")}</p>
          <p className="text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">{data.totalTasks}</p>
        </div>

        {/* Completed */}
        <div className="rounded-lg bg-green-50 p-2 dark:bg-green-900/20">
          <p className="text-[10px] font-medium text-green-600 dark:text-green-400">{t("briefing.completed")}</p>
          <p className="text-lg font-semibold text-green-700 dark:text-green-300">{data.completedTasks}</p>
        </div>

        {/* Remaining */}
        <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20">
          <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400">{t("briefing.remaining")}</p>
          <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">{data.remainingTasks}</p>
        </div>

        {/* Estimated Time */}
        <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-900/20">
          <div className="flex items-center gap-1">
            <Timer className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            <p className="text-[10px] font-medium text-purple-600 dark:text-purple-400">{t("briefing.estTime")}</p>
          </div>
          <p className="text-lg font-semibold text-purple-700 dark:text-purple-300">
            {formatMinutes(data.totalEstimatedMinutes)}
          </p>
        </div>
      </div>

      {/* Completion Progress Bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-medium text-[#8c8691] dark:text-[#737373]">{t("briefing.progress")}</p>
          <p className="text-[10px] font-semibold text-[#25242a] dark:text-[#f5f5f5]">{completionRate}%</p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]">
          <div 
            className="h-full rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* All-Day Events */}
      {data.allDayEvents.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-semibold tracking-[0.1em] text-[#8c8691] uppercase dark:text-[#737373]">
            {t("briefing.allDayEvents")}
          </p>
          <div className="space-y-1">
            {data.allDayEvents.map((event, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg bg-orange-50 px-2.5 py-1.5 dark:bg-orange-900/20">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">{event.title}</span>
                </div>
                {event.estimateMinutes && (
                  <span className="text-[10px] text-orange-600 dark:text-orange-400">
                    {formatMinutes(event.estimateMinutes)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Priorities */}
      {data.topPriorities.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-semibold tracking-[0.1em] text-[#8c8691] uppercase dark:text-[#737373]">
            {t("briefing.topPriorities")}
          </p>
          <div className="space-y-1.5">
            {data.topPriorities.map((task) => {
              const priorityConfig = task.priority ? PRIORITY_CONFIG[task.priority] : null;
              return (
                <div key={task.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-[#25242a] dark:text-[#f5f5f5]">{task.title}</p>
                      {priorityConfig && (
                        <span className={`text-[10px] font-semibold ${priorityConfig.color.split(" ")[1]}`}>
                          {task.priority ? getPriorityLabel(task.priority) : ""}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[#8c8691] dark:text-[#737373]">
                      {task.startTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {task.startTime}{task.endTime ? ` - ${task.endTime}` : ""}
                        </span>
                      )}
                      {task.estimateMinutes && (
                        <span>{formatMinutes(task.estimateMinutes)}</span>
                      )}
                      {task.dueDate && (
                        <span>Due: {task.dueDate}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conflicts */}
      {data.conflicts.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-[0.1em] text-orange-600 uppercase dark:text-orange-400">
            <AlertTriangle className="h-3 w-3" />
            {t("briefing.conflictsDetected")}
          </p>
          <div className="space-y-1">
            {data.conflicts.map((conflict, index) => (
              <div key={index} className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 dark:border-orange-800 dark:bg-orange-900/20">
                <p className="text-[10px] text-orange-700 dark:text-orange-300">
                  <span className="font-medium">{conflict.task1}</span>
                  {" & "}
                  <span className="font-medium">{conflict.task2}</span>
                  {" " + t("briefing.overlap") + " "}
                  <span className="font-mono">{conflict.overlapStart} - {conflict.overlapEnd}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
