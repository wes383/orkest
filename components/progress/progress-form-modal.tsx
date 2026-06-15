"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { ProgressColorPicker } from "./progress-color-picker";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/auth-provider";
import { useProgressStore } from "@/lib/stores/use-progress-store";
import { useScrollLock } from "@/lib/hooks/use-scroll-lock";
import { normalizeProjectColor, DEFAULT_PROJECT_COLOR } from "@/lib/projects/color-palette";
import type { Progress, ProgressTrackingMode } from "@/lib/types/progress";

interface ProgressFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  progressId?: string;
  onClose: () => void;
  onSubmitted?: (progressId: string) => void;
}

export function ProgressFormModal({ open, mode, progressId, onClose, onSubmitted }: ProgressFormModalProps) {
  const progresses = useProgressStore((s) => s.progresses);
  const editing = useMemo<Progress | null>(
    () =>
      mode === "edit" && progressId
        ? progresses.find((p) => p.id === progressId) ?? null
        : null,
    [mode, progressId, progresses],
  );

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <ProgressFormModalBody
      key={`${mode}-${editing?.id ?? "new"}-${open ? "1" : "0"}`}
      mode={mode}
      editing={editing}
      onClose={onClose}
      onSubmitted={onSubmitted}
    />
  );
}

interface ProgressFormModalBodyProps {
  mode: "create" | "edit";
  editing: Progress | null;
  onClose: () => void;
  onSubmitted?: (progressId: string) => void;
}

