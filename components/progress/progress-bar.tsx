"use client";

import { useI18n } from "@/lib/i18n";
import { withAlpha } from "@/lib/projects/color-palette";
import type { ProgressWithStats } from "@/lib/progress/progress-stats";

interface ProgressBarProps {
  progress: ProgressWithStats;
  compact?: boolean;
}

export function ProgressBar({ progress, compact = false }: ProgressBarProps) {
  const { t } = useI18n();
  const color = progress.color ?? "#6b7280";
  const pct = Math.min(100, Math.max(0, progress.percent));

  return (
    <div className="space-y-1.5">
      <div className={`w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10 ${compact ? "h-1.5" : "h-2"}`}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: withAlpha(color, 0.95),
          }}
        />
      </div>
      {compact ? (
        <div className="flex items-center justify-between text-[11px] text-[#9f99a3] dark:text-[#737373]">
          <span>
            {progress.trackingMode === "percentage"
              ? t("progress.percentComplete", { percent: Math.round(pct) })
              : progress.trackingMode === "count"
              ? t("progress.summary.completedFraction", {
                  completed: progress.completed,
                  total: progress.boundTaskCount,
                })
              : t("progress.currentOfGoal", {
                  current: progress.currentValue,
                  goal: progress.goalValue,
                  unit: progress.goalUnit,
                })}
          </span>
          {progress.trackingMode === "count" && progress.total > 0 ? (
            <span>{t("progress.tasks", { count: progress.total })}</span>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-[#9f99a3] dark:text-[#737373]">
          <span>
            {progress.trackingMode === "percentage"
              ? t("progress.percentComplete", { percent: Math.round(pct) })
              : progress.trackingMode === "count"
              ? t("progress.summary.completedFraction", {
                  completed: progress.completed,
                  total: progress.boundTaskCount,
                })
              : t("progress.currentOfGoal", {
                  current: progress.currentValue,
                  goal: progress.goalValue,
                  unit: progress.goalUnit,
                })}
          </span>
          {progress.trackingMode === "count" && progress.total > 0 ? (
            <span>{t("progress.tasks", { count: progress.total })}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
