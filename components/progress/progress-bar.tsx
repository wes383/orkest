"use client";

import { useCallback, useRef } from "react";

import { useI18n } from "@/lib/i18n";
import { withAlpha } from "@/lib/projects/color-palette";
import type { ProgressWithStats } from "@/lib/progress/progress-stats";

interface ProgressBarProps {
  progress: ProgressWithStats;
  compact?: boolean;
  /** When provided, the bar becomes draggable for manual value adjustment. */
  onValueChange?: (newValue: number) => void;
}

export function ProgressBar({ progress, compact = false, onValueChange }: ProgressBarProps) {
  const { t } = useI18n();
  const color = progress.color ?? "#6b7280";
  const pct = Math.min(100, Math.max(0, progress.percent));
  const isDraggable = Boolean(onValueChange) && progress.trackingMode === "manual";
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const computeValueFromX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return progress.currentValue;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const newValue = Math.round(ratio * progress.goalValue);
      return Math.min(progress.goalValue, Math.max(0, newValue));
    },
    [progress.goalValue, progress.currentValue],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onValueChange || !isDraggable) return;
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      onValueChange(computeValueFromX(e.clientX));
    },
    [onValueChange, isDraggable, computeValueFromX],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !onValueChange) return;
      e.preventDefault();
      e.stopPropagation();
      onValueChange(computeValueFromX(e.clientX));
    },
    [onValueChange, computeValueFromX],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [],
  );

  const dotSize = compact ? 12 : 16;

  return (
    <div className="space-y-1.5">
      <div
        ref={trackRef}
        onClick={isDraggable ? (e) => e.stopPropagation() : undefined}
        className={`group relative w-full overflow-visible rounded-full bg-black/5 dark:bg-white/10 ${
          compact ? "h-1.5" : "h-2"
        }`}
      >
        <div
          className={`h-full rounded-full ${draggingRef.current ? "" : "transition-all"}`}
          style={{
            width: `${pct}%`,
            backgroundColor: withAlpha(color, 0.95),
          }}
        />
        {isDraggable ? (
          <div
            role="slider"
            aria-valuemin={0}
            aria-valuemax={progress.goalValue}
            aria-valuenow={progress.currentValue}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-none rounded-full border-2 border-white bg-current opacity-0 shadow-md transition-opacity group-hover:opacity-100 hover:!opacity-100 data-[dragging=true]:opacity-100 dark:border-[#101010]"
            style={{
              left: `${pct}%`,
              color: withAlpha(color, 0.95),
              width: `${dotSize}px`,
              height: `${dotSize}px`,
            }}
            data-dragging={draggingRef.current}
          />
        ) : null}
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
