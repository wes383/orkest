# All Page Table View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a high-density, spreadsheet-like **Table** view to the All page that lets users see every schedule item as a row, with multiple sortable columns and inline editing/add affordances, while reusing the existing filter, sort, and selection infrastructure.

**Architecture:** Mirror the existing view-mode pattern (timeline / list / calendar / kanban) by adding a new `"table"` variant of `ViewMode` + `AllDefaultView`. Build a self-contained `TableView` component that pulls filtered items from the same `filterSections` helper that the List view uses, and renders them with a sticky-header HTML `<table>`. Reuse the existing `ListControlsButton` for filter/sort, the existing `ItemForm` (opened via `openComposer` / `handleEditItem`) for inline editing, and the existing batch action bar for multi-select. Column header clicks toggle ascending/descending sort using a new `TableSortConfig` helper.

**Tech Stack:** Next.js 16 (App Router), React 19, Zustand 5, Tailwind 4, TypeScript 5, Vitest 4, lucide-react. **Read `node_modules/next/dist/docs/` before writing any code** (per `AGENTS.md`).

---

## Files Touched (Quick Index)

| Type | Path |
|---|---|
| Modify | `lib/types/all-page.ts` |
| Modify | `lib/stores/use-settings-store.ts` |
| Modify | `app/(shell)/all/page.tsx` |
| Modify | `app/(shell)/settings/page.tsx` |
| Modify | `lib/i18n/dictionary.ts` (7 locales) |
| Create | `components/all-page/table/table-view.tsx` |
| Create | `components/all-page/table/table-header.tsx` |
| Create | `components/all-page/table/table-row.tsx` |
| Create | `components/all-page/table/table-quick-add-row.tsx` |
| Create | `components/all-page/table/table-empty-state.tsx` |
| Create | `components/all-page/table/table-toolbar.tsx` |
| Create | `lib/table-sort.ts` |
| Create | `lib/__tests__/table-sort.test.ts` |

## Conventions

- Bit-sized steps. Each numbered step is one action (2–5 minutes).
- TDD: failing test first, then minimal implementation, then passing test, then commit.
- Frequent commits — one per task (or per logical sub-step inside a task).
- All user-facing strings go through `useI18n()` with a key added to **all 7 locales** (`en`, `zh-CN`, `es`, `fr`, `de`, `ja`, `pt`).
- No new dependencies. Use the existing `lucide-react` icons, `ProjectPill`, `PrioritySelector`, `EmptyState`, and the existing `filterSections` / `getListItemKey` exports from `components/all-page/list-view.tsx`.
- No emojis in UI or commit messages.

---

## Task 1: Extend the `ViewMode` and `AllDefaultView` types

**Files:**
- Modify: `lib/types/all-page.ts:5`
- Modify: `lib/stores/use-settings-store.ts:11,104`

### Step 1: Add `"table"` to the `ViewMode` union

