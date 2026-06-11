"use client";

import { useMemo } from "react";
import { CheckCircle, Circle, Pencil, Repeat } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { PRIORITY_CONFIG, getAnchorDate, getTimelinePointColor } from "@/lib/all-page-utils";
import { cn } from "@/lib/utils";
import type { DisplayItem } from "@/lib/types/all-page";
import type { Priority } from "@/lib/types/item";
import { ProjectPill } from "@/components/projects/project-pill";

function formatEstimate(minutes: number | undefined) {
  if (minutes === undefined) return "";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h${mins}m`;
}

export function TableRow({
  item,
  itemKey,
  isSelected,
  isCompact,
  onToggleSelect,
  onOpen,
  onToggleComplete,
}: {
  item: DisplayItem;
  itemKey: string;
  isSelected: boolean;
  isCompact: boolean;
  onToggleSelect: (key: string) => void;
  onOpen: (item: DisplayItem) => void;
  onToggleComplete: (item: DisplayItem) => void;
}) {
  const { t } = useI18n();
  const projects = useProjectStore((s) => s.projects);
  const timeFormat = useSettingsStore((s) => s.timeFormat);
  const is12h = timeFormat === "12h";
  const isCompleted = item.status === "completed";
  const anchorDate = getAnchorDate(item);

  // Rebuild formatters per render so they pick up locale + 12h/24h changes
  // from the settings store without needing a global cache.
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }),
    [],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: is12h,
      }),
    [is12h],
  );
  const formatDateTimeCell = (date: Date | undefined, allDay: boolean) => {
    if (!date) return "";
    const datePart = dateFormatter.format(date);
    if (allDay) return datePart;
    return `${datePart} ${timeFormatter.format(date)}`;
  };

  const priority: Priority | undefined = item.priority;
  const priorityConfig = priority ? PRIORITY_CONFIG[priority] : undefined;
  const tags = item.tags ?? [];
  const recurring = item.recurrence && item.recurrence.type && item.recurrence.type !== "none";
  const estimate = formatEstimate(item.estimateMinutes);
  const startDate = item.time.start;
  const endDate = item.time.end;
  const dueDate = item.time.due;
  const anchorForStart = startDate ?? dueDate ?? anchorDate;
  const allDay = item.time.allDay;
  const startLabel = formatDateTimeCell(anchorForStart, Boolean(allDay && !startDate));
  const endLabel = formatDateTimeCell(endDate, Boolean(allDay));
  const project = item.projectId ? projects.find((p) => p.id === item.projectId) : undefined;
  const dateColor = getTimelinePointColor(anchorDate);

  return (
    <tr
      data-item-id={item.id}
      className={cn(
        "border-b border-black/5 dark:border-white/5 transition-colors cursor-pointer",
        isSelected
          ? "bg-blue-50/80 dark:bg-blue-950/40"
          : "hover:bg-white/70 dark:hover:bg-white/[0.04]",
        isCompleted && "opacity-55",
      )}
    >
      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(itemKey)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-4 w-4 cursor-pointer rounded border-black/20"
          aria-label={item.title}
        />
      </td>

      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(item);
            }}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#9f99a3] hover:text-[#25242a] dark:hover:text-white"
            aria-label={isCompleted ? t("batch.undo") : t("batch.complete")}
          >
            {isCompleted ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </button>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: dateColor }}
            aria-hidden
          />
          <span
            className={cn(
              "min-w-0 max-w-[10rem] flex-1 truncate text-sm text-[#25242a] dark:text-[#f5f5f5]",
              isCompleted && "line-through",
            )}
            title={item.title}
            onClick={() => onOpen(item)}
          >
            {item.title}
          </span>
        </div>
      </td>

      <td className={cn("px-3 align-middle text-xs text-[#525059] dark:text-[#d4d4d4] tabular-nums", isCompact ? "py-1.5" : "py-2.5")}>
        {startLabel || <span className="text-[#9f99a3]">—</span>}
      </td>

      <td className={cn("px-3 align-middle text-xs text-[#525059] dark:text-[#d4d4d4] tabular-nums", isCompact ? "py-1.5" : "py-2.5")}>
        {endLabel || <span className="text-[#9f99a3]">—</span>}
      </td>

      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        {project ? (
          <ProjectPill projectId={project.id} projectName={project.name} />
        ) : (
          <span className="text-xs text-[#9f99a3]">—</span>
        )}
      </td>

      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1 max-w-[10rem]">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md bg-black/5 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#525059] dark:text-[#d4d4d4]"
              >
                #{tag}
              </span>
            ))}
            {tags.length > 2 ? (
              <span className="text-[10px] text-[#9f99a3]">+{tags.length - 2}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-[#9f99a3]">—</span>
        )}
      </td>

      <td className={cn("px-3 align-middle text-center", isCompact ? "py-1.5" : "py-2.5")}>
        {priorityConfig ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              color: priorityConfig.textColor,
              backgroundColor: `${priorityConfig.textColor}1a`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: priorityConfig.textColor }}
              aria-hidden
            />
            {t(`priority.${priority}` as Parameters<typeof t>[0])}
          </span>
        ) : (
          <span className="text-xs text-[#9f99a3]">—</span>
        )}
      </td>

      <td className={cn("px-3 align-middle text-right text-xs text-[#525059] dark:text-[#d4d4d4] tabular-nums", isCompact ? "py-1.5" : "py-2.5")}>
        {estimate || <span className="text-[#9f99a3]">—</span>}
      </td>

      <td className={cn("px-3 align-middle text-center text-base", isCompact ? "py-1.5" : "py-2.5")}>
        {recurring ? (
          <Repeat className="inline-block h-3.5 w-3.5 text-[#7d7880] dark:text-[#a3a3a3]" aria-label="Recurring" />
        ) : (
          <span className="text-[#9f99a3]">—</span>
        )}
      </td>

      <td className={cn("px-3 align-middle text-right", isCompact ? "py-1.5" : "py-2.5")}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item);
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#9f99a3] hover:text-[#25242a] hover:bg-black/5 dark:hover:text-white dark:hover:bg-white/10"
          aria-label={t("common.edit")}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