function ProgressFormModalBody({ mode, editing, onClose, onSubmitted }: ProgressFormModalBodyProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const progresses = useProgressStore((s) => s.progresses);
  const links = useProgressStore((s) => s.links);
  const createProgress = useProgressStore((s) => s.createProgress);
  const updateProgress = useProgressStore((s) => s.updateProgress);
  const deleteProgress = useProgressStore((s) => s.deleteProgress);

  const [name, setName] = useState<string>(editing?.name ?? "");
  const [description, setDescription] = useState<string>(editing?.description ?? "");
  const [goalValue, setGoalValue] = useState<number>(editing?.goalValue ?? 10);
  const [goalUnit, setGoalUnit] = useState<string>(editing?.goalUnit ?? "tasks");
  const [trackingMode, setTrackingMode] = useState<ProgressTrackingMode>(
    editing?.trackingMode ?? "count",
  );
  const [manualValue, setManualValue] = useState<number>(editing?.manualValue ?? 0);
  const [color, setColor] = useState<string>(
    editing ? normalizeProjectColor(editing.color) : DEFAULT_PROJECT_COLOR,
  );
  const [targetDate, setTargetDate] = useState<string>(editing?.targetDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const boundCount = useMemo(() => {
    if (!editing) return 0;
    return links.filter((l) => l.progressId === editing.id).length;
  }, [editing, links]);

  const isTaskAuto = trackingMode === "count" || trackingMode === "percentage";
  const effectiveGoalValue = isTaskAuto ? Math.max(1, boundCount) : goalValue;
  const effectiveGoalUnit = isTaskAuto ? "tasks" : goalUnit;

  const trimmedName = name.trim();
  const isDuplicate = progresses.some(
    (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== editing?.id,
  );
  const canSave =
    trimmedName.length > 0 &&
    trimmedName.length <= 80 &&
    Number.isFinite(effectiveGoalValue) &&
    effectiveGoalValue > 0 &&
    effectiveGoalUnit.trim().length > 0 &&
    effectiveGoalUnit.length <= 40 &&
    manualValue >= 0 &&
    !isDuplicate &&
    !isSubmitting;

  async function handleSave() {
    if (!canSave || !user) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const safeColor = normalizeProjectColor(color);
      const finalGoalValue = effectiveGoalValue;
      const finalGoalUnit = isTaskAuto ? "tasks" : goalUnit.trim();
      if (mode === "create") {
        const created = await createProgress(user.id, {
          name: trimmedName,
          description: description.trim() || undefined,
          goalValue: finalGoalValue,
          goalUnit: finalGoalUnit,
          trackingMode,
          manualValue,
          color: safeColor,
          targetDate: targetDate || undefined,
        });
        if (!created) {
          setError(t("progress.error.createFailed"));
          return;
        }
        onSubmitted?.(created.id);
      } else if (editing) {
        const ok = await updateProgress(user.id, editing.id, {
          name: trimmedName,
          description: description.trim() || undefined,
          goalValue: finalGoalValue,
          goalUnit: finalGoalUnit,
          trackingMode,
          manualValue,
          color: safeColor,
          targetDate: targetDate || undefined,
        });
        if (!ok) {
          setError(t("progress.error.updateFailed"));
          return;
        }
        onSubmitted?.(editing.id);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editing || !user) return;
    setIsSubmitting(true);
    try {
      const ok = await deleteProgress(user.id, editing.id);
      if (ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-white/35 backdrop-blur-[5px] dark:bg-black/50"
      />
      <div className="relative z-10 flex w-full max-w-md max-h-[85vh] flex-col overflow-clip rounded-2xl border border-black/8 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.16)] dark:border-white/10 dark:bg-[#202020]">
        <div className="shrink-0 flex items-center justify-between border-b border-black/6 px-5 py-4 dark:border-white/8">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#9f99a3] uppercase dark:text-[#737373]">
              {mode === "create" ? t("progress.newProgress") : t("progress.editProgress")}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">
              {trimmedName || t("progress.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.04] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 px-5 py-4">
          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
              {t("progress.title")}
            </label>
            <input
              type="text"
              autoFocus
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("progress.namePlaceholder")}
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-[#25242a] placeholder:text-[#9f99a3] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5]"
            />
            {isDuplicate ? (
              <p className="mt-1.5 text-xs text-red-500">{t("progress.error.duplicate")}</p>
            ) : null}
            {error ? (
              <p className="mt-1.5 text-xs text-red-500">{error}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
              {t("progress.descriptionLabel")}
            </label>
            <textarea
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("progress.descriptionPlaceholder")}
              className="min-h-[60px] w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-[#25242a] placeholder:text-[#9f99a3] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                {t("progress.goalValue")}
              </label>
              <input
                type="number"
                min={isTaskAuto ? 0 : 0.01}
                step="0.01"
                value={isTaskAuto ? effectiveGoalValue : goalValue}
                disabled={isTaskAuto}
                readOnly={isTaskAuto}
                onChange={(e) => setGoalValue(Number(e.target.value))}
                className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-[#25242a] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-[#9f99a3] dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5] dark:disabled:bg-white/[0.04] dark:disabled:text-[#737373]"
              />
              {isTaskAuto ? (
                <p className="mt-1 text-[11px] text-[#9f99a3] dark:text-[#737373]">
                  {t("progress.goalAutoFromTasks", { count: boundCount })}
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                {t("progress.goalUnit")}
              </label>
              <input
                type="text"
                maxLength={40}
                value={isTaskAuto ? effectiveGoalUnit : goalUnit}
                disabled={isTaskAuto}
                readOnly={isTaskAuto}
                onChange={(e) => setGoalUnit(e.target.value)}
                placeholder={t("progress.goalUnitPlaceholder")}
                className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-[#25242a] placeholder:text-[#9f99a3] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-[#9f99a3] dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5] dark:disabled:bg-white/[0.04] dark:disabled:text-[#737373]"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
              {t("progress.trackingMode")}
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {(["count", "percentage", "manual"] as ProgressTrackingMode[]).map((mode) => (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    trackingMode === mode
                      ? "border-blue-500 bg-blue-50 dark:border-blue-400/60 dark:bg-blue-500/10"
                      : "border-black/8 hover:border-black/15 dark:border-white/10 dark:hover:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="trackingMode"
                    className="mt-0.5"
                    checked={trackingMode === mode}
                    onChange={() => setTrackingMode(mode)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-[#25242a] dark:text-[#f5f5f5]">
                      {t(`progress.trackingMode.${mode}`)}
                    </p>
                    <p className="mt-0.5 text-xs text-[#7d7880] dark:text-[#a3a3a3]">
                      {mode === "count"
                        ? t("progress.countModeHint")
                        : mode === "percentage"
                          ? t("progress.percentModeHint")
                          : t("progress.manualScaleHint")}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {trackingMode === "manual" ? (
            <div>
              <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                {t("progress.manualValue")}
              </label>
              <input
                type="number"
                min={0}
                max={99999999}
                step="1"
                value={manualValue}
                onChange={(e) => setManualValue(Math.min(99999999, Math.max(0, Number(e.target.value))))}
                className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-[#25242a] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5]"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
              {t("progress.targetDate")}
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-[#25242a] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5]"
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
              {t("progress.color")}
            </label>
            <ProgressColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        </div>

        <div className="shrink-0 flex items-center justify-between border-t border-black/6 px-5 py-3 dark:border-white/8">
          <div>
            {mode === "edit" && editing ? (
              confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-[#7d7880] dark:text-[#a3a3a3]">
                    {t("progress.deleteSubtitle")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmingDelete(false)}
                    className="h-7 px-2 text-xs"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="h-7 gap-1.5 bg-red-500 px-2.5 text-xs text-white hover:bg-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("progress.deleteConfirm")}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                  className="h-7 gap-1.5 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/15"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("common.delete")}
                </Button>
              )
            ) : null}
          </div>
          {!confirmingDelete ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose} className="h-8 px-3 text-xs">
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="h-8 px-3 text-xs"
              >
                {mode === "create" ? t("progress.create") : t("progress.save")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
