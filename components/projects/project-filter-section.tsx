"use client";

import { useMemo } from "react";

import { useI18n } from "@/lib/i18n";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { normalizeProjectColor } from "@/lib/projects/color-palette";

interface ProjectFilterSectionProps {
  selectedProjectIds: string[];
  onChange: (update: { selectedProjectIds: string[] }) => void;
}

/**
 * Single-select project filter. Aligned with the sidebar project list:
 * - clicking a project selects it
 * - clicking the same project again clears the selection
 * - clicking another project replaces the selection
 */
export function ProjectFilterSection({
  selectedProjectIds,
  onChange,
}: ProjectFilterSectionProps) {
  const { t } = useI18n();
  const projects = useProjectStore((s) => s.projects);
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );
  const selectedId = selectedProjectIds[0] ?? null;

  if (sortedProjects.length === 0) return null;

  function handleClick(projectId: string) {
    if (selectedId === projectId) {
      onChange({ selectedProjectIds: [] });
    } else {
      onChange({ selectedProjectIds: [projectId] });
    }
  }

  return (
    <div className="mt-4 space-y-1.5">
      <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase dark:text-[#737373]">
        {t("projects.filter.title")}
      </p>
      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {sortedProjects.map((project) => {
          const selected = selectedId === project.id;
          const color = normalizeProjectColor(project.color);
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => handleClick(project.id)}
              className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? "bg-[#25242a] text-white shadow-sm dark:!bg-[#e5e5e5] dark:!text-[#111111]"
                  : "bg-black/[0.035] text-[#5f5a63] hover:bg-black/[0.07] dark:bg-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/12"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: color,
                  opacity: selected ? 1 : 0.85,
                }}
              />
              <span className="block max-w-44 truncate">{project.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
