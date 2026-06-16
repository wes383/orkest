"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Plus, Trash2, Eye, EyeOff, ArrowUpDown, Calendar, ChevronDown, GripVertical, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProgressDetailSkeleton } from "@/components/ui/page-skeletons";
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
  const [showCompleted, setShowCompleted] = useState(true);
  const [sortMode, setSortMode] = useState<"added" | "startTime" | "priority">("added");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const progress = useMemo(
    () => progresses.find((p) => p.id === progressId) ?? null,
    [progresses, progressId],
  );

  useEffect(() => {
    if (!isLoaded && user) void loadProgresses(user.id);
    if (links.length === 0 && user) void loadLinks(user.id);
    if (!itemsLoaded && user) void loadItemsFromCloud(user.id);
  }, [isLoaded, links.length, loadProgresses, loadLinks, itemsLoaded, loadItemsFromCloud, user]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (sortBtnRef.current?.contains(target) || sortMenuRef.current?.contains(target)) return;
      setSortMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [sortMenuOpen]);

  const progressLinks = useMemo(
    () => links.filter((l) => l.progressId === progressId),
    [links, progressId],
  );

  const boundItemsWithLinks = useMemo(() => {
    const map = new Map<string, ManualItemRecord>();
    for (const item of manualItems) map.set(item.id, item);
    return progressLinks
      .map((link) => ({ item: map.get(link.itemId), link }))
      .filter((x): x is { item: ManualItemRecord; link: (typeof progressLinks)[0] } => {
        if (!x.item) return false;
        return !x.item.deletedAt;
      });
  }, [progressLinks, manualItems]);

  const displayItems = useMemo(() => {
    let result = [...boundItemsWithLinks];

    if (!showCompleted) {
      result = result.filter(({ item }) => item.status !== "completed");
    }

    if (sortMode === "startTime") {
      result.sort((a, b) => {
        const aVal = a.item.startDate ? a.item.startDate + (a.item.startTime ?? "") : "";
        const bVal = b.item.startDate ? b.item.startDate + (b.item.startTime ?? "") : "";
        if (!aVal && !bVal) return 0;
        if (!aVal) return 1;
        if (!bVal) return -1;
        return aVal.localeCompare(bVal);
      });
    } else if (sortMode === "priority") {
      const weight: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
      result.sort((a, b) => {
        const aw = a.item.priority ? weight[a.item.priority] ?? -1 : -1;
        const bw = b.item.priority ? weight[b.item.priority] ?? -1 : -1;
        return bw - aw;
      });
    }

    return result.map(({ item }) => item);
  }, [boundItemsWithLinks, showCompleted, sortMode]);

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
    return <ProgressDetailSkeleton />;
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

          <ProgressBar progress={stats} onValueChange={progress.trackingMode === "manual" ? handleManualChange : undefined} />

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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className={cn(
                  "flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                  showCompleted
                    ? "border-black/8 bg-transparent text-[#7d7880] hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]"
                    : "border-black/12 bg-white text-[#25242a] dark:border-white/12 dark:bg-[#2a2a2a] dark:text-[#f5f5f5]",
                )}
              >
                {showCompleted ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                <span className="max-w-[6rem] truncate">
                  {showCompleted ? t("progress.filter.hideCompleted") : t("progress.filter.showCompleted")}
                </span>
              </button>
              <div className="relative">
                <button
                  ref={sortBtnRef}
                  type="button"
                  onClick={() => setSortMenuOpen((v) => !v)}
                  className={cn(
                    "flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                    sortMenuOpen
                      ? "border-black/12 bg-white text-[#25242a] dark:border-white/12 dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"
                      : "border-black/8 bg-transparent text-[#7d7880] hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]",
                  )}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  <span className="max-w-[6rem] truncate">
                    {sortMode === "added" ? t("progress.sort.default") : sortMode === "startTime" ? t("listControls.startTime") : t("itemForm.priority")}
                  </span>
                  <ChevronDown className={cn("h-3 w-3 transition-transform", sortMenuOpen && "rotate-180")} />
                </button>
                {sortMenuOpen && typeof document !== "undefined"
                  ? createPortal(
                      <div
                        ref={sortMenuRef}
                        className="fixed z-50 w-44 rounded-xl border border-black/8 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#1f1d24] flex flex-col gap-0.5"
                        style={{
                          top: sortBtnRef.current ? sortBtnRef.current.getBoundingClientRect().bottom + 4 : 0,
                          right: sortBtnRef.current ? window.innerWidth - sortBtnRef.current.getBoundingClientRect().right : 0,
                        }}
                      >
                        {([
                          { mode: "added" as const, icon: GripVertical, label: t("progress.sort.default") },
                          { mode: "startTime" as const, icon: Calendar, label: t("listControls.startTime") },
                          { mode: "priority" as const, icon: Flag, label: t("itemForm.priority") },
                        ]).map(({ mode, icon: Icon, label }) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => { setSortMode(mode); setSortMenuOpen(false); }}
                            className={cn(
                              "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                              sortMode === mode
                                ? "bg-black/[0.05] text-[#25242a] dark:bg-white/10 dark:text-[#f5f5f5]"
                                : "text-[#7d7880] hover:bg-black/[0.035] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]",
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
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
        <ProgressBoundTaskList items={displayItems} onUnlink={handleUnlink} />
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
          <DeleteProgressDialog
            open={deleteOpen}
            progressName={progress.name}
            onCancel={() => setDeleteOpen(false)}
            onConfirm={handleConfirmDelete}
          />
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
