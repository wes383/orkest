"use client";

import { Bell, Trash2, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import type { AiBatchPreviewItem } from "@/lib/ai/chat-types";
import {
  formatReviewDate,
  formatReviewTime,
  buildScheduleSummary,
  buildRecurrenceSummary,
  buildOriginalSchedule,
  buildOriginalSummary,
} from "@/lib/ai/chat-types";
import { PRIORITY_CONFIG } from "@/lib/all-page-utils";
import { useI18n } from "@/lib/i18n";

type BatchPreviewItemRendererProps = {
  item: AiBatchPreviewItem;
  index: number;
  projects: Array<{ id: string; name: string }>;
  onToggleSelection: (index: number, selected: boolean) => void;
  onEdit: (index: number) => void;
  isFullscreen?: boolean;
};

export function BatchPreviewItemRenderer({
  item,
  index,
  projects,
  onToggleSelection,
  onEdit,
  isFullscreen,
}: BatchPreviewItemRendererProps) {
  const { t } = useI18n();
  const reviewSchedule = buildScheduleSummary(item.formState);
  const reviewRecurrence = buildRecurrenceSummary(item.formState, t);
  const reviewDueDate = item.formState.hasDueDate ? formatReviewDate(item.formState.dueDate) : null;
  const reviewMetaCount = [reviewSchedule, reviewDueDate].filter(Boolean).length;
  const projectLabel =
    item.formState.projectName ||
    projects.find((project) => project.id === item.formState.projectId)?.name ||
    "";
  const actionLabel =
    item.kind === "delete"
      ? t("ai.batch.deleteTitle", { index: index + 1 })
      : item.kind === "update"
        ? `Update ${index + 1}`
        : `Draft ${index + 1}`;

  return (
    <div
      key={item.id}
      className={`rounded-2xl border p-4 transition-colors ${isFullscreen ? "max-w-2xl" : ""} ${
        item.kind === "delete" && item.selected
          ? "border-red-200/70 bg-red-50/45 dark:border-red-900/30 dark:bg-red-950/15"
          : item.selected
            ? "border-black/10 bg-white/85 dark:border-white/10 dark:bg-zinc-900/85"
            : "border-black/6 bg-white/55 opacity-80 dark:border-white/5 dark:bg-zinc-900/55"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={item.selected}
            onCheckedChange={(checked) => onToggleSelection(index, checked === true)}
            className="mt-0.5"
          />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8c8691] dark:text-[#a19da6] uppercase">
              {actionLabel}
            </p>
            {item.reason ? (
              <p className="mt-1 max-w-64 text-xs leading-5 text-[#7d7880] dark:text-zinc-400">{item.reason}</p>
            ) : null}
          </div>
        </div>
        {item.kind === "delete" ? (
          <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-red-200 bg-white/70 px-3 text-xs font-medium text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
            {t("ai.batch.delete")}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(index)}
            className="h-8 gap-1.5 text-xs dark:border-white/10 dark:hover:bg-zinc-800"
          >
            <PencilLine className="h-3.5 w-3.5" />
            {t("common.edit")}
          </Button>
        )}
      </div>

      {(item.kind === "update" || item.kind === "delete") && item.originalForm ? (
        <div className="mb-3 rounded-2xl border border-red-200/50 bg-red-50/30 p-3 dark:border-red-900/30 dark:bg-red-950/15">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-red-500/70 dark:text-red-400/60 uppercase">
            {item.kind === "delete" ? t("ai.batch.willDelete") : t("ai.batch.original")}
          </p>
          <h4 className="mt-1 text-base font-semibold text-red-600/80 dark:text-red-400/90">
            {item.originalForm.title || t("ai.untitledItem")}
          </h4>
          {item.originalForm.description ? (
            <p className="mt-1.5 text-sm text-red-500/70 dark:text-red-400/70 line-clamp-2">
              {item.originalForm.description}
            </p>
          ) : null}
          {buildOriginalSchedule(item.originalForm) ? (
            <p className="mt-2 text-xs text-red-500/60 dark:text-red-400/50">{buildOriginalSchedule(item.originalForm)}</p>
          ) : null}
          <p className="mt-1 text-xs text-red-500/60 dark:text-red-400/50">{buildOriginalSummary(item.originalForm, t)}</p>
        </div>
      ) : null}

      {item.kind === "delete" ? null : (
      <div className="rounded-2xl border border-black/8 bg-white/80 p-4 dark:border-white/10 dark:bg-zinc-900/80">
        <h3 className="text-lg font-semibold text-[#25242a] dark:text-zinc-100">
          {item.formState.title || t("ai.untitledItem")}
        </h3>
        {projectLabel ? (
          <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">{projectLabel}</p>
        ) : null}
        {item.formState.description ? (
          <p className="mt-2 text-sm leading-6 text-[#5f5a63] dark:text-zinc-400">{item.formState.description}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {item.formState.priority ? (
            <span className={`rounded-full border px-3 py-1.5 text-xs font-medium ${PRIORITY_CONFIG[item.formState.priority].color}`}>
              {PRIORITY_CONFIG[item.formState.priority].label}
            </span>
          ) : null}
          {item.formState.estimateMinutes ? (
            <span className="rounded-full border border-black/8 bg-[#fafafa] px-3 py-1.5 text-xs font-medium text-[#5f5a63] dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300">
              {item.formState.estimateMinutes} min
            </span>
          ) : null}
          {item.formState.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-black/8 bg-[#fafafa] px-3 py-1.5 text-xs font-medium text-[#5f5a63] dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {tag}
            </span>
          ))}
          {item.formState.reminders && item.formState.reminders.length > 0 && item.formState.reminders.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1 rounded-full border border-black/8 bg-[#fafafa] px-3 py-1.5 text-xs font-medium text-[#5f5a63] dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <Bell className="h-3 w-3" />
              <span>{r.dayOffset != null || r.triggerTime != null
                ? (() => {
                    const time = r.triggerTime ?? "09:00";
                    const days = r.dayOffset ?? 0;
                    if (days === 0) return t("reminder.sameDayAt", { time });
                    if (days % 7 === 0) return t("reminder.timeWeekAt", { weeks: days / 7, time });
                    return t("reminder.timeDayAt", { days, time });
                  })()
                : t("reminder.timeBefore", { time: r.minutesBefore < 60
                    ? t("reminder.timeMin", { minutes: r.minutesBefore })
                    : r.minutesBefore < 1440
                      ? t("reminder.timeHour", { hours: Math.floor(r.minutesBefore / 60) })
                      : r.minutesBefore < 10080
                        ? t("reminder.timeDay", { days: Math.floor(r.minutesBefore / 1440) })
                        : t("reminder.timeWeek", { weeks: Math.floor(r.minutesBefore / 10080) })
                  })
              }</span>
              <span className="text-gray-300 dark:text-[#555]">·</span>
              <span>{r.method === "push" ? t("reminder.methodPush") : t("reminder.methodEmail")}</span>
            </span>
          ))}
        </div>
      </div>
      )}

      {item.kind !== "delete" && item.formState.subtasks.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-black/8 bg-white/80 p-4 space-y-1.5 dark:border-white/10 dark:bg-zinc-900/80">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8c8691] dark:text-zinc-400 uppercase">Subtasks</p>
          <ul className="space-y-1">
            {item.formState.subtasks.map((subtask) => (
              <li key={subtask.id} className="flex items-center gap-2 text-sm text-[#3c3841] dark:text-zinc-300">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/15 dark:border-white/20" />
                {subtask.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {item.kind !== "delete" ? (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {reviewSchedule ? (
          <div className={`rounded-2xl border border-black/8 bg-white/70 p-3 dark:border-white/10 dark:bg-zinc-900/70 ${reviewMetaCount === 1 ? "sm:col-span-2" : ""}`}>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8c8691] dark:text-zinc-400 uppercase">Schedule</p>
            <p className="mt-1 text-sm leading-6 text-[#3c3841] dark:text-zinc-300">{reviewSchedule}</p>
          </div>
        ) : null}
        {reviewDueDate ? (
          <div className={`rounded-2xl border border-black/8 bg-white/70 p-3 dark:border-white/10 dark:bg-zinc-900/70 ${reviewMetaCount === 1 ? "sm:col-span-2" : ""}`}>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8c8691] dark:text-zinc-400 uppercase">Due Date</p>
            <p className="mt-1 text-sm leading-6 text-[#3c3841] dark:text-zinc-300">{reviewDueDate}</p>
          </div>
        ) : null}
        {reviewRecurrence ? (
          <div className="rounded-2xl border border-black/8 bg-white/70 p-3 sm:col-span-2 dark:border-white/10 dark:bg-zinc-900/70">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8c8691] dark:text-zinc-400 uppercase">Recurrence</p>
            <p className="mt-1 text-sm leading-6 text-[#3c3841] dark:text-zinc-300">{reviewRecurrence}</p>
          </div>
        ) : null}
      </div>
      ) : null}

      {item.conflicts && item.conflicts.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-3 dark:border-amber-950/30 dark:bg-amber-950/15">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-amber-700/80 dark:text-amber-500/70 uppercase">Conflicts</p>
          <div className="mt-2 space-y-1.5">
            {item.conflicts.map((conflict) => (
              <p key={`${item.id}-${conflict.itemId}`} className="text-xs leading-5 text-amber-800 dark:text-amber-400">
                {conflict.title} at {formatReviewDate(conflict.startDate)} {formatReviewTime(conflict.startTime)}
              </p>
            ))}
          </div>
          {item.suggestions && item.suggestions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.suggestions.map((suggestion) => (
                <span
                  key={`${suggestion.startDate}-${suggestion.startTime}-${suggestion.endTime}`}
                  className="rounded-full border border-amber-200 bg-white/75 px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                >
                  {formatReviewDate(suggestion.startDate)} {formatReviewTime(suggestion.startTime)}-{formatReviewTime(suggestion.endTime)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
