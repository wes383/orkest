"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownAZ,
  BarChart3,
  Folder,
  GripVertical,
  List,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n";
import { addLocaleToPathname } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { computeProjectsWithStats, sortProjectsWithStats } from "@/lib/projects/project-stats";
import { normalizeProjectColor } from "@/lib/projects/color-palette";
import { ProjectFormModal } from "@/components/projects/project-form-modal";
import type { ProjectSortMode } from "@/lib/types/all-page";

interface ProjectSectionProps {
  onSelect: (projectId: string) => void;
}

export function ProjectSection({ onSelect }: ProjectSectionProps) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const listFilterConfig = useAllPageStore((s) => s.listFilterConfig);
  const setListFilterConfig = useAllPageStore((s) => s.setListFilterConfig);

  const [sortMode, setSortMode] = useState<ProjectSortMode>("default");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [modalState, setModalState] = useState<
    | { mode: "closed" }
    | { mode: "create" }
    | { mode: "edit"; projectId: string }
  >({ mode: "closed" });

  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [sortMenuPos, setSortMenuPos] = useState<{ top: number; left: number } | null>(null);

  const projectsWithStats = useMemo(() => {
    const withStats = computeProjectsWithStats(projects, manualItems);
    return sortProjectsWithStats(withStats, sortMode);
  }, [projects, manualItems, sortMode]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [localOrderedProjects, setLocalOrderedProjects] = useState<typeof projectsWithStats | null>(null);

  const displayProjects = localOrderedProjects ?? projectsWithStats;

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    setLocalOrderedProjects([...projectsWithStats]);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDragEnter(e: React.DragEvent, targetIndex: number) {
    if (draggedIndex === null || draggedIndex === targetIndex || !localOrderedProjects) {
      return;
    }
    const list = [...localOrderedProjects];
    const [draggedItem] = list.splice(draggedIndex, 1);
    list.splice(targetIndex, 0, draggedItem);
    setLocalOrderedProjects(list);
    setDraggedIndex(targetIndex);
  }

  function handleDragEnd() {
    if (localOrderedProjects && user) {
      void useProjectStore.getState().reorderProjects(
        user.id,
        localOrderedProjects.map((p) => p.id),
      );
    }
    setDraggedIndex(null);
    setLocalOrderedProjects(null);
  }

  function toggleSortMenu() {
    if (showSortMenu) {
      setShowSortMenu(false);
      return;
    }
    const rect = sortBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setSortMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowSortMenu(true);
  }

  // Close sort menu on outside click
  useEffect(() => {
    if (!showSortMenu) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        sortBtnRef.current?.contains(target) ||
        sortMenuRef.current?.contains(target)
      ) {
        return;
      }
      setShowSortMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSortMenu]);

  // Defensive: older persisted snapshots may not include `selectedProjectIds`.
  // The store now backfills defaults on every write, but guard anyway so a
  // third-party migration gap cannot crash the sidebar.
  const selectedIds: string[] = listFilterConfig.selectedProjectIds ?? [];
  const selectedId = selectedIds[0] ?? null;

  function handleClick(projectId: string) {
    if (selectedId === projectId) {
      setListFilterConfig({ selectedProjectIds: [] });
    } else {
      setListFilterConfig({ selectedProjectIds: [projectId] });
      onSelect(projectId);
    }
  }

  function clearSelection() {
    setListFilterConfig({ selectedProjectIds: [] });
  }

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-4">
        <button
          type="button"
          onClick={() => {
            router.push(addLocaleToPathname("/projects", locale));
          }}
          className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-md -ml-1 px-1 py-0.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/8"
        >
          <Folder className="h-3.5 w-3.5 text-[#9f99a3] group-hover:text-[#5f5a63] dark:text-[#737373] dark:group-hover:text-[#a3a3a3]" />
          <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase group-hover:text-[#5f5a63] dark:text-[#737373] dark:group-hover:text-[#a3a3a3]">
            {t("projects.sidebar.section")}
          </p>
        </button>
        <div className="flex items-center gap-0.5">
          {selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-6 cursor-pointer items-center justify-center rounded-md px-1.5 text-[10px] font-medium text-[#9f99a3] transition-colors hover:bg-black/[0.05] hover:text-[#5f5a63] dark:text-[#737373] dark:hover:bg-white/8 dark:hover:text-[#a3a3a3]"
              title={t("listControls.clear")}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleSortMenu}
            ref={sortBtnRef}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#9f99a3] transition-colors hover:bg-black/[0.05] hover:text-[#5f5a63] dark:text-[#737373] dark:hover:bg-white/8 dark:hover:text-[#a3a3a3]"
            title={t("projects.sidebar.sortTooltip")}
          >
            {sortMode === "default" ? (
              <GripVertical className="h-3.5 w-3.5" />
            ) : sortMode === "alpha" ? (
              <ArrowDownAZ className="h-3.5 w-3.5" />
            ) : sortMode === "frequency" ? (
              <BarChart3 className="h-3.5 w-3.5" />
            ) : (
              <List className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setModalState({ mode: "create" })}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#9f99a3] transition-colors hover:bg-black/[0.05] hover:text-[#5f5a63] dark:text-[#737373] dark:hover:bg-white/8 dark:hover:text-[#a3a3a3]"
            title={t("projects.sidebar.newTooltip")}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showSortMenu && sortMenuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={sortMenuRef}
              className="fixed z-50 w-44 rounded-xl border border-black/8 bg-sidebar p-1 shadow-lg dark:border-white/10 flex flex-col gap-0.5"
              style={{
                top: sortMenuPos.top,
                left: sortMenuPos.left,
              }}
            >
              {([
                { mode: "default" as const, icon: GripVertical, label: t("projects.sort.default") },
                { mode: "alpha" as const, icon: ArrowDownAZ, label: t("projects.sort.alpha") },
                { mode: "recent" as const, icon: List, label: t("projects.sort.recent") },
                { mode: "frequency" as const, icon: BarChart3, label: t("projects.sort.frequency") },
              ]).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSortMode(mode);
                    setShowSortMenu(false);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    sortMode === mode
                      ? "bg-black/[0.05] text-[#25242a] dark:bg-white/10 dark:text-[#f5f5f5]"
                      : "text-[#7d7880] hover:bg-black/[0.035] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

      <div className="scrollbar-transparent-track flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4">
        {displayProjects.length === 0 ? (
          <button
            type="button"
            onClick={() => setModalState({ mode: "create" })}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-black/10 px-3 py-2 text-xs font-medium text-[#9f99a3] transition-colors hover:border-black/20 hover:bg-black/[0.02] hover:text-[#5f5a63] dark:border-white/10 dark:text-[#737373] dark:hover:border-white/20 dark:hover:bg-white/8 dark:hover:text-[#a3a3a3]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("projects.sidebar.newTooltip")}
          </button>
        ) : (
          displayProjects.map((project, index) => {
            const isSelected = selectedId === project.id;
            const color = normalizeProjectColor(project.color);
            return (
              <div
                key={project.id}
                draggable={sortMode === "default"}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                className={`group relative transition-all ${index === draggedIndex ? "opacity-30" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => handleClick(project.id)}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 pr-10 text-xs font-medium transition-colors text-left ${
                    isSelected
                      ? "border-transparent bg-[#25242a] text-white shadow-sm dark:bg-[#e5e5e5] dark:text-[#111111]"
                      : "border-transparent bg-black/[0.035] text-[#5f5a63] hover:bg-black/[0.07] dark:bg-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/12"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 truncate">{project.name}</span>
                </button>
                <div className="pointer-events-none absolute right-[3px] top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalState({ mode: "edit", projectId: project.id });
                    }}
                    className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors ${
                      isSelected
                        ? "text-white/70 hover:bg-white/15 hover:text-white"
                        : "text-[#7d7880] hover:bg-black/[0.07] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                    }`}
                    title={t("projects.editProject")}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {user ? (
        <ProjectFormModal
          open={modalState.mode !== "closed"}
          mode={modalState.mode === "closed" ? "create" : modalState.mode}
          projectId={modalState.mode === "edit" ? modalState.projectId : undefined}
          onClose={() => setModalState({ mode: "closed" })}
        />
      ) : null}
    </div>
  );
}
