import type { DisplayItem } from "./types/all-page";
import { getAnchorDate, getPriorityWeight } from "./all-page-utils";

export type TableColumnKey =
  | "status"
  | "title"
  | "start"
  | "end"
  | "project"
  | "tags"
  | "priority"
  | "estimate"
  | "recurring"
  | "createdAt";

export type TableSortDirection = "asc" | "desc";

export type TableSortConfig = {
  column: TableColumnKey;
  direction: TableSortDirection;
};

const EMPTY_LAST = 1;

function compareString(a: string | undefined, b: string | undefined): number {
  // Empty values always sort last regardless of direction.
  if (!a && !b) return 0;
  if (!a) return EMPTY_LAST;
  if (!b) return -EMPTY_LAST;
  return a.localeCompare(b);
}

function compareDate(a: Date | undefined, b: Date | undefined): number {
  if (!a && !b) return 0;
  if (!a) return EMPTY_LAST;
  if (!b) return -EMPTY_LAST;
  return a.getTime() - b.getTime();
}

function getTitle(item: DisplayItem): string {
  return item.title?.trim().toLowerCase() ?? "";
}

function getStartDate(item: DisplayItem): Date | undefined {
  // Prefer explicit start, then due, then creation date as the anchor.
  if (item.time?.start) return item.time.start;
  if (item.time?.due) return item.time.due;
  const anchor = getAnchorDate(item);
  return anchor instanceof Date ? anchor : undefined;
}

function getEndDate(item: DisplayItem): Date | undefined {
  return item.time?.end;
}

function getProjectKey(item: DisplayItem): string {
  return item.projectId ?? "";
}

function getFirstTag(item: DisplayItem): string {
  return (item.tags ?? [])[0] ?? "";
}

function getPriorityRank(item: DisplayItem): number {
  return getPriorityWeight(item.priority);
}

function getEstimateMinutes(item: DisplayItem): number | undefined {
  return item.estimateMinutes;
}

function isRecurring(item: DisplayItem): number {
  if ("isRecurringInstance" in item && item.isRecurringInstance) return 1;
  if (item.recurrence && item.recurrence.type && item.recurrence.type !== "none") return 1;
  return 0;
}

function getCreatedAt(item: DisplayItem): Date | undefined {
  return item.createdAt instanceof Date ? item.createdAt : undefined;
}

type Comparator = (a: DisplayItem, b: DisplayItem) => number;

const COMPARATORS: Record<TableColumnKey, Comparator> = {
  status: (a, b) => {
    // Active before completed when ascending.
    const aDone = a.status === "completed" ? 1 : 0;
    const bDone = b.status === "completed" ? 1 : 0;
    return aDone - bDone;
  },
  title: (a, b) => compareString(getTitle(a), getTitle(b)),
  start: (a, b) => compareDate(getStartDate(a), getStartDate(b)),
  end: (a, b) => compareDate(getEndDate(a), getEndDate(b)),
  project: (a, b) => compareString(getProjectKey(a), getProjectKey(b)),
  tags: (a, b) => compareString(getFirstTag(a), getFirstTag(b)),
  priority: (a, b) => getPriorityRank(a) - getPriorityRank(b),
  estimate: (a, b) => {
    const aVal = getEstimateMinutes(a);
    const bVal = getEstimateMinutes(b);
    if (aVal === undefined && bVal === undefined) return 0;
    if (aVal === undefined) return EMPTY_LAST;
    if (bVal === undefined) return -EMPTY_LAST;
    return aVal - bVal;
  },
  recurring: (a, b) => isRecurring(a) - isRecurring(b),
  createdAt: (a, b) => compareDate(getCreatedAt(a), getCreatedAt(b)),
};

export function sortTableRows(
  items: DisplayItem[],
  config: TableSortConfig,
): DisplayItem[] {
  const comparator = COMPARATORS[config.column];
  const sign = config.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const result = comparator(a, b);
    if (result !== 0) return result * sign;
    // Stable tie-breaker: id ascending.
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

export function nextTableSortDirection(
  current: TableSortConfig | undefined,
  column: TableColumnKey,
): TableSortConfig {
  if (!current || current.column !== column) {
    return { column, direction: "asc" };
  }
  if (current.direction === "asc") return { column, direction: "desc" };
  return { column, direction: "asc" };
}