In [lib/types/all-page.ts](file:///d:/FJ/Orkest/orkest/lib/types/all-page.ts#L5), change:

```ts
export type ViewMode = "timeline" | "list" | "calendar" | "kanban";
```

to:

```ts
export type ViewMode = "timeline" | "list" | "calendar" | "kanban" | "table";
```

### Step 2: Add `"table"` to the `AllDefaultView` type and validator

In [lib/stores/use-settings-store.ts](file:///d:/FJ/Orkest/orkest/lib/stores/use-settings-store.ts#L11), change:

```ts
export type AllDefaultView = "timeline" | "list" | "calendar" | "kanban";
```

to:

```ts
export type AllDefaultView = "timeline" | "list" | "calendar" | "kanban" | "table";
```

Update the type guard at line 104 to allow the new value:

```ts
function isAllDefaultView(value: unknown): value is AllDefaultView {
  return (
    value === "timeline" ||
    value === "list" ||
    value === "calendar" ||
    value === "kanban" ||
    value === "table"
  );
}
```

### Step 3: Verify with typecheck

Run: `npx tsc --noEmit`
Expected: PASS — widening a union does not break existing call sites.

### Step 4: Commit

```bash
git add lib/types/all-page.ts lib/stores/use-settings-store.ts
git commit -m "feat(all): extend view mode types to include table"
```

---

## Task 2: Add i18n keys for the table view (all 7 locales)

**Files:**
- Modify: `lib/i18n/dictionary.ts` (add the new keys after the existing `settings.view.kanban` entry in each locale block)

### Step 1: Add English keys

In the `en` block of [lib/i18n/dictionary.ts](file:///d:/FJ/Orkest/orkest/lib/i18n/dictionary.ts#L222) (right after `"settings.view.kanban"`), add:

```ts
"settings.view.table": "Table",
"table.column.status": "Status",
"table.column.title": "Title",
"table.column.date": "Date",
"table.column.time": "Time",
"table.column.project": "Project",
"table.column.tags": "Tags",
"table.column.priority": "Priority",
"table.column.estimate": "Estimate",
"table.column.recurring": "Recurring",
"table.quickAdd.placeholder": "New item title — press Enter to add",
"table.empty.title": "No items match these filters",
"table.empty.description": "Adjust your filters, or add a new item using the row above.",
"table.filteredCount": "{count, plural, =0 {No items} one {# item} other {# items}}",
"table.addRow": "Add",
"table.estimate.none": "—",
"table.recurring.dot": "↻",
```

### Step 2: Add the same key set to the other 6 locales

For each of `zh`, `es`, `fr`, `de`, `ja`, `pt`, add the same keys (translated) in the matching location inside that locale's block. Example for `zh`:

```ts
"settings.view.table": "表格",
"table.column.status": "状态",
"table.column.title": "标题",
"table.column.date": "日期",
"table.column.time": "时间",
"table.column.project": "项目",
"table.column.tags": "标签",
"table.column.priority": "优先级",
"table.column.estimate": "预估",
"table.column.recurring": "循环",
"table.quickAdd.placeholder": "新任务标题 — 按 Enter 添加",
"table.empty.title": "没有符合筛选条件的任务",
"table.empty.description": "调整筛选条件，或使用上方行添加新任务。",
"table.filteredCount": "{count, plural, =0 {没有任务} other {# 个任务}}",
"table.addRow": "添加",
"table.estimate.none": "—",
"table.recurring.dot": "↻",
```

(Provide matching translations for `es`, `fr`, `de`, `ja`, `pt` using the same tone and capitalization conventions as the existing `kanban.column.*` / `settings.view.*` entries.)

### Step 3: Verify the dictionary type still compiles

Run: `npx tsc --noEmit`
Expected: PASS. If the `Dictionary` type is declared as a closed record (e.g. `Record<keyof typeof en, string>`), the new keys will typecheck automatically once they're added to every locale. If the file uses a string-indexed fallback, this still passes. If you hit a missing-key error in another locale, add the missing key there.

### Step 4: Commit

```bash
git add lib/i18n/dictionary.ts
git commit -m "feat(i18n): add table view labels for all 7 locales"
```

---

## Task 3: Pure sort helper for the table view (TDD)

**Files:**
- Create: `lib/table-sort.ts`
- Create: `lib/__tests__/table-sort.test.ts`

### Step 1: Write the failing test

Create [lib/__tests__/table-sort.test.ts](file:///d:/FJ/Orkest/orkest/lib/__tests__/table-sort.test.ts):

```ts
import { describe, it, expect } from "vitest";
import { sortTableRows } from "../table-sort";
import type { DisplayItem } from "../types/all-page";
import type { Item } from "../types/item";

function makeBase(overrides: Partial<Item> = {}): DisplayItem {
  return {
    id: overrides.id ?? "i",
    uid: overrides.uid ?? "u",
    title: overrides.title ?? "t",
    time: overrides.time ?? {},
    actual: overrides.actual ?? {},
    status: overrides.status ?? "active",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  } as DisplayItem;
}

describe("sortTableRows", () => {
  it("sorts by date ascending using start or due", () => {
    const items: DisplayItem[] = [
      makeBase({ id: "a", time: { start: new Date("2025-06-15T10:00:00") } }),
      makeBase({ id: "b", time: { start: new Date("2025-06-10T10:00:00") } }),
      makeBase({ id: "c", time: { due: new Date("2025-06-12T10:00:00") } }),
    ];
    const result = sortTableRows(items, { column: "date", direction: "asc" });
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by priority urgent → none", () => {
    const items: DisplayItem[] = [
      makeBase({ id: "low", priority: "low" }),
      makeBase({ id: "urgent", priority: "urgent" }),
      makeBase({ id: "none", priority: undefined }),
      makeBase({ id: "high", priority: "high" }),
    ];
    const result = sortTableRows(items, { column: "priority", direction: "asc" });
    expect(result.map((i) => i.id)).toEqual(["urgent", "high", "low", "none"]);
  });

  it("places items without a date last when sorting by date", () => {
    const items: DisplayItem[] = [
      makeBase({ id: "no-date", time: {} }),
      makeBase({ id: "dated", time: { start: new Date("2025-06-10T10:00:00") } }),
    ];
    const asc = sortTableRows(items, { column: "date", direction: "asc" });
    expect(asc.map((i) => i.id)).toEqual(["dated", "no-date"]);
    const desc = sortTableRows(items, { column: "date", direction: "desc" });
    expect(desc.map((i) => i.id)).toEqual(["dated", "no-date"]);
  });

  it("sorts by title locale-insensitively", () => {
    const items: DisplayItem[] = [
      makeBase({ id: "1", title: "banana" }),
      makeBase({ id: "2", title: "Apple" }),
      makeBase({ id: "3", title: "cherry" }),
    ];
    const result = sortTableRows(items, { column: "title", direction: "asc" });
    expect(result.map((i) => i.id)).toEqual(["2", "1", "3"]);
  });

  it("returns a new array (does not mutate input)", () => {
    const items: DisplayItem[] = [
      makeBase({ id: "a", time: { start: new Date("2025-06-15T10:00:00") } }),
      makeBase({ id: "b", time: { start: new Date("2025-06-10T10:00:00") } }),
    ];
    const snapshot = items.map((i) => i.id);
    sortTableRows(items, { column: "date", direction: "asc" });
    expect(items.map((i) => i.id)).toEqual(snapshot);
  });

  it("falls back to createdAt for createdAt column", () => {
    const a = makeBase({ id: "a", createdAt: new Date("2025-01-01") });
    const b = makeBase({ id: "b", createdAt: new Date("2025-02-01") });
    const result = sortTableRows([a, b], { column: "createdAt", direction: "desc" });
    expect(result.map((i) => i.id)).toEqual(["b", "a"]);
  });
});
```

### Step 2: Run the test to confirm it fails

Run: `npx vitest run lib/__tests__/table-sort.test.ts`
Expected: FAIL with `Cannot find module '../table-sort'`.

### Step 3: Implement the minimal sorter

Create [lib/table-sort.ts](file:///d:/FJ/Orkest/orkest/lib/table-sort.ts):

```ts
import type { DisplayItem, ListSortConfig } from "./types/all-page";
import { getAnchorDate, getPriorityWeight } from "./all-page-utils";

export type TableColumnKey =
  | "status"
  | "title"
  | "date"
  | "time"
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

const NO_DATE_SENTINEL = Number.POSITIVE_INFINITY;

const COMPARATORS: Record<TableColumnKey, (a: DisplayItem, b: DisplayItem) => number> = {
  status: (a, b) =>
    Number(a.status === "completed") - Number(b.status === "completed"),
  title: (a, b) =>
    (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" }),
  date: (a, b) => {
    const aHasDate = Boolean(a.time.start || a.time.due || a.time.end);
    const bHasDate = Boolean(b.time.start || b.time.due || b.time.end);
    const aTime = aHasDate ? getAnchorDate(a).getTime() : NO_DATE_SENTINEL;
    const bTime = bHasDate ? getAnchorDate(b).getTime() : NO_DATE_SENTINEL;
    return aTime - bTime;
  },
  time: (a, b) => {
    const aStart = a.time.start?.getTime() ?? NO_DATE_SENTINEL;
    const bStart = b.time.start?.getTime() ?? NO_DATE_SENTINEL;
    return aStart - bStart;
  },
  project: (a, b) => (a.projectId ?? "").localeCompare(b.projectId ?? ""),
  tags: (a, b) => (a.tags?.[0] ?? "").localeCompare(b.tags?.[0] ?? ""),
  priority: (a, b) => getPriorityWeight(b.priority) - getPriorityWeight(a.priority),
  estimate: (a, b) => (a.estimateMinutes ?? 0) - (b.estimateMinutes ?? 0),
  recurring: (a, b) => Number(Boolean(a.recurrence)) - Number(Boolean(b.recurrence)),
  createdAt: (a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

export function defaultTableSort(): TableSortConfig {
  return { column: "date", direction: "asc" };
}

export function listSortToTableSort(
  sort: ListSortConfig | undefined,
): TableSortConfig {
  if (!sort) return defaultTableSort();
  if (sort.mode === "created") return { column: "createdAt", direction: sort.createdDirection };
  if (sort.mode === "priority") return { column: "priority", direction: "asc" };
  return defaultTableSort();
}
```

### Step 4: Run the test to confirm it passes

Run: `npx vitest run lib/__tests__/table-sort.test.ts`
Expected: PASS, 6 tests passing.

### Step 5: Commit

```bash
git add lib/table-sort.ts lib/__tests__/table-sort.test.ts
git commit -m "feat(table): add pure table sort helper with tests"
```

---

## Task 4: Create the `TableHeader` component

**Files:**
- Create: `components/all-page/table/table-header.tsx`

### Step 1: Implement the header

Create [components/all-page/table/table-header.tsx](file:///d:/FJ/Orkest/orkest/components/all-page/table/table-header.tsx):

```tsx
"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  TableColumnKey,
  TableSortConfig,
  TableSortDirection,
} from "@/lib/table-sort";

type ColumnDef = {
  key: TableColumnKey;
  labelKey: string;
  width?: string;
  align?: "left" | "right" | "center";
  sortable: boolean;
};

const COLUMNS: ColumnDef[] = [
  { key: "status", labelKey: "table.column.status", width: "w-12", align: "center", sortable: true },
  { key: "title", labelKey: "table.column.title", sortable: true },
  { key: "date", labelKey: "table.column.date", width: "w-32", sortable: true },
  { key: "time", labelKey: "table.column.time", width: "w-24", sortable: true },
  { key: "project", labelKey: "table.column.project", width: "w-40", sortable: true },
  { key: "tags", labelKey: "table.column.tags", width: "w-44", sortable: true },
  { key: "priority", labelKey: "table.column.priority", width: "w-24", align: "center", sortable: true },
  { key: "estimate", labelKey: "table.column.estimate", width: "w-20", align: "right", sortable: true },
  { key: "recurring", labelKey: "table.column.recurring", width: "w-20", align: "center", sortable: true },
];

type TableHeaderProps = {
  sort: TableSortConfig;
  onSortChange: (sort: TableSortConfig) => void;
  isSelectionMode: boolean;
  allSelected: boolean;
  onToggleSelectAll: () => void;
};

function nextDirection(current: TableSortDirection | undefined): TableSortDirection {
  if (current === "asc") return "desc";
  return "asc";
}

export function TableHeader({
  sort,
  onSortChange,
  isSelectionMode,
  allSelected,
  onToggleSelectAll,
}: TableHeaderProps) {
  const { t } = useI18n();

  return (
    <thead className="sticky top-0 z-10 bg-[#fcfbfa]/95 backdrop-blur-sm dark:bg-[#1a1a1a]/95">
      <tr className="border-b border-black/8 text-left text-[11px] font-semibold tracking-[0.15em] text-[#6f6a72] uppercase dark:border-white/8 dark:text-[#a3a3a3]">
        <th className={cn("px-3 py-2 align-middle", isSelectionMode ? "w-10" : "w-12")}>
          {isSelectionMode ? (
            <input
              type="checkbox"
              aria-label={t("ai.selectAll")}
              checked={allSelected}
              onChange={onToggleSelectAll}
              className="h-4 w-4 cursor-pointer rounded border-black/20"
            />
          ) : null}
        </th>
        {COLUMNS.map((col) => {
          const isActive = sort.column === col.key;
          const direction = isActive ? sort.direction : undefined;
          const align = col.align ?? "left";
          return (
            <th
              key={col.key}
              scope="col"
              className={cn(
                "px-3 py-2 align-middle",
                col.width,
                align === "right" && "text-right",
                align === "center" && "text-center",
                col.sortable && "cursor-pointer select-none hover:text-[#25242a] dark:hover:text-white",
              )}
              onClick={col.sortable ? () => onSortChange({ column: col.key, direction: nextDirection(isActive ? direction : undefined) }) : undefined}
            >
              <span className="inline-flex items-center gap-1">
                {t(col.labelKey as Parameters<typeof t>[0])}
                {col.sortable ? (
                  isActive ? (
                    direction === "asc" ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )
                ) : null}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

export { COLUMNS as TABLE_COLUMNS };
```

### Step 2: Run typecheck

Run: `npx tsc --noEmit`
Expected: PASS.

### Step 3: Commit

```bash
git add components/all-page/table/table-header.tsx
git commit -m "feat(table): add sortable table header"
```

---

## Task 5: Create the `TableRow` component

**Files:**
- Create: `components/all-page/table/table-row.tsx`

### Step 1: Implement the row

Create [components/all-page/table/table-row.tsx](file:///d:/FJ/Orkest/orkest/components/all-page/table/table-row.tsx):

```tsx
"use client";

import { CheckCircle, Circle, Repeat } from "lucide-react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useI18n } from "@/lib/i18n";
import { ProjectPill } from "@/components/projects/project-pill";
import { PRIORITY_CONFIG, formatDueDate, formatItemTime } from "@/lib/all-page-utils";
import { cn } from "@/lib/utils";
import type { DisplayItem } from "@/lib/types/all-page";

type TableRowProps = {
  item: DisplayItem;
  itemKey: string;
  isSelectionMode: boolean;
  isSelected: boolean;
  isCompact: boolean;
  onToggleSelect: (itemKey: string) => void;
  onOpen: (item: DisplayItem) => void;
};

function formatEstimate(minutes?: number): string {
  if (!minutes || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function formatTimeOnly(date: Date | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function TableRow({
  item,
  itemKey,
  isSelectionMode,
  isSelected,
  isCompact,
  onToggleSelect,
  onOpen,
}: TableRowProps) {
  const { t } = useI18n();
  const handleToggleComplete = useAllPageStore((s) => s.handleToggleComplete);

  const start = item.time.start;
  const end = item.time.end;
  const isCompleted = item.status === "completed";
  const priority = item.priority ?? "none";
  const priorityConfig = PRIORITY_CONFIG[priority];
  const dateLabel = formatDueDate(getAnchorDateForDisplay(item));
  const timeLabel = start ? formatTimeOnly(start) : "";
  const endTimeLabel = end ? `– ${formatTimeOnly(end)}` : "";

  function handleClickRow() {
    if (isSelectionMode) {
      onToggleSelect(itemKey);
      return;
    }
    onOpen(item);
  }

  return (
    <tr
      data-item-id={item.id}
      onClick={handleClickRow}
      className={cn(
        "border-b border-black/5 transition-colors",
        isSelectionMode
          ? isSelected
            ? "bg-blue-50/80 dark:bg-blue-950/40"
            : "hover:bg-black/[0.02] dark:hover:bg-white/[0.04] cursor-pointer"
          : "hover:bg-white/70 dark:hover:bg-white/[0.04] cursor-pointer",
        isCompleted && "opacity-60",
      )}
    >
      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        {isSelectionMode ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(itemKey)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 cursor-pointer rounded border-black/20"
            aria-label={item.title}
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleComplete(item);
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#9f99a3] hover:text-[#25242a] dark:hover:text-white"
            aria-label={isCompleted ? t("batch.undo") : t("batch.complete")}
          >
            {isCompleted ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </button>
        )}
      </td>
      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              isCompleted && "line-through",
            )}
            style={{ color: "var(--text-primary, #2b2a30)" }}
          >
            {item.title}
          </span>
        </div>
      </td>
      <td className={cn("px-3 align-middle text-xs", isCompact ? "py-1.5" : "py-2.5")}>
        <span className="text-[#525059] dark:text-[#d4d4d4]">{dateLabel || "—"}</span>
      </td>
      <td className={cn("px-3 align-middle text-xs", isCompact ? "py-1.5" : "py-2.5")}>
        <span className="text-[#525059] dark:text-[#d4d4d4]">
          {timeLabel ? `${timeLabel}${endTimeLabel}` : "—"}
        </span>
      </td>
      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        {item.projectId ? (
          <ProjectPill
            projectId={item.projectId}
            projectName={item.projectName}
            size="sm"
          />
        ) : (
          <span className="text-xs text-[#9f99a3]">—</span>
        )}
      </td>
      <td className={cn("px-3 align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        <div className="flex flex-wrap gap-1">
          {(item.tags ?? []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-[#525059] dark:bg-white/[0.08] dark:text-[#d4d4d4]"
            >
              {tag}
            </span>
          ))}
          {(item.tags?.length ?? 0) > 3 ? (
            <span className="text-[11px] text-[#9f99a3]">
              +{(item.tags ?? []).length - 3}
            </span>
          ) : null}
        </div>
      </td>
      <td className={cn("px-3 text-center align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        {priority !== "none" ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              color: priorityConfig.textColor,
              backgroundColor: "transparent",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: priorityConfig.textColor }}
            />
            {t(`listControls.${priority}` as Parameters<typeof t>[0])}
          </span>
        ) : (
          <span className="text-[11px] text-[#9f99a3]">—</span>
        )}
      </td>
      <td className={cn("px-3 text-right align-middle text-xs", isCompact ? "py-1.5" : "py-2.5")}>
        <span className="text-[#525059] dark:text-[#d4d4d4]">
          {formatEstimate(item.estimateMinutes)}
        </span>
      </td>
      <td className={cn("px-3 text-center align-middle", isCompact ? "py-1.5" : "py-2.5")}>
        {item.recurrence ? (
          <Repeat className="mx-auto h-3.5 w-3.5 text-[#9f99a3]" />
        ) : null}
      </td>
    </tr>
  );
}

function getAnchorDateForDisplay(item: DisplayItem): Date {
  if (item.occurrenceDate) return item.occurrenceDate;
  return item.time.start ?? item.time.due ?? item.time.end ?? new Date(item.createdAt);
}
```

> Note: `handleToggleComplete` is the existing store action used by the List view; verify the exact selector name by grepping `lib/stores/use-all-page-store.ts`. Use the same name the List view uses.

### Step 2: Run typecheck

Run: `npx tsc --noEmit`
Expected: PASS. If `ProjectPill` does not accept a `size` prop, omit it and use whatever props the existing project pill accepts in [components/projects/project-pill.tsx](file:///d:/FJ/Orkest/orkest/components/projects/project-pill.tsx).

### Step 3: Commit

```bash
git add components/all-page/table/table-row.tsx
git commit -m "feat(table): add table row with inline status toggle"
```

---

## Task 6: Create the `TableQuickAddRow` component

**Files:**
- Create: `components/all-page/table/table-quick-add-row.tsx`

### Step 1: Implement the quick-add row

Create [components/all-page/table/table-quick-add-row.tsx](file:///d:/FJ/Orkest/orkest/components/all-page/table/table-quick-add-row.tsx):

```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { validateItemForm } from "@/lib/all-page-utils";

export function TableQuickAddRow() {
  const { t, locale } = useI18n();
  const openComposer = useAllPageStore((s) => s.openComposer);
  const form = useAllPageStore((s) => s.form);
  const setForm = useAllPageStore((s) => s.setForm);
  const formError = useAllPageStore((s) => s.formError);
  const handleCreateItem = useAllPageStore((s) => s.handleCreateItem);
  const setTranslator = useAllPageStore((s) => s.setTranslator);

  const [draftTitle, setDraftTitle] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setLocalError(t("quickAdd.titleRequired" as Parameters<typeof t>[0]) || "Title is required");
      return;
    }
    setLocalError(null);

    // Reuse the existing composer flow so the user gets the full form afterwards.
    openComposer();
    setForm({ title: trimmed });
    setDraftTitle("");
  }

  return (
    <tr className="border-b border-black/5 bg-[#fafafa] dark:bg-white/[0.02]">
      <td className="w-12 px-3 py-2 align-middle" colSpan={2}>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Plus className="h-4 w-4 shrink-0 text-[#9f99a3]" />
          <Input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder={t("table.quickAdd.placeholder" as Parameters<typeof t>[0])}
            className="h-7 border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            aria-invalid={Boolean(localError)}
            aria-label={t("table.quickAdd.placeholder" as Parameters<typeof t>[0])}
          />
          {draftTitle.trim() ? (
            <button
              type="submit"
              className="shrink-0 rounded-full bg-[#25242a] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#3a3940] dark:bg-[#f5f5f5] dark:text-[#101010]"
            >
              {t("table.addRow" as Parameters<typeof t>[0])}
            </button>
          ) : null}
        </form>
        {localError ? (
          <p className="mt-1 text-[11px] text-red-500" role="alert">
            {localError}
          </p>
        ) : null}
      </td>
      <td colSpan={7} className="px-3 py-2 align-middle text-[11px] text-[#9f99a3]">
        {t("table.filteredCount" as Parameters<typeof t>[0], { count: 0 }).replace("{count}", "")}
      </td>
    </tr>
  );
}
```

> The `quickAdd.titleRequired` key may not exist in the dictionary yet. Either add a new key (`"quickAdd.titleRequired": "Title is required"`) to all 7 locales in Task 2's commit, or fall back to a literal string here. Prefer adding the key — see Task 2 amendment below.

### Step 2: Amendment to Task 2 (add a missing key)

In every locale block, alongside the table keys, also add:

```ts
"quickAdd.titleRequired": "Title is required",
```

(and the matching translations for `zh`, `es`, `fr`, `de`, `ja`, `pt`).

If you forgot to add it in Task 2, do it now and amend the previous commit with `git commit --amend`, or add it as a follow-up commit:

```bash
git add lib/i18n/dictionary.ts
git commit -m "feat(i18n): add quickAdd.titleRequired in all 7 locales"
```

### Step 3: Run typecheck

Run: `npx tsc --noEmit`
Expected: PASS.

### Step 4: Commit

```bash
git add components/all-page/table/table-quick-add-row.tsx
git commit -m "feat(table): add inline quick-add row"
```

---

## Task 7: Create the `TableEmptyState` component

**Files:**
- Create: `components/all-page/table/table-empty-state.tsx`

### Step 1: Implement the empty state

Create [components/all-page/table/table-empty-state.tsx](file:///d:/FJ/Orkest/orkest/components/all-page/table/table-empty-state.tsx):

```tsx
"use client";

import { ListTodo, MessageCircle } from "lucide-react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/empty-state";

type TableEmptyStateProps = {
  isFiltered: boolean;
};

export function TableEmptyState({ isFiltered }: TableEmptyStateProps) {
  const { t } = useI18n();
  const openComposer = useAllPageStore((s) => s.openComposer);
  const ai = useAiChatContext();

  if (isFiltered) {
    return (
      <div className="rounded-2xl border border-dashed border-black/8 bg-white/40 p-6 dark:border-white/8 dark:bg-white/[0.04]">
        <EmptyState
          icon={ListTodo}
          title={t("table.empty.title" as Parameters<typeof t>[0])}
          description={t("table.empty.description" as Parameters<typeof t>[0])}
          compact
          action={{ label: t("empty.createTask"), onClick: () => openComposer() }}
          secondaryAction={{
            label: t("welcome.askAi"),
            icon: MessageCircle,
            onClick: () => ai.setExpandedState(true),
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-black/8 bg-white/40 p-6 dark:border-white/8 dark:bg-white/[0.04]">
      <EmptyState
        icon={ListTodo}
        title={t("empty.list.title")}
        description={t("empty.list.description")}
        action={{ label: t("empty.createTask"), onClick: () => openComposer() }}
        secondaryAction={{
          label: t("welcome.askAi"),
          icon: MessageCircle,
          onClick: () => ai.setExpandedState(true),
        }}
      />
    </div>
  );
}
```

### Step 2: Run typecheck

Run: `npx tsc --noEmit`
Expected: PASS.

### Step 3: Commit

```bash
git add components/all-page/table/table-empty-state.tsx
git commit -m "feat(table): add table empty state"
```

---

## Task 8: Create the `TableToolbar` component (filter + sort buttons)

**Files:**
- Create: `components/all-page/table/table-toolbar.tsx`

### Step 1: Implement the toolbar

Create [components/all-page/table/table-toolbar.tsx](file:///d:/FJ/Orkest/orkest/components/all-page/table/table-toolbar.tsx):

```tsx
"use client";

import { ArrowDownAZ, Filter, Plus, X } from "lucide-react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useI18n } from "@/lib/i18n";
import { ListControlsButton } from "@/components/all-page/list-controls-button";
import { cn } from "@/lib/utils";
import type {
  ListFilterConfig,
  ListSortConfig,
} from "@/lib/types/all-page";
import type { TableSortConfig, TableSortDirection } from "@/lib/table-sort";

type TableToolbarProps = {
  filterConfig: ListFilterConfig;
  sortConfig: ListSortConfig;
  availableTags: string[];
  tableSort: TableSortConfig;
  isSelectionMode: boolean;
  onFilterChange: (update: Partial<ListFilterConfig>) => void;
  onSortChange: (update: Partial<ListSortConfig>) => void;
  onTableSortChange: (sort: TableSortConfig) => void;
  onToggleSelectionMode: () => void;
  onCreateItem: () => void;
};

const SORT_LABELS: Record<TableSortConfig["column"], string> = {
  status: "table.column.status",
  title: "table.column.title",
  date: "table.column.date",
  time: "table.column.time",
  project: "table.column.project",
  tags: "table.column.tags",
  priority: "table.column.priority",
  estimate: "table.column.estimate",
  recurring: "table.column.recurring",
  createdAt: "listControls.created",
};

const SORTABLE_COLUMNS: TableSortConfig["column"][] = [
  "date",
  "title",
  "priority",
  "project",
  "createdAt",
];

export function TableToolbar({
  filterConfig,
  sortConfig,
  availableTags,
  tableSort,
  isSelectionMode,
  onFilterChange,
  onSortChange,
  onTableSortChange,
  onToggleSelectionMode,
  onCreateItem,
}: TableToolbarProps) {
  const { t } = useI18n();

  function toggleDirection() {
    const next: TableSortDirection = tableSort.direction === "asc" ? "desc" : "asc";
    onTableSortChange({ ...tableSort, direction: next });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCreateItem}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-[#f4f0ec]/50 px-4 py-1.5 text-xs font-medium tracking-wide text-[#7d7880] transition-colors hover:text-[#5f5a63] dark:border-white/8 dark:bg-white/8 dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("empty.createTask")}
      </button>

      <ListControlsButton
        filterConfig={filterConfig}
        sortConfig={sortConfig}
        availableTags={availableTags}
        onFilterChange={onFilterChange}
        onSortChange={onSortChange}
        mode="list"
      />

      <div className="relative">
        <button
          type="button"
          onClick={toggleDirection}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition-colors",
            "border-black/8 bg-[#f4f0ec]/50 text-[#7d7880] hover:text-[#5f5a63] dark:border-white/8 dark:bg-white/8 dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]",
          )}
          title={t("listControls.sort" as Parameters<typeof t>[0])}
        >
          <ArrowDownAZ className="h-3.5 w-3.5" />
          {t(SORT_LABELS[tableSort.column] as Parameters<typeof t>[0])}
          <span className="text-[#9f99a3]">
            {tableSort.direction === "asc" ? "↑" : "↓"}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {SORTABLE_COLUMNS.map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => onTableSortChange({ column: col, direction: "asc" })}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
              tableSort.column === col
                ? "bg-[#25242a] text-white dark:bg-[#f5f5f5] dark:text-[#101010]"
                : "bg-[#f4f0ec]/50 text-[#7d7880] hover:text-[#5f5a63] dark:bg-white/8 dark:text-[#a3a3a3]",
            )}
          >
            {t(SORT_LABELS[col] as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleSelectionMode}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide transition-colors",
          isSelectionMode
            ? "border-black/12 bg-white text-[#25242a] shadow-sm"
            : "border-black/8 bg-[#f4f0ec]/50 text-[#7d7880] hover:text-[#5f5a63]",
        )}
      >
        {isSelectionMode ? (
          <X className="h-3.5 w-3.5" />
        ) : (
          <Filter className="h-3.5 w-3.5" />
        )}
        {isSelectionMode ? t("common.cancel") : t("listControls.select" as Parameters<typeof t>[0])}
      </button>
    </div>
  );
}
```

> The keys `listControls.sort` and `listControls.select` may need to be added to all 7 locales. Check whether they exist; if not, reuse existing keys (e.g. `common.cancel` already exists) and adjust accordingly.

### Step 2: Run typecheck

Run: `npx tsc --noEmit`
Expected: PASS.

### Step 3: Commit

```bash
git add components/all-page/table/table-toolbar.tsx
git commit -m "feat(table): add table toolbar with sort/filter/select"
```

---

## Task 9: Create the main `TableView` component

**Files:**
- Create: `components/all-page/table/table-view.tsx`

### Step 1: Implement the table view

Create [components/all-page/table/table-view.tsx](file:///d:/FJ/Orkest/orkest/components/all-page/table/table-view.tsx):

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useI18n } from "@/lib/i18n";
import {
  filterSections,
  getListItemKey,
  getFilteredListItems,
} from "@/components/all-page/list-view";
import { CheckCircle, Circle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableHeader } from "./table-header";
import { TableRow } from "./table-row";
import { TableQuickAddRow } from "./table-quick-add-row";
import { TableEmptyState } from "./table-empty-state";
import { TableToolbar } from "./table-toolbar";
import { defaultTableSort, sortTableRows } from "@/lib/table-sort";
import type {
  ListFilterConfig,
  ListSortConfig,
  Section,
} from "@/lib/types/all-page";

type TableViewProps = {
  sections: Section[];
  filterConfig: ListFilterConfig;
  sortConfig: ListSortConfig;
  availableTags: string[];
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  onSelectionModeChange: (value: boolean) => void;
  onSelectedIdsChange: Dispatch<SetStateAction<Set<string>>>;
  onFilterChange: (update: Partial<ListFilterConfig>) => void;
  onSortChange: (update: Partial<ListSortConfig>) => void;
  onClearFilters: () => void;
};

function hasActiveFilters(config: ListFilterConfig): boolean {
  return (
    config.timePreset !== "none" ||
    config.status !== "all" ||
    config.selectedTags.length > 0 ||
    config.selectedPriorities.length > 0 ||
    config.selectedProjectIds.length > 0 ||
    !!config.searchQuery?.trim()
  );
}

function BatchActionBar({
  selectedCount,
  allCompleted,
  allActive,
  onComplete,
  onUndoComplete,
  onDelete,
  onCancel,
}: {
  selectedCount: number;
  allCompleted: boolean;
  allActive: boolean;
  onComplete: () => void;
  onUndoComplete: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/80 px-5 py-3 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#1e1e1e]/80">
      <span className="text-sm font-medium text-[#525059] dark:text-[#d4d4d4]">
        {selectedCount} {t("batch.selected")}
      </span>
      {allActive ? (
        <Button size="sm" variant="outline" onClick={onComplete} className="h-8 gap-1.5 text-xs border-green-200 text-green-600">
          <CheckCircle className="h-3.5 w-3.5" /> {t("batch.complete")}
        </Button>
      ) : null}
      {allCompleted ? (
        <Button size="sm" variant="outline" onClick={onUndoComplete} className="h-8 gap-1.5 text-xs">
          <Circle className="h-3.5 w-3.5" /> {t("batch.undo")}
        </Button>
      ) : null}
      <Button size="sm" variant="outline" onClick={onDelete} className="h-8 gap-1.5 text-xs border-red-200 text-red-500">
        <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
      </Button>
      <div className="w-px h-5 bg-black/10 dark:bg-white/15 mx-1" />
      <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 gap-1 text-xs">
        <X className="h-3.5 w-3.5" /> {t("common.cancel")}
      </Button>
    </div>
  );
}

export function TableView({
  sections,
  filterConfig,
  sortConfig,
  availableTags,
  isSelectionMode,
  selectedIds,
  onSelectionModeChange,
  onSelectedIdsChange,
  onFilterChange,
  onSortChange,
  onClearFilters,
}: TableViewProps) {
  const { t } = useI18n();
  const density = useSettingsStore((s) => s.density);
  const isCompact = density === "compact";
  const openComposer = useAllPageStore((s) => s.openComposer);
  const handleEditItem = useAllPageStore((s) => s.handleEditItem);
  const handleBatchDelete = useAllPageStore((s) => s.handleBatchDelete);
  const handleBatchToggleComplete = useAllPageStore((s) => s.handleBatchToggleComplete);

  const [tableSort, setTableSort] = useState(() => defaultTableSort());

  const items = useMemo(
    () => getFilteredListItems(sections, filterConfig),
    [sections, filterConfig],
  );
  const sortedItems = useMemo(
    () => sortTableRows(items, tableSort),
    [items, tableSort],
  );
  const isFiltered = hasActiveFilters(filterConfig);

  const allSelected = useMemo(
    () => sortedItems.length > 0 && sortedItems.every((it) => selectedIds.has(getListItemKey(it))),
    [sortedItems, selectedIds],
  );

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectedIdsChange((prev) => {
        const next = new Set(prev);
        for (const it of sortedItems) {
          next.delete(getListItemKey(it));
        }
        return next;
      });
    } else {
      onSelectedIdsChange((prev) => {
        const next = new Set(prev);
        for (const it of sortedItems) {
          next.add(getListItemKey(it));
        }
        return next;
      });
    }
  }, [allSelected, sortedItems, onSelectedIdsChange]);

  const toggleSelect = useCallback((itemKey: string) => {
    onSelectedIdsChange((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  }, [onSelectedIdsChange]);

  const selectedItems = useMemo(
    () => sortedItems.filter((it) => selectedIds.has(getListItemKey(it))),
    [sortedItems, selectedIds],
  );

  const allCompleted = selectedItems.length > 0 && selectedItems.every((it) => it.status === "completed");
  const allActive = selectedItems.length > 0 && selectedItems.every((it) => it.status !== "completed");

  const clearSelection = useCallback(() => {
    onSelectionModeChange(false);
    onSelectedIdsChange(new Set());
  }, [onSelectionModeChange, onSelectedIdsChange]);

  const handleBatchComplete = useCallback(() => {
    handleBatchToggleComplete(selectedItems, "completed");
    clearSelection();
  }, [selectedItems, handleBatchToggleComplete, clearSelection]);
  const handleBatchUndo = useCallback(() => {
    handleBatchToggleComplete(selectedItems, "active");
    clearSelection();
  }, [selectedItems, handleBatchToggleComplete, clearSelection]);
  const handleBatchDeleteAction = useCallback(() => {
    handleBatchDelete(selectedItems);
    clearSelection();
  }, [selectedItems, handleBatchDelete, clearSelection]);

  if (sortedItems.length === 0) {
    return (
      <div className="space-y-4">
        <TableToolbar
          filterConfig={filterConfig}
          sortConfig={sortConfig}
          availableTags={availableTags}
          tableSort={tableSort}
          isSelectionMode={isSelectionMode}
          onFilterChange={onFilterChange}
          onSortChange={onSortChange}
          onTableSortChange={setTableSort}
          onToggleSelectionMode={() => {
            if (isSelectionMode) clearSelection();
            else onSelectionModeChange(true);
          }}
          onCreateItem={() => openComposer()}
        />
        <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white/40 dark:border-white/8 dark:bg-white/[0.04]">
          <table className="w-full table-fixed border-collapse text-sm">
            <TableHeader
              sort={tableSort}
              onSortChange={setTableSort}
              isSelectionMode={isSelectionMode}
              allSelected={allSelected}
              onToggleSelectAll={toggleSelectAll}
            />
            <tbody>
              <TableQuickAddRow />
            </tbody>
          </table>
        </div>
        <TableEmptyState isFiltered={isFiltered} />
        {isFiltered ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-full border border-black/8 bg-white px-4 py-1.5 text-xs font-medium tracking-wide text-[#525059] hover:text-[#25242a] dark:border-white/8 dark:text-[#a3a3a3]"
            >
              {t("common.clearFilters")}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TableToolbar
        filterConfig={filterConfig}
        sortConfig={sortConfig}
        availableTags={availableTags}
        tableSort={tableSort}
        isSelectionMode={isSelectionMode}
        onFilterChange={onFilterChange}
        onSortChange={onSortChange}
        onTableSortChange={setTableSort}
        onToggleSelectionMode={() => {
          if (isSelectionMode) clearSelection();
          else onSelectionModeChange(true);
        }}
        onCreateItem={() => openComposer()}
      />

      <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white/40 dark:border-white/8 dark:bg-white/[0.04]">
        <table className="w-full border-collapse text-sm">
          <TableHeader
            sort={tableSort}
            onSortChange={setTableSort}
            isSelectionMode={isSelectionMode}
            allSelected={allSelected}
            onToggleSelectAll={toggleSelectAll}
          />
          <tbody>
            <TableQuickAddRow />
            {sortedItems.map((item) => {
              const key = getListItemKey(item);
              return (
                <TableRow
                  key={key}
                  item={item}
                  itemKey={key}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(key)}
                  isCompact={isCompact}
                  onToggleSelect={toggleSelect}
                  onOpen={handleEditItem}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {isSelectionMode && selectedItems.length > 0 ? (
        <BatchActionBar
          selectedCount={selectedItems.length}
          allCompleted={allCompleted}
          allActive={allActive}
          onComplete={handleBatchComplete}
          onUndoComplete={handleBatchUndo}
          onDelete={handleBatchDeleteAction}
          onCancel={clearSelection}
        />
      ) : null}
    </div>
  );
}
```

> Note: `handleEditItem` is the existing store action the List view uses. Verify the exact signature by reading [lib/stores/use-all-page-store.ts](file:///d:/FJ/Orkest/orkest/lib/stores/use-all-page-store.ts) and adjust `onOpen` if needed.

### Step 2: Run typecheck

Run: `npx tsc --noEmit`
Expected: PASS (any small type nits — fix inline).

### Step 3: Commit

```bash
git add components/all-page/table/table-view.tsx
git commit -m "feat(table): add main TableView component"
```

---

## Task 10: Wire the Table view into the AllPage (tab + render branch)

**Files:**
- Modify: `app/(shell)/all/page.tsx` (multiple small edits)

### Step 1: Import the new view

In [app/(shell)/all/page.tsx](file:///d:/FJ/Orkest/orkest/app/(shell)/all/page.tsx) (~line 30), add the import alongside the existing `KanbanView` import:

```ts
import { TableView } from "@/components/all-page/table/table-view";
```

### Step 2: Widen the local view-mode state type

Find the existing `useState<"timeline" | "list" | "calendar" | "kanban">` declaration and change it to:

```ts
const [viewMode, setViewModeState] = useState<"timeline" | "list" | "calendar" | "kanban" | "table">(allDefaultView);
```

Also widen the two `useCallback` declarations for `setViewMode` / `setViewModeWithScroll` to use the same union.

### Step 3: Update the keyboard shortcut cycle

Find the `useKeyboardShortcuts` call that has the `key: "v"` handler and the array `["timeline", "list", "calendar", "kanban"]`. Change it to:

```ts
const order = ["timeline", "list", "calendar", "kanban", "table"] as const;
const currentIndex = order.indexOf(viewMode as typeof order[number]);
const next = order[(currentIndex + 1) % order.length];
setViewModeWithScroll(next);
```

### Step 4: Add a 5th column to the view-mode tab strip

In the segmented control block (look for `grid-cols-4` and the `viewMode === "kanban"` ternary), update the wrapper to `grid-cols-5` and the sliding background's index calculation so the new "table" tab gets index 4:

```tsx
<div className="relative grid grid-cols-5 rounded-full ...">
  <div
    className="absolute top-0.5 bottom-0.5 rounded-full bg-[#ffffff] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#d4d4d4]"
    style={{
      left: `calc(2px + ${viewMode === "timeline" ? 0 : viewMode === "list" ? 1 : viewMode === "calendar" ? 2 : viewMode === "kanban" ? 3 : 4} * (100% - 4px) / 5)`,
      width: "calc((100% - 4px) / 5)",
    }}
  />
  {/* existing 4 buttons unchanged ... */}
  <button
    type="button"
    onClick={() => (showStickyHeader ? setViewModeWithScroll : setViewMode)("table")}
    className={`relative z-10 flex cursor-pointer items-center justify-center rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
      viewMode === "table"
        ? "text-[#1a1a1a] dark:text-[#000000]"
        : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
    }`}
  >
    {t("settings.view.table")}
  </button>
</div>
```

(You can also pick a lucide-react icon — `Table2` from `lucide-react` is the closest match — and place it next to the label. Optional.)

### Step 5: Add the table branch to the main view switch

Find the existing view switch (around `viewMode === "timeline" ? <SectionList /> : viewMode === "list" ? <ListView /> : viewMode === "kanban" ? <KanbanView /> : <CalendarView />`). Add a new branch right after the kanban branch:

```tsx
) : viewMode === "table" ? (
  <TableView
    sections={sections}
    filterConfig={listFilterConfig}
    sortConfig={listSortConfig}
    availableTags={availableListTags}
    isSelectionMode={isListSelectionMode}
    selectedIds={listSelectedIds}
    onSelectionModeChange={setIsListSelectionMode}
    onSelectedIdsChange={setListSelectedIds}
    onFilterChange={setListFilterConfig}
    onSortChange={setListSortConfig}
    onClearFilters={() =>
      setListFilterConfig({
        timePreset: "none",
        selectedTags: [],
        selectedPriorities: [],
        searchQuery: "",
        status: "all",
        selectedProjectIds: [],
      })
    }
  />
) : (
  <CalendarView ... />
)}
```

### Step 6: Add a right-side header action row for the table view

The list view has dedicated right-side buttons (selection mode, density, ListControlsButton). Add a similar block to keep the layout consistent:

```tsx
{viewMode === "table" && (
  <div className="hidden" /> /* Toolbar is rendered inside TableView itself; no extra buttons needed. */
)}
```

If you want the density toggle to be available in the table view too, copy the density toggle button from the list branch (or kanban) and gate it on `viewMode === "table"`. Keep this minimal: the toolbar inside `TableView` already covers sort/filter/select/create.

### Step 7: Run typecheck + dev server

Run: `npx tsc --noEmit`
Expected: PASS.

Then: `npm run dev` and navigate to `/all`. Click the **Table** tab. Verify:
- The table renders with all filtered items
- Clicking a column header toggles sort direction
- Clicking a row opens the ItemForm
- Clicking the status circle toggles complete
- Selection mode checkbox + batch actions work
- "Quick add" row opens the composer with a pre-filled title

### Step 8: Commit

```bash
git add app/\(shell\)/all/page.tsx
git commit -m "feat(all): wire table view into AllPage tab strip and switch"
```

---

## Task 11: Add the "Table" option to the Settings → default view picker

**Files:**
- Modify: `app/(shell)/settings/page.tsx` (~lines 1114-1126)

### Step 1: Add a 5th entry to the `allDefaultView` options array

In [app/(shell)/settings/page.tsx](file:///d:/FJ/Orkest/orkest/app/(shell)/settings/page.tsx#L1114), change the array literal to include a `Table` option with the `Table2` icon (imported from `lucide-react`). Also widen the wrapper grid from `lg:grid-cols-4` to `lg:grid-cols-5`:

```tsx
import { List, LayoutList, Calendar, LayoutGrid, Table2 } from "lucide-react";
...
<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
  {([
    { value: "timeline" as const, label: t("settings.view.timeline"), icon: List },
    { value: "list" as const, label: t("settings.view.list"), icon: LayoutList },
    { value: "calendar" as const, label: t("settings.view.calendar"), icon: Calendar },
    { value: "kanban" as const, label: t("settings.view.kanban"), icon: LayoutGrid },
    { value: "table" as const, label: t("settings.view.table"), icon: Table2 },
  ] satisfies { value: AllDefaultView; label: string; icon: typeof List }[]).map((option) => {
    ...
  })}
</div>
```

### Step 2: Verify

Run: `npx tsc --noEmit`
Expected: PASS.

### Step 3: Commit

```bash
git add app/\(shell\)/settings/page.tsx
git commit -m "feat(settings): add table view to default view picker"
```

---

## Task 12: Run the full test suite + lint

**Files:** (none)

### Step 1: Run all tests

Run: `npx vitest run`
Expected: all existing tests pass, plus the 6 new tests in `lib/__tests__/table-sort.test.ts`.

### Step 2: Run lint

Run: `npm run lint`
Expected: no new errors introduced by the table view files.

### Step 3: Manual smoke test

- [ ] `/all` page loads without console errors.
- [ ] Clicking the new **Table** tab renders a table of all items.
- [ ] Header sort arrows work for every column.
- [ ] Status toggle (left circle) marks items complete and reorders them.
- [ ] Clicking a row opens the existing ItemForm for editing.
- [ ] Quick-add row opens the composer with the typed title.
- [ ] Selection mode → batch complete / undo / delete works.
- [ ] Density toggle (compact / default) reduces row height as expected.
- [ ] All 7 locales render the new column labels (spot-check by switching language in Settings).
- [ ] Settings → All page default view shows 5 options including "Table".
- [ ] Cycling views with the `V` keyboard shortcut now includes `table`.

### Step 4: Final commit (if any tweaks were needed)

```bash
git add -A
git commit -m "chore(table): final tweaks after manual smoke test"
```

---

## Out of Scope (deferred)

These are deliberately **not** part of this plan to keep the change focused. They can be future iterations:

- Per-column resizing (drag handles).
- Per-column show/hide menu.
- Inline editing of cells (currently rows are read-only except the status circle and the title that opens the form).
- Server-side pagination / virtualization for users with thousands of items. (For now, rely on existing filter system.)
- Drag-to-reorder rows. (Drag still works the same way it does in list view — item-card drag → calendar/today drop.)
- Sticky column on horizontal scroll. (Set the `table-layout: fixed` and use `min-w` on `<th>` if you want sticky behavior later.)

---

## Notes on Risks

- **Reusing `handleEditItem`:** Double-check the signature in `lib/stores/use-all-page-store.ts`. If it expects an `Item` (not a `DisplayItem`), pass the original record by looking it up the way the kanban column does (see `kanban-column.tsx`'s `findItemForDrop`).
- **Dense info on small screens:** The horizontal scroll on the `<table>` is intentional; do not collapse the layout further without feedback from the design pass.
- **Dictionary type:** The `Dictionary` type is defined near the top of `lib/i18n/dictionary.ts`. If it's a closed `Record<keyof typeof en, string>`, missing a key in any other locale will fail the build. Add all 7 in one go.
- **Date/time formatters:** The `formatItemTime` helper respects the user's locale + 12h/24h preference. Use it in the title/date cell if you want a richer display, but keep the time column simple (`Intl.DateTimeFormat` with the user's hour12 setting). Verify by reading [lib/all-page-utils.ts](file:///d:/FJ/Orkest/orkest/lib/all-page-utils.ts#L240).
