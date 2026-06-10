"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Folder, Pencil, Plus, Trash2, X } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ProjectFormModal } from "@/components/projects/project-form-modal";
import { useI18n, addLocaleToPathname } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { computeProjectsWithStats } from "@/lib/projects/project-stats";
import { distanceToNow } from "@/lib/projects/distance-to-now";
import { normalizeProjectColor, withAlpha } from "@/lib/projects/color-palette";

export function ProjectsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const projects = useProjectStore((s) => s.projects);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const setListFilterConfig = useAllPageStore((s) => s.setListFilterConfig);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const projectsWithStats = useMemo(
    () => computeProjectsWithStats(projects, manualItems),
    [projects, manualItems],
  );

  const sorted = useMemo(
    () => [...projectsWithStats].sort((a, b) => a.name.localeCompare(b.name)),
    [projectsWithStats],
  );

  const deletingProject = useMemo(
    () => projects.find((p) => p.id === deletingId) ?? null,
    [projects, deletingId],
  );

  function handleCardClick(projectId: string) {
    setListFilterConfig({ selectedProjectIds: [projectId] });
    const target = addLocaleToPathname(`/all?project=${projectId}`, locale);
    router.push(target);
  }

  async function handleConfirmDelete() {
    if (!user || !deletingProject) return;
    const projectId = deletingProject.id;
    await useProjectStore.getState().deleteProject(user.id, projectId);
    setDeletingId(null);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#9f99a3] uppercase dark:text-[#737373]">
            {t("nav.projects")}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">
            {t("projects.title")}
          </h1>
          <p className="mt-1 text-sm text-[#7d7880] dark:text-[#a3a3a3]">
            {t("projects.subtitle")}
          </p>
        </div>
        {user ? (
          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-9 gap-1.5 px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            {t("projects.newProject")}
          </Button>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Folder}
          title={t("projects.empty.title")}
          description={t("projects.empty.description")}
          action={
            user
              ? {
                  label: t("projects.empty.cta"),
                  onClick: () => setCreateOpen(true),
                  icon: Plus,
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((project) => {
            const color = normalizeProjectColor(project.color);
            const total = Math.max(project.total, 1);
            const completedPct = Math.round((project.completed / total) * 100);
            return (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(project.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(project.id);
                  }
                }}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-black/8 bg-white/70 p-5 text-left shadow-sm transition-colors hover:border-black/15 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5f5a63] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.06] dark:focus-visible:ring-[#a3a3a3]"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: color }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-xl font-medium text-[#25242a] dark:text-[#f5f5f5]">
                      {project.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#9f99a3] dark:text-[#737373]">
                      {t("projects.active", {
                        active: project.active,
                        completed: project.completed,
                      })}
                    </p>
                  </div>
                  {user ? (
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(project.id);
                        }}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.05] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                        title={t("projects.editProject")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(project.id);
                        }}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-red-50 hover:text-red-500 dark:text-[#a3a3a3] dark:hover:bg-red-500/15 dark:hover:text-red-400"
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${completedPct}%`,
                        backgroundColor: withAlpha(color, 0.95),
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#9f99a3] dark:text-[#737373]">
                    <span>
                      {t("projects.tasks", { count: project.total })}
                    </span>
                    <span>{distanceToNow(project.createdAt, t)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {user ? (
        <>
          <ProjectFormModal
            open={createOpen}
            mode="create"
            onClose={() => setCreateOpen(false)}
          />
          <ProjectFormModal
            open={editingId !== null}
            mode="edit"
            projectId={editingId ?? undefined}
            onClose={() => setEditingId(null)}
          />
        </>
      ) : null}

      {deletingProject ? (
        <DeleteProjectDialog
          projectName={deletingProject.name}
          onCancel={() => setDeletingId(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}

interface DeleteProjectDialogProps {
  projectName: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

function DeleteProjectDialog({
  projectName,
  onCancel,
  onConfirm,
}: DeleteProjectDialogProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-white/35 backdrop-blur-[5px] dark:bg-black/50"
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-black/8 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1f1d24]">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">
              {t("projects.deleteTitle", { name: projectName })}
            </h2>
            <p className="mt-1.5 text-sm text-[#7d7880] dark:text-[#a3a3a3]">
              {t("projects.deleteSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.05] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2 px-5 pb-5">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={busy}
            className="h-8 px-4 text-sm"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="h-8 bg-red-500 px-4 text-sm text-white hover:bg-red-600 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("projects.deleteConfirm")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
