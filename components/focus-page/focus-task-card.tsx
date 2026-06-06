"use client";

import { useMemo } from "react";
import { CheckCircle, Circle, Pencil } from "lucide-react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useI18n } from "@/lib/i18n";
import {
  PRIORITY_CONFIG,
  formatDueDate,
  formatItemTime,
  formatRecurrence,
  toItemFromManualRecord,
  buildDisplayItems,
} from "@/lib/all-page-utils";
import { cn } from "@/lib/utils";

export function FocusTaskCard() {
  const { t } = useI18n();
  const selectedItemId = useFocusStore((s) => s.selectedItemId);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const handleToggleSubtaskComplete = useAllPageStore((s) => s.handleToggleSubtaskComplete);
  const handleToggleComplete = useAllPageStore((s) => s.handleToggleComplete);
  const openComposer = useAllPageStore((s) => s.openComposer);
  useSettingsStore((s) => s.locale);

  const item = useMemo(() => {
    if (!selectedItemId) return null;
    const record = manualItems.find((r) => r.id === selectedItemId && !r.deletedAt);
    if (!record) return null;
    const baseItem = toItemFromManualRecord(record);
    const displayItems = buildDisplayItems([baseItem]);
    return displayItems[0] ?? null;
  }, [selectedItemId, manualItems]);

  if (!item) return null;

  const subtasks = manualItems.filter(
    (r) => r.parentId === item.id && !r.deletedAt,
  );

  const completedCount = subtasks.filter((s) => s.status === "completed").length;

  return (
    <div className="rounded-xl border border-black/6 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] p-5 hover:bg-white/70 dark:hover:bg-white/[0.07]">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {formatItemTime(item) && (
                <p className="mb-2 text-sm font-medium tracking-[0.05em] tabular-nums text-[#7e7982] dark:text-[#a9a4ae] uppercase">
                  {formatItemTime(item)}
                </p>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="mb-2 -ml-0.5 flex flex-wrap items-center gap-1.5">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-200 dark:bg-white/10 px-3 py-1 text-sm font-medium text-gray-600 dark:text-[#a9a4ae]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <h4 className={cn(
                "font-display text-[clamp(1.1rem,2vw,1.5rem)] leading-[1.08] font-medium tracking-[-0.01em]",
                item.status === "completed"
                  ? "line-through text-[#b0a9b2] dark:text-[#6a6570]"
                  : "text-[#333139] dark:text-[#e8e6ea]",
              )}>
                {item.title}
              </h4>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleComplete(item);
                }}
                  className={cn(
                    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors",
                    item.status === "completed"
                      ? "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
                      : "text-green-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30",
                  )}
                title={item.status === "completed" ? t("focus.undoComplete") : t("focus.complete")}
              >
                {item.status === "completed" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openComposer(item);
                }}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
                title={t("focus.edit")}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          </div>
          {item.description ? (
            <p className="mt-3 max-w-2xl text-[1rem] leading-7 text-[#706b74] dark:text-[#a09ba5]">
              {item.description}
            </p>
          ) : null}
          {subtasks.length > 0 && (
            <div className="mt-3">
              <div className="space-y-1.5">
                {subtasks.map((subtask) => {
                  const completed = subtask.status === "completed";
                  return (
                    <button
                      key={subtask.id}
                      type="button"
                      onClick={() => handleToggleSubtaskComplete(subtask)}
                      className="group/sub flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-1 py-0.5 transition-colors hover:bg-black/2 dark:hover:bg-white/[0.04] text-left"
                    >
                      {completed ? (
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600 transition-colors group-hover/sub:text-gray-400" />
                      )}
                      <span
                        className={cn(
                          "text-sm transition-colors",
                          completed ? "text-[#b0a9b2] dark:text-[#6a6570] line-through" : "text-[#706b74] dark:text-[#a09ba5]",
                        )}
                      >
                        {subtask.title}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2 pl-1">
                <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 -rotate-90">
                  <circle cx="8" cy="8" r="5.5" fill="none" stroke="#e5e7eb" strokeWidth="3" className="dark:stroke-[#3a3840]" />
                  <circle
                    cx="8" cy="8" r="5.5" fill="none" stroke="#4ade80" strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 5.5}`}
                    strokeDashoffset={`${2 * Math.PI * 5.5 * (1 - completedCount / subtasks.length)}`}
                    className="transition-all duration-300"
                  />
                </svg>
                <span className="text-xs font-medium text-[#9f99a3] dark:text-[#8a858f]">{t("focus.subtasksCompleted", { completed: completedCount, total: subtasks.length })}</span>
              </div>
            </div>
          )}
          {(item.priority || item.time.due || item.recurrence || item.estimateMinutes) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.priority && (
                <p className={cn(
                  "text-xs font-semibold tracking-[0.05em] uppercase",
                  PRIORITY_CONFIG[item.priority].color.split(" ")[1],
                )}>
                  {PRIORITY_CONFIG[item.priority].label}
                </p>
              )}
              {item.time.due && (
                <p className="text-xs font-medium text-gray-400">
                  {t("focus.due")}: {formatDueDate(item.time.due)}
                </p>
              )}
              {item.recurrence && (
                <p className="text-xs font-medium text-gray-400">
                  {formatRecurrence(item)}
                </p>
              )}
              {item.estimateMinutes && (
                <p className="text-xs font-medium text-gray-400">
                  {item.estimateMinutes} {t("itemForm.minutes")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
