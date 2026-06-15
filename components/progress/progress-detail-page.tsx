"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress/progress-bar";
import { ProgressBoundTaskList } from "@/components/progress/progress-bound-task-list";
import { ProgressFormModal } from "@/components/progress/progress-form-modal";
import { ProgressTaskPicker } from "@/components/progress/progress-task-picker";
import { DeleteProgressDialog } from "@/components/progress/delete-progress-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { useProgressStore } from "@/lib/stores/use-progress-store";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useI18n, addLocaleToPathname } from "@/lib/i18n";
import { computeProgressStats } from "@/lib/progress/progress-stats";
import { emptyForm } from "@/lib/all-page-utils";
import type { ManualItemRecord } from "@/lib/types/all-page";

interface ProgressDetailPageProps {
  progressId: string;
}

export function ProgressDetailPage({ progressId }: ProgressDetailPageProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const progresses = useProgressStore((s) => s.progresses);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const loadProgresses = useProgressStore((s) => s.loadProgresses);
  const links = useProgressStore((s) => s.links);
  const loadLinks = useProgressStore((s) => s.loadLinks);
  const bindTasks = useProgressStore((s) => s.bindTasks);
  const unbindTask = useProgressStore((s) => s.unbindTask);
  const deleteProgress = useProgressStore((s) => s.deleteProgress);
  const setManualValue = useProgressStore((s) => s.setManualValue);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const itemsLoaded = useAllPageStore((s) => s.isLoaded);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);
  const openComposerWithForm = useAllPageStore((s) => s.openComposerWithForm);
  const undoToast = useAllPageStore((s) => s.undoToast);
  const undo = useAllPageStore((s) => s.undo);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const progress = useMemo(
    () => progresses.find((p) => p.id === progressId) ?? null,
    [progresses, progressId],
  );

  useEffect(() => {
    if (!isLoaded && user) void loadProgresses(user.id);
    if (links.length === 0 && user) void loadLinks(user.id);
    if (!itemsLoaded && user) void loadItemsFromCloud(user.id);
  }, [isLoaded, links.length, loadProgresses, loadLinks, itemsLoaded, loadItemsFromCloud, user]);

  const progressLinks = useMemo(
    () => links.filter((l) => l.progressId === progressId),
    [links, progressId],
  );

  const boundItems = useMemo(() => {
    const map = new Map<string, ManualItemRecord>();
    for (const item of manualItems) map.set(item.id, item);
    return progressLinks
      .map((l) => map.get(l.itemId))
      .filter((item): item is ManualItemRecord => Boolean(item) && !(item as ManualItemRecord).deletedAt);
  }, [progressLinks, manualItems]);

  const stats = useMemo(() => {
    if (!progress) return null;
    return computeProgressStats([progress], manualItems, links)[0] ?? null;
  }, [progress, manualItems, links]);

  const boundItemIds = useMemo(() => progressLinks.map((l) => l.itemId), [progressLinks]);

  const handleAddTasks = useCallback(
    async (itemIds: string[]) => {
      if (!user) return;
      await bindTasks(user.id, progressId, itemIds);
      setPickerOpen(false);

      const label = t("all.undoToast.linkedToProgress", { name: progress?.name ?? "" });
      useAllPageStore.getState().showUndoToast(label, () => {
        for (const itemId of itemIds) {
          void unbindTask(user.id, progressId, itemId);
        }
      });
    },
    [user, progressId, bindTasks, unbindTask, progress?.name, t],
  );

  async function handleUnlink(itemId: string) {
    if (!user) return;
    await unbindTask(user.id, progressId, itemId);

    const label = t("all.undoToast.unlinkedFromProgress", { name: progress?.name ?? "" });
    useAllPageStore.getState().showUndoToast(label, () => {
      void bindTasks(user.id, progressId, [itemId]);
    });
  }

  function handleCreateNewTask() {
    openComposerWithForm({
      ...emptyForm,
      progressIds: [progressId],
    });
  }

  async function handleConfirmDelete() {
    if (!user || !progress) return;
    await deleteProgress(user.id, progress.id);
    setDeleteOpen(false);
    router.push(addLocaleToPathname("/progress", locale));
  }

  async function handleManualChange(value: number) {
    if (!user || !progress) return;
    await setManualValue(user.id, progress.id, value);
  }

  if (!progress || !stats) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <p className="text-sm text-[#7d7880] dark:text-[#a3a3a3]">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="overflow-hidden rounded-2xl border border-black/8 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="space-y-5 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#9f99a3] uppercase">
                {t("progress.detail.overview")}
              </p>
              <h1 className="mt-1 truncate font-display text-2xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">
                {progress.name}
              </h1>
              {progress.targetDate ? (
                <p className="mt-1 text-xs text-[#7d7880] dark:text-[#a3a3a3]">
                  {t("progress.detail.target", { date: progress.targetDate })}
                </p>
              ) : null}
            </div>
            {user ? (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditOpen(true)}
                  className="h-7 px-2 text-xs"
                >
                  {t("progress.detail.edit")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteOpen(true)}
                  className="h-7 gap-1.5 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/15"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("progress.detail.delete")}
                </Button>
              </div>
            ) : null}
          </div>

          {progress.description ? (
            <p className="text-sm text-[#7d7880] dark:text-[#a3a3a3]">
              {progress.description}
            </p>
          ) : null}

          <ProgressBar progress={stats} />

          {progress.trackingMode === "manual" ? (
            <ManualValueEditor
              value={progress.manualValue}
              goalValue={progress.goalValue}
              goalUnit={progress.goalUnit}
              onChange={handleManualChange}
            />
          ) : null}
        </div>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">
            {t("progress.detail.boundTasks")}
          </h2>
          {user ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCreateNewTask}
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("progress.newTask")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setPickerOpen(true)}
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("progress.addTask")}
              </Button>
            </div>
          ) : null}
        </div>
        <ProgressBoundTaskList items={boundItems} onUnlink={handleUnlink} />
      </section>

      {user ? (
        <>
          <ProgressTaskPicker
            open={pickerOpen}
            candidates={manualItems}
            boundItemIds={boundItemIds}
            onClose={() => setPickerOpen(false)}
            onConfirm={handleAddTasks}
          />
          <ProgressFormModal
            open={editOpen}
            mode="edit"
            progressId={progressId}
            onClose={() => setEditOpen(false)}
          />
          {deleteOpen ? (
            <DeleteProgressDialog
              progressName={progress.name}
              onCancel={() => setDeleteOpen(false)}
              onConfirm={handleConfirmDelete}
            />
          ) : null}
        </>
      ) : null}

      {/* Toast: undo destructive action */}
      {undoToast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#25242a] text-white px-4 py-2.5 rounded-xl shadow-lg">
          <span className="text-sm">
            {undoToast.label}
          </span>
          <button
            type="button"
            onClick={undo}
            className="text-sm font-medium text-white/70 hover:text-white underline underline-offset-2 cursor-pointer"
          >
            {t("common.undo")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface ManualValueEditorProps {
  value: number;
  goalValue: number;
  goalUnit: string;
  onChange: (value: number) => void;
}

function ManualValueEditor({ value, goalValue, goalUnit, onChange }: ManualValueEditorProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string>(String(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  function commit(next: string) {
    const parsed = Number(next);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 99999999 && parsed !== value) {
      onChange(Math.min(99999999, parsed));
    } else {
      setDraft(String(value));
    }
  }

  return (
    <div>
      <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
        {t("progress.manualValue")}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={99999999}
          step="1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-32 rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-[#25242a] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5]"
        />
        <span className="text-xs text-[#7d7880] dark:text-[#a3a3a3]">
          / {goalValue} {goalUnit}
        </span>
      </div>
    </div>
  );
}
