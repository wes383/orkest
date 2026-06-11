"use client";

import { useMemo } from "react";
import type { MouseEvent } from "react";

import { useI18n } from "@/lib/i18n";
import { useProjectStore } from "@/lib/stores/use-project-store";
import {
  DEFAULT_PROJECT_COLOR,
  normalizeProjectColor,
  withAlpha,
} from "@/lib/projects/color-palette";

interface ProjectPillProps {
  projectId: string;
  projectName?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  showDot?: boolean;
}

/**
 * Compact "color dot + name" pill used in item metadata rows.
 * Falls back to the supplied name + default color when the project is missing.
 */
export function ProjectPill({
  projectId,
  projectName,
  onClick,
  className = "",
  showDot = true,
}: ProjectPillProps) {
  const { t } = useI18n();
  const projects = useProjectStore((s) => s.projects);
  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const label = project?.name ?? projectName ?? t("projects.filter.none");
  const color = normalizeProjectColor(project?.color ?? DEFAULT_PROJECT_COLOR);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${className}`}
      style={{
        borderColor: withAlpha(color, 0.22),
        backgroundColor: withAlpha(color, 0.11),
        color,
      }}
      title={label}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className="max-w-[8rem] truncate">{label}</span>
    </button>
  );
}
