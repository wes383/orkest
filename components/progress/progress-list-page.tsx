"use client";

import { Eye, EyeOff, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ProgressPageSkeleton } from "@/components/ui/page-skeletons";
import { ProgressFormModal } from "@/components/progress/progress-form-modal";
import { ProgressSortMenu } from "@/components/progress/progress-sort-menu";
import { ProgressBar } from "@/components/progress/progress-bar";
import { DeleteProgressDialog } from "@/components/progress/delete-progress-dialog";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProgressStore } from "@/lib/stores/use-progress-store";
import { useI18n, addLocaleToPathname } from "@/lib/i18n";
import { normalizeProjectColor, withAlpha } from "@/lib/projects/color-palette";
import { computeProgressStats, sortProgresses } from "@/lib/progress/progress-stats";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

function useMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function ProgressListPage() {
  const mounted = useMounted();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const progresses = useProgressStore((s) => s.progresses);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const sortMode = useProgressStore((s) => s.sortMode);
  const setSortMode = useProgressStore((s) => s.setSortMode);
  const deleteProgress = useProgressStore((s) => s.deleteProgress);
  const setManualValue = useProgressStore((s) => s.setManualValue);
  const reorderProgresses = useProgressStore((s) => s.reorderProgresses);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const links = useProgressStore((s) => s.links);
  const setSelectedItem = useAllPageStore((s) => s.setSelectedItem);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localOrdered, setLocalOrdered] = useState<typeof sorted | null>(null);

  const containerRef = useRef<HTMLUListElement>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollDirectionRef = useRef<"up" | "down" | null>(null);
  const scrollSpeedRef = useRef<number>(0);

  const progressWithStats = useMemo(
    () => computeProgressStats(progresses, manualItems, links),
    [progresses, manualItems, links],
  );

  const visibleProgresses = useMemo(
    () =>
      showCompleted
        ? progressWithStats
        : progressWithStats.filter((p) => p.percent < 100),
    [progressWithStats, showCompleted],
  );

  const sorted = useMemo(
    () => sortProgresses(visibleProgresses, sortMode),
    [visibleProgresses, sortMode],
  );

  // Reset in-flight drag state when the visibility filter changes so the
  // snapshot doesn't drift out of sync with the new visible list.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalOrdered(null);
    setDraggedIndex(null);
  }, [showCompleted]);

  const displayProgresses = localOrdered ?? sorted;

  const deletingProgress = useMemo(
    () => progresses.find((p) => p.id === deletingId) ?? null,
    [progresses, deletingId],
  );

  const handleOpen = useCallback(
    (id: string) => {
      router.push(addLocaleToPathname(`/progress/${id}`, locale));
    },
    [router, locale],
  );

  // Auto-scroll the container when the user drags near the top/bottom edge.
  function startScrollLoop() {
    if (scrollIntervalRef.current) return;
    scrollIntervalRef.current = setInterval(() => {
      const container = containerRef.current;
      if (!container || !scrollDirectionRef.current) return;
      const speed = scrollSpeedRef.current;
      if (scrollDirectionRef.current === "up") {
        container.scrollTop -= speed;
      } else if (scrollDirectionRef.current === "down") {
        container.scrollTop += speed;
      }
    }, 16);
  }

  function stopScrollLoop() {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    scrollDirectionRef.current = null;
    scrollSpeedRef.current = 0;
  }

  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    setLocalOrdered([...sorted]);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const threshold = 35;
    const maxSpeed = 10;
    if (relativeY < threshold && container.scrollTop > 0) {
      scrollDirectionRef.current = "up";
      const intensity = (threshold - Math.max(0, relativeY)) / threshold;
      scrollSpeedRef.current = Math.ceil(intensity * maxSpeed);
      startScrollLoop();
    } else if (
      relativeY > rect.height - threshold &&
      container.scrollTop < container.scrollHeight - container.clientHeight
    ) {
      scrollDirectionRef.current = "down";
      const intensity = Math.max(0, relativeY - (rect.height - threshold)) / threshold;
      scrollSpeedRef.current = Math.ceil(intensity * maxSpeed);
      startScrollLoop();
    } else {
      scrollDirectionRef.current = null;
      scrollSpeedRef.current = 0;
    }
  }

  function handleDragEnter(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex === null || draggedIndex === targetIndex || !localOrdered) {
      return;
    }
    const list = [...localOrdered];
    const [draggedItem] = list.splice(draggedIndex, 1);
    list.splice(targetIndex, 0, draggedItem);
    setLocalOrdered(list);
    setDraggedIndex(targetIndex);
  }

  function handleDragEnd() {
    stopScrollLoop();
    if (localOrdered && user) {
      void reorderProgresses(
        user.id,
        localOrdered.map((p) => p.id),
      );
    }
    setDraggedIndex(null);
    setLocalOrdered(null);
  }

  async function handleConfirmDelete() {
    if (!user || !deletingProgress) return;
    await deleteProgress(user.id, deletingProgress.id);
    setDeletingId(null);
  }

  if (!mounted || !isLoaded) {
    return <ProgressPageSkeleton />;
  }

  return (
    <section
      className="relative min-h-screen bg-[#fcfbfa] px-4 py-8 text-[#2b2a30] transition-[padding] duration-300 ease-in-out sm:px-14 lg:px-14 lg:py-12 group-data-[sidebar-collapsed=true]/sidebar:lg:pl-32 group-data-[sidebar-collapsed=true]/sidebar:lg:pr-24 dark:bg-[#101010] dark:text-[#d4d4d4]"
      onClick={() => setSelectedItem(null)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#fcfbfa] via-[#fcfbfa]/70 to-[#fcfbfa]/0 dark:from-[#101010] dark:via-[#101010]/70 dark:to-[#101010]/0 sm:hidden"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 lg:gap-10">
        <header className="flex items-center gap-1.5 px-2 lg:px-3">
          {user ? (
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
                showCompleted
                  ? "border-black/8 bg-transparent text-[#7d7880] hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]"
                  : "border-black/12 bg-white text-[#25242a] dark:border-white/12 dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"
              }`}
              title={
                showCompleted
                  ? t("progress.filter.hideCompleted")
                  : t("progress.filter.showCompleted")
              }
            >
              {showCompleted ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              <span className="max-w-[6rem] truncate">
                {showCompleted
                  ? t("progress.filter.hideCompleted")
                  : t("progress.filter.showCompleted")}
              </span>
            </button>
          ) : null}
          <div className="flex-1" />
          <ProgressSortMenu sortMode={sortMode} onChange={setSortMode} />
          {user ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-transparent px-2.5 text-[11px] font-medium text-[#7d7880] transition-colors hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]"
            >
              <Plus className="h-3 w-3" />
              <span>{t("progress.newProgress")}</span>
            </button>
          ) : null}
        </header>

        {sorted.length === 0 ? (
          <div className="px-2 lg:px-3">
            <EmptyState
              icon={TrendingUp}
              title={t("progress.empty.title")}
              description={t("progress.empty.description")}
              action={
                user
                  ? {
                      label: t("progress.empty.cta"),
                      onClick: () => setCreateOpen(true),
                      icon: Plus,
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <ul
            ref={containerRef}
            onDragOver={sortMode === "default" ? handleDragOver : undefined}
            onDragEnter={sortMode === "default" ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } : undefined}
            className="flex flex-col gap-3 px-2 lg:px-3"
          >
            {displayProgresses.map((progress, index) => {
              const color = normalizeProjectColor(progress.color);
              return (
                <li key={progress.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    draggable={sortMode === "default"}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={sortMode === "default" ? handleDragOver : undefined}
                    onDragEnter={sortMode === "default" ? (e) => handleDragEnter(e, index) : undefined}
                    onDragEnd={sortMode === "default" ? handleDragEnd : undefined}
                    onClick={() => handleOpen(progress.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpen(progress.id);
                      }
                    }}
                    className={`group relative flex cursor-pointer items-stretch gap-4 overflow-hidden rounded-2xl border border-black/8 bg-white/70 p-5 text-left shadow-sm transition-all hover:border-black/15 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5f5a63] sm:gap-6 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:focus-visible:ring-[#a3a3a3] ${
                      progress.percent >= 100
                        ? "bg-emerald-50/70 hover:bg-emerald-50 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15"
                        : ""
                    } ${sortMode === "default" && index === draggedIndex ? "opacity-30" : ""}`}
                  >
                    <div
                      aria-hidden="true"
                      className="self-center h-10 w-1 shrink-0 rounded-full sm:h-12"
                      style={{ backgroundColor: withAlpha(color, 0.85) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1">
                        <h3 className="truncate font-display text-lg font-medium text-[#25242a] dark:text-[#f5f5f5]">
                          {progress.name}
                        </h3>
                        {progress.description ? (
                          <p className="line-clamp-1 text-xs text-[#7d7880] dark:text-[#a3a3a3]">
                            {progress.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-3">
                        <ProgressBar
                          progress={progress}
                          compact
                          onValueChange={
                            progress.trackingMode === "manual" && user
                              ? (v: number) => void setManualValue(user.id, progress.id, v)
                              : undefined
                          }
                        />
                      </div>
                    </div>
                    <div className="hidden shrink-0 items-center text-right sm:flex">
                      <span className="text-[11px] text-[#9f99a3] dark:text-[#737373]">
                        {progress.trackingMode === "count"
                          ? t("progress.mode.count")
                          : progress.trackingMode === "percentage"
                          ? t("progress.mode.percentage")
                          : t("progress.mode.manual")}
                      </span>
                    </div>
                    {user ? (
                      <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(progress.id);
                          }}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.05] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                          title={t("progress.detail.edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(progress.id);
                          }}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-red-50 hover:text-red-500 dark:text-[#a3a3a3] dark:hover:bg-red-500/15 dark:hover:text-red-400"
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {user ? (
        <>
          <ProgressFormModal open={createOpen} mode="create" onClose={() => setCreateOpen(false)} />
          <ProgressFormModal
            open={editingId !== null}
            mode="edit"
            progressId={editingId ?? undefined}
            onClose={() => setEditingId(null)}
          />
        </>
      ) : null}

      <DeleteProgressDialog
        open={deletingId !== null}
        progressName={deletingProgress?.name ?? ""}
        onCancel={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
}
