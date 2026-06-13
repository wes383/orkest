"use client";

import { type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckSquare, Square } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TableColumnKey, TableSortConfig, TableSortDirection } from "@/lib/table-sort";
import { nextTableSortDirection } from "@/lib/table-sort";

type ColumnDef = {
  key: TableColumnKey | "checkbox" | "actions";
  labelKey: string;
  width?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
};

const COLUMNS: ColumnDef[] = [
  { key: "checkbox", labelKey: "", width: "w-10", align: "center" },
  { key: "title", labelKey: "table.column.title", sortable: true },
  { key: "start", labelKey: "table.column.start", width: "w-36", sortable: true },
  { key: "end", labelKey: "table.column.end", width: "w-36", sortable: true },
  { key: "project", labelKey: "table.column.project", width: "w-36", sortable: true },
  { key: "tags", labelKey: "table.column.tags", width: "w-40" },
  { key: "priority", labelKey: "table.column.priority", width: "w-24", align: "center", sortable: true },
  { key: "recurring", labelKey: "table.column.recurring", width: "w-20", align: "center", sortable: true },
  { key: "actions", labelKey: "table.column.actions", width: "w-24", align: "right" },
];

export function TableHeader({
  sort,
  onSortChange,
  allSelected,
  onToggleSelectAll,
}: {
  sort: TableSortConfig;
  onSortChange: (next: TableSortConfig) => void;
  allSelected: boolean;
  onToggleSelectAll: () => void;
}) {
  const { t } = useI18n();

  function renderArrow(active: boolean | undefined, direction: TableSortDirection): ReactNode {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  return (
    <thead className="sticky top-0 z-10 bg-[#f4f0ec]/95 dark:bg-[#1e1e1e]/90 backdrop-blur-sm">
      <tr className="border-b border-black/8 dark:border-white/10">
        {COLUMNS.map((col) => {
          const isCheckbox = col.key === "checkbox";
          const isActions = col.key === "actions";
          const isActive = !isCheckbox && !isActions && col.sortable && sort.column === col.key;
          const align = col.align ?? "left";

          return (
            <th
              key={col.key}
              scope="col"
              className={cn(
                "px-3 py-2 align-middle text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7d7880] dark:text-[#a3a3a3]",
                col.width,
                align === "right" && "text-right",
                align === "center" && "text-center",
                col.sortable && !isActions && "cursor-pointer select-none hover:text-[#25242a] dark:hover:text-white",
              )}
              onClick={
                col.sortable && !isActions
                  ? () => onSortChange(nextTableSortDirection(sort, col.key as TableColumnKey))
                  : undefined
              }
            >
              {isCheckbox ? (
                <button
                  type="button"
                  onClick={onToggleSelectAll}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#9f99a3] hover:text-[#25242a] dark:hover:text-white"
                  aria-label={allSelected ? t("common.deselectAll") : t("ai.selectAll")}
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    align === "right" && "flex-row-reverse",
                    align === "center" && "justify-center",
                  )}
                >
                  {t(col.labelKey as Parameters<typeof t>[0])}
                  {col.sortable && !isActions ? renderArrow(isActive, sort.direction) : null}
                </span>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export const TABLE_COLUMNS = COLUMNS;
