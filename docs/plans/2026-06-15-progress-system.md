# Progress System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a **Progress** system that lets users create multiple progress trackers (each with a goal), bind tasks to them, and view completion by count / percentage — with AI-assisted creation, goal setting, task binding, and insights.

**Architecture:** Mirror the existing `Project` pattern end-to-end. Add a new `progresses` table + `progress_tasks` join table in Supabase, a Zustand store (`useProgressStore`) with offline-sync and realtime, two new routes (`/progress` list, `/progress/[id]` detail), a single top-level sidebar nav button (same level as Today/All/Focus — **no** card list in the sidebar, the list page itself is the only place to see all progresses), and extend the existing AI chat pipeline with five new `AiProposedAction` kinds (`create_progress`, `update_progress`, `delete_progress`, `bind_tasks_to_progress`, `unbind_tasks_from_progress`). Compute progress stats (count, percentage, velocity) in a pure helper so the same numbers are usable in the UI, the AI context, and tests.

**Tech Stack:** Next.js 16 (App Router), React 19, Zustand 5, Tailwind 4, TypeScript 5, Vitest 4, Supabase JS 2 + RLS, lucide-react. **Read `node_modules/next/dist/docs/` before writing any code** (per `AGENTS.md`).

---

## Files Touched (Quick Index)

| Type | Path |
|---|---|
| Create | `supabase/migrations/progresses.sql` |
| Create | `lib/types/progress.ts` |
| Create | `lib/progress/progress-stats.ts` |
| Create | `lib/__tests__/progress-stats.test.ts` |
| Create | `lib/stores/use-progress-store.ts` |
| Create | `lib/realtime/use-realtime-progresses.ts` |
| Create | `components/progress/progress-page.tsx` |
| Create | `components/progress/progress-card.tsx` |
| Create | `components/progress/progress-form-modal.tsx` |
| Create | `components/progress/progress-detail-page.tsx` |
| Create | `components/progress/progress-task-list.tsx` |
| Create | `components/progress/progress-task-picker.tsx` |
| Create | `components/progress/progress-overview.tsx` |
| Create | `components/progress/progress-empty-state.tsx` |
| Create | `app/(shell)/progress/page.tsx` |
| Create | `app/(shell)/progress/[id]/page.tsx` |
| Create | `app/[locale]/(shell)/progress/page.tsx` |
| Create | `app/[locale]/(shell)/progress/[id]/page.tsx` |
| Modify | `lib/supabase/database.types.ts` |
| Modify | `lib/offline/types.ts` |
| Modify | `lib/offline/sync-engine.ts` |
| Modify | `lib/realtime/realtime-provider.tsx` |
| Modify | `lib/contexts/ai-chat-context.tsx` |
| Modify | `lib/ai/chat-types.ts` |
| Modify | `lib/hooks/use-ai-chat.ts` (only if it surfaces tool wiring — read first) |
| Modify | `app/api/ai-chat/route.ts` (only if it pre-loads context — read first) |
| Modify | `app/ui/sidebar-layout.tsx` (add Progress nav entry, register tab) |
| Modify | `lib/i18n/dictionary.ts` (7 locales) |

## Conventions

- Bite-sized steps. Each numbered step is one action (2–5 minutes).
- TDD: failing test first, then minimal implementation, then passing test, then commit.
- Frequent commits — one per task (or per logical sub-step inside a task).
- All user-facing strings go through `useI18n()` with a key added to **all 7 locales** (`en`, `zh-CN`, `es`, `fr`, `de`, `ja`, `pt`).
- No new dependencies. Reuse `lucide-react` icons, `EmptyState`, `Button`, `ColorPicker`, `PROJECTS_SECTION_EXPAND_EVENT` pattern (mirror it for progress), `useI18n`, `useAuth`, `useAllPageStore`, `useProjectStore`, `useRealtime*`, and the `syncRecord` / `syncTable` helpers in `lib/offline/sync-engine.ts`.
- Reuse the existing `createClient` / `createServerClient` / `makeUid` utilities.
- No emojis in UI, comments, or commit messages.
- Mirror the optimistic-update + `syncRecord` pattern used by `useProjectStore` so offline-first behavior is consistent.

---

## Data Model (reference)

### `progresses` table

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | `makeUid()` |
| `user_id` | `uuid` FK | RLS: `auth.uid() = user_id` |
| `name` | `text` | required, ≤ 80 chars |
| `description` | `text` | optional, ≤ 500 chars |
| `goal_value` | `numeric` | required, > 0 (raw count target) |
| `goal_unit` | `text` | e.g. `"tasks"`, `"pages"`, `"hours"`, `"$"` — freeform label |
| `tracking_mode` | `text` | `"count"` \| `"percentage"` \| `"manual"` |
| `manual_value` | `numeric` | current value when `tracking_mode = "manual"` |
| `color` | `text` | hex, validated by `normalizeProjectColor` |
| `status` | `text` | `"active"` \| `"completed"` \| `"archived"` |
| `target_date` | `date` | optional ISO `YYYY-MM-DD` |
| `sort_order` | `integer` | for sidebar reordering |
| `ai_context` | `jsonb` | optional AI-generated summary / reasoning |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

### `progress_tasks` join table

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | `makeUid()` |
| `progress_id` | `text` FK → `progresses.id` | `ON DELETE CASCADE` |
| `item_id` | `text` FK → `items.id` | `ON DELETE CASCADE` |
| `weight` | `numeric` | default `1.0` (allows weighted counts, e.g. 1 task = 2 units) |
| `added_at` | `timestamptz` | default `now()` |

UNIQUE(`progress_id`, `item_id`).

### RLS

Both tables: enable RLS, policies `select / insert / update / delete` keyed on `user_id = auth.uid()`. The migration must include the standard `auth.uid()` policies and the CASCADE for `progress_tasks` — copy the style used in `recurrence_enhancement.sql` / `project_sort_order.sql`.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/progresses.sql`

### Step 1: Write the migration

Create [supabase/migrations/progresses.sql](file:///d:/FJ/Orkest/orkest/supabase/migrations/progresses.sql):

```sql
-- Progress system: user-defined progress trackers with goals and bound tasks.

CREATE TABLE IF NOT EXISTS progresses (
  id              text PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description     text CHECK (description IS NULL OR char_length(description) <= 500),
  goal_value      numeric NOT NULL CHECK (goal_value > 0),
  goal_unit       text NOT NULL DEFAULT 'tasks' CHECK (char_length(goal_unit) <= 40),
  tracking_mode   text NOT NULL DEFAULT 'count' CHECK (tracking_mode IN ('count', 'percentage', 'manual')),
  manual_value    numeric NOT NULL DEFAULT 0 CHECK (manual_value >= 0),
  color           text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  target_date     date,
  sort_order      integer,
  ai_context      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progresses_user ON progresses(user_id);
CREATE INDEX IF NOT EXISTS idx_progresses_user_sort_order ON progresses(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_progresses_user_status ON progresses(user_id, status);

CREATE TABLE IF NOT EXISTS progress_tasks (
  id           text PRIMARY KEY,
  progress_id  text NOT NULL REFERENCES progresses(id) ON DELETE CASCADE,
  item_id      text NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  weight       numeric NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  added_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (progress_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_tasks_progress ON progress_tasks(progress_id);
CREATE INDEX IF NOT EXISTS idx_progress_tasks_item ON progress_tasks(item_id);

ALTER TABLE progresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_tasks ENABLE ROW LEVEL SECURITY;

-- progresses policies
DROP POLICY IF EXISTS "progresses_select_own" ON progresses;
CREATE POLICY "progresses_select_own" ON progresses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "progresses_insert_own" ON progresses;
CREATE POLICY "progresses_insert_own" ON progresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progresses_update_own" ON progresses;
CREATE POLICY "progresses_update_own" ON progresses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progresses_delete_own" ON progresses;
CREATE POLICY "progresses_delete_own" ON progresses
  FOR DELETE USING (auth.uid() = user_id);

-- progress_tasks policies (enforce user ownership via the parent row)
DROP POLICY IF EXISTS "progress_tasks_select_own" ON progress_tasks;
CREATE POLICY "progress_tasks_select_own" ON progress_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "progress_tasks_insert_own" ON progress_tasks;
CREATE POLICY "progress_tasks_insert_own" ON progress_tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "progress_tasks_update_own" ON progress_tasks;
CREATE POLICY "progress_tasks_update_own" ON progress_tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "progress_tasks_delete_own" ON progress_tasks;
CREATE POLICY "progress_tasks_delete_own" ON progress_tasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM progresses p WHERE p.id = progress_tasks.progress_id AND p.user_id = auth.uid())
  );
```

### Step 2: Commit

```bash
git add supabase/migrations/progresses.sql
git commit -m "feat(db): add progresses and progress_tasks tables with RLS"
```

---

## Task 2: Extend the generated Supabase types

**Files:**
- Modify: `lib/supabase/database.types.ts` (add `progresses` and `progress_tasks` table types)

### Step 1: Add the type entries

In [lib/supabase/database.types.ts](file:///d:/FJ/Orkest/orkest/lib/supabase/database.types.ts), after the existing `projects` table entry (search for `"projects": {`), add the two new tables. Mirror the `Row` / `Insert` / `Update` shape used by `projects`, with the columns from Task 1.

```ts
progresses: {
  Row: {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    goal_value: number;
    goal_unit: string;
    tracking_mode: "count" | "percentage" | "manual";
    manual_value: number;
    color: string | null;
    status: "active" | "completed" | "archived";
    target_date: string | null;
    sort_order: number | null;
    ai_context: Json | null;
    created_at: string;
    updated_at: string;
  };
  Insert: { /* same keys, all optional except `id`, `user_id`, `name`, `goal_value`, `goal_unit`, `tracking_mode`, `manual_value`, `status` */ };
  Update: { /* same keys, all optional */ };
  Relationships: [];
};
progress_tasks: {
  Row: {
    id: string;
    progress_id: string;
    item_id: string;
    weight: number;
    added_at: string;
  };
  Insert: { id: string; progress_id: string; item_id: string; weight?: number; added_at?: string };
  Update: { weight?: number };
  Relationships: [];
};
```

### Step 2: Verify with typecheck

Run: `npx tsc --noEmit`
Expected: PASS.

### Step 3: Commit

```bash
git add lib/supabase/database.types.ts
git commit -m "feat(types): add progresses and progress_tasks database types"
```

---

## Task 3: Domain types

**Files:**
- Create: `lib/types/progress.ts`

### Step 1: Write the types

Create [lib/types/progress.ts](file:///d:/FJ/Orkest/orkest/lib/types/progress.ts):

```ts
export type ProgressTrackingMode = "count" | "percentage" | "manual";
export type ProgressStatus = "active" | "completed" | "archived";

export interface Progress {
  id: string;
  userId: string;
  name: string;
  description?: string;
  goalValue: number;
  goalUnit: string;
  trackingMode: ProgressTrackingMode;
  manualValue: number;
  color?: string;
  status: ProgressStatus;
  targetDate?: string;
  sortOrder?: number;
  aiContext?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressTaskLink {
  id: string;
  progressId: string;
  itemId: string;
  weight: number;
  addedAt: Date;
}

export type ProgressSortMode = "default" | "alpha" | "recent" | "completion";
```

### Step 2: Commit

```bash
git add lib/types/progress.ts
git commit -m "feat(types): add Progress and ProgressTaskLink types"
```

---

## Task 4: Pure progress-stats helper (TDD)

**Files:**
- Create: `lib/progress/progress-stats.ts`
- Create: `lib/__tests__/progress-stats.test.ts`

### Step 1: Write the failing tests

Create [lib/__tests__/progress-stats.test.ts](file:///d:/FJ/Orkest/orkest/lib/__tests__/progress-stats.test.ts):

```ts
import { describe, it, expect } from "vitest";
import {
  computeProgressStats,
  sortProgresses,
} from "../progress/progress-stats";
import type { Progress } from "../types/progress";
import type { ManualItemRecord } from "../types/all-page";

function makeProgress(overrides: Partial<Progress> = {}): Progress {
  return {
    id: "p-1",
    userId: "u-1",
    name: "Read 10 books",
    goalValue: 10,
    goalUnit: "books",
    trackingMode: "count",
    manualValue: 0,
    status: "active",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  } as Progress;
}

function makeItem(overrides: Partial<ManualItemRecord> = {}): ManualItemRecord {
  return {
    id: "i-1",
    uid: "uid-1",
    title: "Read book 1",
    hasTime: false,
    allDay: false,
    recurrenceType: "none",
    recurrenceInterval: 1,
    daysOfWeek: [],
    recurrenceEndType: "never",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  } as ManualItemRecord;
}

describe("computeProgressStats", () => {
  it("returns zero completion when no tasks are bound", () => {
    const [p] = computeProgressStats([makeProgress()], []);
    expect(p).toMatchObject({ total: 0, completed: 0, currentValue: 0, percent: 0 });
  });

  it("counts completed and active tasks for count mode", () => {
    const [p] = computeProgressStats([makeProgress()], [
      makeItem({ id: "i-1", status: "completed" }),
      makeItem({ id: "i-2", status: "active" }),
      makeItem({ id: "i-3", status: "completed" }),
    ]);
    expect(p.total).toBe(3);
    expect(p.completed).toBe(2);
    expect(p.currentValue).toBe(2);
    expect(p.percent).toBe(20); // 2 / 10
  });

  it("uses manualValue in manual mode and ignores task list", () => {
    const [p] = computeProgressStats(
      [makeProgress({ trackingMode: "manual", manualValue: 4, goalValue: 5 })],
      [makeItem({ id: "i-1", status: "completed" })],
    );
    expect(p.currentValue).toBe(4);
    expect(p.percent).toBe(80);
  });

  it("clamps percent to [0, 100]", () => {
    const [p] = computeProgressStats(
      [makeProgress({ goalValue: 2, manualValue: 99, trackingMode: "manual" })],
      [],
    );
    expect(p.percent).toBe(100);
  });

  it("skips soft-deleted and subtask items", () => {
    const [p] = computeProgressStats([makeProgress()], [
      makeItem({ id: "i-1", status: "completed" }),
      makeItem({ id: "i-2", status: "completed", deletedAt: "2025-02-01" }),
      makeItem({ id: "i-3", status: "completed", parentId: "parent" }),
    ]);
    expect(p.total).toBe(1);
    expect(p.completed).toBe(1);
  });

  it("preserves the original progress order", () => {
    const result = computeProgressStats(
      [makeProgress({ id: "p-2" }), makeProgress({ id: "p-1" })],
      [],
    );
    expect(result.map((p) => p.id)).toEqual(["p-2", "p-1"]);
  });
});

describe("sortProgresses", () => {
  const a = makeProgress({ id: "a", name: "Alpha", sortOrder: 2, updatedAt: new Date("2025-01-02") });
  const b = makeProgress({ id: "b", name: "Beta", sortOrder: 1, updatedAt: new Date("2025-01-03") });

  it("sorts by sortOrder for default mode", () => {
    expect(sortProgresses([a, b], "default").map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("sorts alphabetically for alpha mode", () => {
    expect(sortProgresses([a, b], "alpha").map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("sorts by updatedAt desc for recent mode", () => {
    expect(sortProgresses([a, b], "recent").map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("sorts by completion desc for completion mode", () => {
    const full = makeProgress({ id: "full", goalValue: 10, manualValue: 10, trackingMode: "manual" });
    const empty = makeProgress({ id: "empty" });
    expect(sortProgresses([empty, full], "completion").map((p) => p.id)).toEqual(["full", "empty"]);
  });
});
```

### Step 2: Run tests to confirm they fail

Run: `npm test -- --run lib/__tests__/progress-stats.test.ts`
Expected: FAIL — module not found.

### Step 3: Implement the helper

Create [lib/progress/progress-stats.ts](file:///d:/FJ/Orkest/orkest/lib/progress/progress-stats.ts):

```ts
import type { Progress, ProgressSortMode } from "../types/progress";
import type { ManualItemRecord } from "../types/all-page";

export type ProgressWithStats = Progress & {
  total: number;
  completed: number;
  /** Number of bound tasks. */
  boundTaskCount: number;
  /** Effective current value (manual override or completed-task count). */
  currentValue: number;
  /** Integer percentage 0..100, clamped. */
  percent: number;
};

function clampPercent(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.round(value);
}

export function computeProgressStats(
  progresses: Progress[],
  items: ManualItemRecord[],
): ProgressWithStats[] {
  const completionByProgress = new Map<string, { total: number; completed: number }>();

  for (const progress of progresses) {
    completionByProgress.set(progress.id, { total: 0, completed: 0 });
  }

  for (const item of items) {
    if (item.deletedAt) continue;
    if (item.parentId) continue;
    if (!item.progressId) continue;
    const bucket = completionByProgress.get(item.progressId) ?? { total: 0, completed: 0 };
    bucket.total += 1;
    if (item.status === "completed") bucket.completed += 1;
    completionByProgress.set(item.progressId, bucket);
  }

  return progresses.map((progress) => {
    const bucket = completionByProgress.get(progress.id) ?? { total: 0, completed: 0 };
    const currentValue =
      progress.trackingMode === "manual" ? progress.manualValue : bucket.completed;
    const percent = progress.goalValue > 0
      ? clampPercent((currentValue / progress.goalValue) * 100)
      : 0;
    return {
      ...progress,
      total: bucket.total,
      completed: bucket.completed,
      boundTaskCount: bucket.total,
      currentValue,
      percent,
    };
  });
}

export function sortProgresses(
  progresses: ProgressWithStats[],
  mode: ProgressSortMode,
): ProgressWithStats[] {
  const copy = [...progresses];
  if (mode === "alpha") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (mode === "recent") {
    copy.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        || a.name.localeCompare(b.name),
    );
  } else if (mode === "completion") {
    copy.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  } else {
    copy.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }
  return copy;
}
```

> Note: this adds a `progressId?: string` field to `ManualItemRecord` for the count-mode case. See Task 13 — we do **not** store this on the items table; instead the count-mode uses the `progress_tasks` join and a derived map is computed in the store (see Task 7). The `progressId` field is therefore **only** used by the helper to look up an item's parent progress when reading pre-shaped records (such as those returned by realtime or an AI seed). Add `progressId?: string` to `ManualItemRecord` in [lib/types/all-page.ts](file:///d:/FJ/Orkest/orkest/lib/types/all-page.ts) immediately after `projectId`:

```ts
/** Set only for items virtually attached to a progress; not persisted on the items table. */
progressId?: string;
```

### Step 4: Run tests to confirm they pass

Run: `npm test -- --run lib/__tests__/progress-stats.test.ts`
Expected: PASS.

### Step 5: Commit

```bash
git add lib/progress/progress-stats.ts lib/__tests__/progress-stats.test.ts lib/types/all-page.ts
git commit -m "feat(progress): add progress stats helper with tests"
```

---

## Task 5: i18n keys (all 7 locales)

**Files:**
- Modify: `lib/i18n/dictionary.ts` (add new keys to each of the 7 locale blocks)

### Step 1: Add English keys

In the `en` block of [lib/i18n/dictionary.ts](file:///d:/FJ/Orkest/orkest/lib/i18n/dictionary.ts#L3) (near the existing `projects.*` group), add:

```ts
"nav.progress": "Progress",
"progress.title": "Progress",
"progress.newProgress": "New progress",
"progress.editProgress": "Edit progress",
"progress.namePlaceholder": "e.g. Read 10 books",
"progress.name": "Name",
"progress.description": "Description",
"progress.descriptionPlaceholder": "What does this progress track?",
"progress.goal": "Goal",
"progress.goalValue": "Goal value",
"progress.goalUnit": "Unit",
"progress.trackingMode": "Tracking",
"progress.trackingMode.count": "Count tasks",
"progress.trackingMode.percentage": "Percentage",
"progress.trackingMode.manual": "Manual value",
"progress.manualValue": "Current value",
"progress.targetDate": "Target date",
"progress.status.active": "Active",
"progress.status.completed": "Completed",
"progress.status.archived": "Archived",
"progress.empty.title": "No progress trackers yet",
"progress.empty.description": "Create one to start tracking goals across your tasks.",
"progress.detail.boundTasks": "Bound tasks",
"progress.detail.addTasks": "Add tasks",
"progress.detail.noTasks": "No tasks bound to this progress yet.",
"progress.detail.openInAll": "Open in All",
"progress.detail.edit": "Edit",
"progress.detail.delete": "Delete",
"progress.detail.deleteConfirm": "Delete this progress tracker?",
"progress.overview.percentComplete": "{percent}% complete",
"progress.overview.currentOfGoal": "{current} of {goal} {unit}",
"progress.overview.remaining": "{count} remaining",
"progress.error.createFailed": "Could not create progress",
"progress.error.updateFailed": "Could not update progress",
"progress.error.deleteFailed": "Could not delete progress",
"progress.taskPicker.title": "Bind tasks",
"progress.taskPicker.placeholder": "Search tasks...",
"progress.taskPicker.empty": "No matching tasks",
"progress.taskPicker.selected": "{count} selected",
"progress.taskPicker.bind": "Bind",
"progress.aiPrompt.create": "Create a progress tracker",
"progress.aiPrompt.suggestGoal": "Suggest a goal",
"progress.aiPrompt.bindTasks": "Bind related tasks",
"progress.aiPrompt.status": "Status of my progress",
```

### Step 2: Add the same key set to the other 6 locales

For each of `zh`, `es`, `fr`, `de`, `ja`, `pt`, add matching translations. Use the tone of the existing `projects.*` keys. Recommended Chinese translations:

```ts
"nav.progress": "进度",
"progress.title": "进度",
"progress.newProgress": "新建进度",
"progress.editProgress": "编辑进度",
"progress.namePlaceholder": "例如：读完 10 本书",
"progress.name": "名称",
"progress.description": "描述",
"progress.descriptionPlaceholder": "此进度跟踪什么？",
"progress.goal": "目标",
"progress.goalValue": "目标值",
"progress.goalUnit": "单位",
"progress.trackingMode": "方式",
"progress.trackingMode.count": "按任务计数",
"progress.trackingMode.percentage": "按百分比",
"progress.trackingMode.manual": "手动数值",
"progress.manualValue": "当前值",
"progress.targetDate": "目标日期",
"progress.status.active": "进行中",
"progress.status.completed": "已完成",
"progress.status.archived": "已归档",
"progress.empty.title": "还没有进度",
"progress.empty.description": "创建一个，开始跟踪你的目标。",
"progress.detail.boundTasks": "已绑定任务",
"progress.detail.addTasks": "添加任务",
"progress.detail.noTasks": "此进度还没有绑定任务。",
"progress.detail.openInAll": "在全部中打开",
"progress.detail.edit": "编辑",
"progress.detail.delete": "删除",
"progress.detail.deleteConfirm": "确认删除此进度？",
"progress.overview.percentComplete": "已完成 {percent}%",
"progress.overview.currentOfGoal": "{current}/{goal} {unit}",
"progress.overview.remaining": "还剩 {count}",
"progress.error.createFailed": "无法创建进度",
"progress.error.updateFailed": "无法更新进度",
"progress.error.deleteFailed": "无法删除进度",
"progress.taskPicker.title": "绑定任务",
"progress.taskPicker.placeholder": "搜索任务...",
"progress.taskPicker.empty": "没有匹配的任务",
"progress.taskPicker.selected": "已选 {count}",
"progress.taskPicker.bind": "绑定",
"progress.aiPrompt.create": "创建一个进度",
"progress.aiPrompt.suggestGoal": "为目标建议一个值",
"progress.aiPrompt.bindTasks": "绑定相关任务",
"progress.aiPrompt.status": "我的进度状态",
```

Provide matching translations for `es`, `fr`, `de`, `ja`, `pt` using the same tone and capitalization as the existing `projects.*` entries. A translator can fill these in during the implementation; do **not** ship with English fallbacks in non-en locales.

### Step 3: Verify the dictionary type still compiles

Run: `npx tsc --noEmit`
Expected: PASS.

### Step 4: Commit

```bash
git add lib/i18n/dictionary.ts
git commit -m "feat(i18n): add progress system labels for all 7 locales"
```

---

## Task 6: Offline-sync table union

**Files:**
- Modify: `lib/offline/types.ts`

### Step 1: Extend `SyncTable`

In [lib/offline/types.ts](file:///d:/FJ/Orkest/orkest/lib/offline/types.ts#L1), change:

```ts
export type SyncTable = "items" | "projects";
```

to:

```ts
export type SyncTable = "items" | "projects" | "progresses" | "progress_tasks";
```

### Step 2: Verify with typecheck

Run: `npx tsc --noEmit`
Expected: PASS.

### Step 3: Commit

```bash
git add lib/offline/types.ts
git commit -m "feat(offline): extend sync table union to include progresses"
```

---

## Task 7: Zustand store (TDD-ish, optimistic + sync queue)

**Files:**
- Create: `lib/stores/use-progress-store.ts`

### Step 1: Read the existing patterns

Read [lib/stores/use-project-store.ts](file:///d:/FJ/Orkest/orkest/lib/stores/use-project-store.ts) and the surrounding `syncRecord` helper. Mirror it.

### Step 2: Implement the store

Create [lib/stores/use-progress-store.ts](file:///d:/FJ/Orkest/orkest/lib/stores/use-progress-store.ts):

```ts
import { create } from "zustand";
import type { Progress, ProgressTaskLink } from "../types/progress";
import { createClient } from "../supabase/client";
import { makeUid } from "../all-page-utils";
import { syncRecord } from "../offline/sync-engine";

interface ProgressStoreState {
  progresses: Progress[];
  links: ProgressTaskLink[];
  isLoaded: boolean;
  sortMode: "default" | "alpha" | "recent" | "completion";

  // load + CRUD
  loadProgresses: (userId: string) => Promise<void>;
  loadLinks: (userId: string) => Promise<void>;
  createProgress: (
    userId: string,
    input: Omit<Progress, "id" | "userId" | "createdAt" | "updatedAt" | "sortOrder">,
  ) => Promise<Progress | null>;
  updateProgress: (userId: string, progressId: string, patch: Partial<Progress>) => Promise<boolean>;
  deleteProgress: (userId: string, progressId: string) => Promise<boolean>;
  reorderProgresses: (userId: string, orderedIds: string[]) => Promise<boolean>;

  // link CRUD
  bindTask: (userId: string, progressId: string, itemId: string, weight?: number) => Promise<boolean>;
  unbindTask: (userId: string, progressId: string, itemId: string) => Promise<boolean>;
  bindMany: (userId: string, progressId: string, itemIds: string[]) => Promise<number>;
  unbindMany: (userId: string, progressId: string, itemIds: string[]) => Promise<number>;

  // selectors
  getLinksForProgress: (progressId: string) => ProgressTaskLink[];
  getProgressForItem: (itemId: string) => Progress | undefined;

  // misc
  setSortMode: (mode: ProgressStoreState["sortMode"]) => void;
  resetStore: () => void;

  // realtime
  applyRemoteProgressChange: (progress: Progress) => void;
  applyRemoteProgressDelete: (progressId: string) => void;
  applyRemoteLinkChange: (link: ProgressTaskLink) => void;
  applyRemoteLinkDelete: (linkId: string) => void;
}

function rowToProgress(row: any): Progress {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
    goalValue: Number(row.goal_value),
    goalUnit: row.goal_unit,
    trackingMode: row.tracking_mode,
    manualValue: Number(row.manual_value ?? 0),
    color: row.color ?? undefined,
    status: row.status,
    targetDate: row.target_date ?? undefined,
    sortOrder: row.sort_order ?? undefined,
    aiContext: row.ai_context ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToLink(row: any): ProgressTaskLink {
  return {
    id: row.id,
    progressId: row.progress_id,
    itemId: row.item_id,
    weight: Number(row.weight ?? 1),
    addedAt: new Date(row.added_at),
  };
}

export const useProgressStore = create<ProgressStoreState>((set, get) => ({
  progresses: [],
  links: [],
  isLoaded: false,
  sortMode: "default",

  async loadProgresses(userId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("progresses")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("Failed to load progresses:", error);
      return;
    }
    set({ progresses: (data ?? []).map(rowToProgress) });
  },

  async loadLinks(userId) {
    const supabase = createClient();
    // Join to ensure we only get links the user owns.
    const { data, error } = await supabase
      .from("progress_tasks")
      .select("*, progresses!inner(user_id)")
      .eq("progresses.user_id", userId);
    if (error) {
      console.error("Failed to load progress_tasks:", error);
      return;
    }
    set({ links: (data ?? []).map(rowToLink), isLoaded: true });
  },

  async createProgress(userId, input) {
    const id = makeUid();
    const now = new Date();
    const maxSort = get().progresses.reduce((m, p) => Math.max(m, p.sortOrder ?? 0), 0);
    const progress: Progress = {
      id,
      userId,
      name: input.name,
      description: input.description,
      goalValue: input.goalValue,
      goalUnit: input.goalUnit,
      trackingMode: input.trackingMode,
      manualValue: input.manualValue ?? 0,
      color: input.color,
      status: input.status ?? "active",
      targetDate: input.targetDate,
      aiContext: input.aiContext,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ progresses: [...state.progresses, progress] }));
    syncRecord("create", "progresses", id, {
      id,
      user_id: userId,
      name: progress.name,
      description: progress.description ?? null,
      goal_value: progress.goalValue,
      goal_unit: progress.goalUnit,
      tracking_mode: progress.trackingMode,
      manual_value: progress.manualValue,
      color: progress.color ?? null,
      status: progress.status,
      target_date: progress.targetDate ?? null,
      sort_order: progress.sortOrder,
      ai_context: progress.aiContext ?? null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    return progress;
  },

  async updateProgress(userId, progressId, patch) {
    set((state) => ({
      progresses: state.progresses.map((p) =>
        p.id === progressId ? { ...p, ...patch, updatedAt: new Date() } : p,
      ),
    }));
    syncRecord("update", "progresses", progressId, {
      ...mapProgressPatchToRow(patch),
      user_id: userId,
    });
    return true;
  },

  async deleteProgress(userId, progressId) {
    set((state) => ({
      progresses: state.progresses.filter((p) => p.id !== progressId),
      links: state.links.filter((l) => l.progressId !== progressId),
    }));
    syncRecord("delete", "progresses", progressId, { user_id: userId });
    return true;
  },

  async reorderProgresses(userId, orderedIds) {
    const orderMap = new Map(orderedIds.map((id, i) => [id, i + 1] as const));
    const current = get().progresses;
    const updated = current.map((p) => {
      const next = orderMap.get(p.id);
      return next !== undefined && next !== p.sortOrder
        ? { ...p, sortOrder: next, updatedAt: new Date() }
        : p;
    });
    orderedIds.forEach((id, i) => {
      const p = current.find((x) => x.id === id);
      if (p && p.sortOrder !== i + 1) {
        syncRecord("update", "progresses", id, { sort_order: i + 1, user_id: userId });
      }
    });
    set({ progresses: updated });
    return true;
  },

  async bindTask(userId, progressId, itemId, weight = 1) {
    const id = makeUid();
    const link: ProgressTaskLink = {
      id,
      progressId,
      itemId,
      weight,
      addedAt: new Date(),
    };
    set((state) => ({ links: [...state.links, link] }));
    syncRecord("create", "progress_tasks", id, {
      id,
      progress_id: progressId,
      item_id: itemId,
      weight,
      added_at: link.addedAt.toISOString(),
      user_id: userId,
    });
    return true;
  },

  async unbindTask(userId, progressId, itemId) {
    const link = get().links.find((l) => l.progressId === progressId && l.itemId === itemId);
    if (!link) return false;
    set((state) => ({ links: state.links.filter((l) => l.id !== link.id) }));
    syncRecord("delete", "progress_tasks", link.id, { user_id: userId });
    return true;
  },

  async bindMany(userId, progressId, itemIds) {
    let count = 0;
    for (const itemId of itemIds) {
      if (get().links.some((l) => l.progressId === progressId && l.itemId === itemId)) continue;
      await get().bindTask(userId, progressId, itemId);
      count += 1;
    }
    return count;
  },

  async unbindMany(userId, progressId, itemIds) {
    const setIds = new Set(itemIds);
    let count = 0;
    for (const l of get().links.filter((x) => x.progressId === progressId && setIds.has(x.itemId))) {
      await get().unbindTask(userId, progressId, l.itemId);
      count += 1;
    }
    return count;
  },

  getLinksForProgress(progressId) {
    return get().links.filter((l) => l.progressId === progressId);
  },

  getProgressForItem(itemId) {
    const link = get().links.find((l) => l.itemId === itemId);
    if (!link) return undefined;
    return get().progresses.find((p) => p.id === link.progressId);
  },

  setSortMode(mode) { set({ sortMode: mode }); },

  resetStore() { set({ progresses: [], links: [], isLoaded: false, sortMode: "default" }); },

  applyRemoteProgressChange(progress) {
    set((state) => {
      const idx = state.progresses.findIndex((p) => p.id === progress.id);
      if (idx >= 0) {
        const copy = state.progresses.slice();
        copy[idx] = { ...copy[idx], ...progress };
        return { progresses: copy };
      }
      return { progresses: [...state.progresses, progress] };
    });
  },

  applyRemoteProgressDelete(progressId) {
    set((state) => ({
      progresses: state.progresses.filter((p) => p.id !== progressId),
      links: state.links.filter((l) => l.progressId !== progressId),
    }));
  },

  applyRemoteLinkChange(link) {
    set((state) => {
      const idx = state.links.findIndex((l) => l.id === link.id);
      if (idx >= 0) {
        const copy = state.links.slice();
        copy[idx] = { ...copy[idx], ...link };
        return { links: copy };
      }
      return { links: [...state.links, link] };
    });
  },

  applyRemoteLinkDelete(linkId) {
    set((state) => ({ links: state.links.filter((l) => l.id !== linkId) }));
  },
}));

function mapProgressPatchToRow(patch: Partial<Progress>) {
  const out: Record<string, unknown> = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.description !== undefined) out.description = patch.description ?? null;
  if (patch.goalValue !== undefined) out.goal_value = patch.goalValue;
  if (patch.goalUnit !== undefined) out.goal_unit = patch.goalUnit;
  if (patch.trackingMode !== undefined) out.tracking_mode = patch.trackingMode;
  if (patch.manualValue !== undefined) out.manual_value = patch.manualValue;
  if (patch.color !== undefined) out.color = patch.color ?? null;
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.targetDate !== undefined) out.target_date = patch.targetDate ?? null;
  if (patch.sortOrder !== undefined) out.sort_order = patch.sortOrder;
  if (patch.aiContext !== undefined) out.ai_context = patch.aiContext ?? null;
  out.updated_at = new Date().toISOString();
  return out;
}
```

### Step 3: Typecheck

Run: `npx tsc --noEmit`
Expected: PASS.

### Step 4: Commit

```bash
git add lib/stores/use-progress-store.ts
git commit -m "feat(store): add useProgressStore with offline sync"
```

---

## Task 8: Wire `syncRecord` to handle the new tables

**Files:**
- Modify: `lib/offline/sync-engine.ts`

### Step 1: Read the current implementation

Open [lib/offline/sync-engine.ts](file:///d:/FJ/Orkest/orkest/lib/offline/sync-engine.ts) and find the dispatcher that maps `SyncTable` → Supabase table name. Add cases for `"progresses"` and `"progress_tasks"` that mirror the existing `"projects"` branch (table name, columns, and conflict-handler).

### Step 2: Add the new cases

For each new table, add a case that:
- Uses `supabase.from(table).insert(...)` / `.update(...)` / `.delete(...)` exactly like `projects` does.
- Strips the auxiliary `user_id` field from the payload before posting (consistent with how `projects` does it).
- Routes `create` and `update` to the same upsert path if it exists; otherwise reuse the items-style branch.
- Ensures `progress_tasks` updates only send `{ weight, user_id }`.

### Step 3: Typecheck and commit

```bash
npx tsc --noEmit
git add lib/offline/sync-engine.ts
git commit -m "feat(offline): route progresses + progress_tasks through sync engine"
```

---

## Task 9: Realtime hook + provider

**Files:**
- Create: `lib/realtime/use-realtime-progresses.ts`
- Modify: `lib/realtime/realtime-provider.tsx`

### Step 1: Implement the hook

Create [lib/realtime/use-realtime-progresses.ts](file:///d:/FJ/Orkest/orkest/lib/realtime/use-realtime-progresses.ts). Mirror `useRealtimeProjects` exactly: subscribe to `progresses` and `progress_tasks` filtered by `user_id`, and apply remote changes via `applyRemoteProgressChange` / `applyRemoteProgressDelete` / `applyRemoteLinkChange` / `applyRemoteLinkDelete`. Reuse the `LOCAL_SYNC_WINDOW_MS` pattern.

### Step 2: Wire into the provider

In [lib/realtime/realtime-provider.tsx](file:///d:/FJ/Orkest/orkest/lib/realtime/realtime-provider.tsx), add `useRealtimeProgresses(user?.id);` after the existing `useRealtimeProjects` call.

### Step 3: Commit

```bash
git add lib/realtime/use-realtime-progresses.ts lib/realtime/realtime-provider.tsx
git commit -m "feat(realtime): subscribe to progresses and progress_tasks"
```

---

## Task 10: Top-level sidebar nav button (single entry, no list preview)

**Files:**
- Modify: `app/ui/sidebar-layout.tsx`

### Step 1: Add the entry to the `items` array

In [app/ui/sidebar-layout.tsx](file:///d:/FJ/Orkest/orkest/app/ui/sidebar-layout.tsx), the existing `items` array is at the top of the file. Add a single new entry **after** the Focus entry (keep the same shape: `href`, `label`, `icon`):

```ts
import { ClipboardList, Settings, Sun, Target, Trash2, User, LineChart } from "lucide-react";
// ...
const items = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/all", label: "All", icon: ClipboardList },
  { href: "/focus", label: "Focus", icon: Target },
  { href: "/progress", label: "Progress", icon: LineChart },
];
```

The `aria-label` and visible label both come from `t("nav.progress")` (already added in Task 5). The keyboard-shortcut loop in the same file (which maps `Alt+1..3` to Today/All/Focus) should be extended to add `Alt+4` → `switchTab("/progress")` and renumber the existing ones only if the design changes are intended. Keep the existing numbering to avoid regressions and **do not** bind a number shortcut in this task; the command palette is sufficient for keyboard users.

### Step 2: Register the route in `TAB_COMPONENTS`

In the same file, add `/progress: ProgressPage` to the `TAB_COMPONENTS` map so the tab is mounted lazily on first visit (mirror the existing entries). `ProgressPage` is the default export from `app/(shell)/progress/page.tsx`.

### Step 3: Update the gating condition for `ProjectSection`

The existing render condition is:

```ts
{((activeTab === "/all" && !isSettingsPage && !isTrashPage) || isProjectsPage) && (
  <ProjectSection ... />
)}
```

`isProjectsPage` is defined as `localPathname === "/projects"`. Add a sibling `isProgressPage = localPathname === "/progress" || /^\/progress\/[^/]+$/.test(localPathname)` and **remove** any reference to `ProgressSection` (we are not creating one). The `ProjectSection` continues to mount on All + Projects pages only.

### Step 4: No new sidebar section is created

The progress list page itself is the only place to see all progresses. The sidebar is a single nav button — **no card list, no drag-to-reorder, no collapse state**. Reordering and sort modes live on the list page header (Task 13).

### Step 5: Commit

```bash
git add app/ui/sidebar-layout.tsx
git commit -m "feat(sidebar): add Progress top-level nav button"
```

---

## Task 11: Progress list page route

**Files:**
- Create: `app/(shell)/progress/page.tsx`
- Create: `app/[locale]/(shell)/progress/page.tsx`

### Step 1: Create the client page

Create [app/(shell)/progress/page.tsx](file:///d:/FJ/Orkest/orkest/app/(shell)/progress/page.tsx). Mirror [app/(shell)/projects/page.tsx](file:///d:/FJ/Orkest/orkest/app/(shell)/projects/page.tsx) line-for-line:

- `useAuth`, `useAllPageStore`, `useProgressStore` (instead of `useProjectStore`).
- `useEffect` to call `ai.setPageContext("progress")`. Add a new page context value to `AiPageContext` in [lib/ai/chat-types.ts](file:///d:/FJ/Orkest/orkest/lib/ai/chat-types.ts#L107): extend the union to include `"progress"`.
- `useEffect` to call `loadProgresses` and `loadLinks` when the user is signed in.
- Mount `<ProgressPage />` and the `AiOverlay` with the progress-specific quick prompts (`progress.aiPrompt.create`, `progress.aiPrompt.suggestGoal`, `progress.aiPrompt.bindTasks`, `progress.aiPrompt.status`).
- Pass through `handleToggleBatchPreviewSelection` and `handleEditBatchPreview` exactly like the projects page.

### Step 2: Create the [locale] re-export

Create [app/[locale]/(shell)/progress/page.tsx](file:///d:/FJ/Orkest/orkest/app/[locale]/(shell)/progress/page.tsx) with a single line:

```ts
export { default } from "@/app/(shell)/progress/page";
```

### Step 3: Commit

```bash
git add app/(shell)/progress/page.tsx app/[locale]/(shell)/progress/page.tsx
git commit -m "feat(page): add /progress list route with AI overlay"
```

---

## Task 12: Progress detail page route

**Files:**
- Create: `app/(shell)/progress/[id]/page.tsx`
- Create: `app/[locale]/(shell)/progress/[id]/page.tsx`

### Step 1: Implement the detail route

Create [app/(shell)/progress/[id]/page.tsx](file:///d:/FJ/Orkest/orkest/app/(shell)/progress/[id]/page.tsx). The component:

- Reads `params.id` (Next 16 — verify param shape against the existing projects dynamic route if any; if not present, follow the App Router pattern documented in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`).
- Looks up the progress from `useProgressStore`.
- Renders `<ProgressDetailPage progressId={params.id} />` plus `<AiOverlay>` with the same quick prompts as the list page.
- If the progress is not found, render a minimal `EmptyState` with a button to return to `/progress`.

Create [app/[locale]/(shell)/progress/[id]/page.tsx](file:///d:/FJ/Orkest/orkest/app/[locale]/(shell)/progress/[id]/page.tsx) as a one-liner re-export.

### Step 2: Commit

```bash
git add app/(shell)/progress/[id]/page.tsx app/[locale]/(shell)/progress/[id]/page.tsx
git commit -m "feat(page): add /progress/[id] detail route"
```

---

## Task 13: Progress page components

**Files:**
- Create: `components/progress/progress-page.tsx`
- Create: `components/progress/progress-card.tsx`
- Create: `components/progress/progress-overview.tsx`
- Create: `components/progress/progress-empty-state.tsx`
- Create: `components/progress/progress-form-modal.tsx`
- Create: `components/progress/progress-detail-page.tsx`
- Create: `components/progress/progress-task-list.tsx`
- Create: `components/progress/progress-task-picker.tsx`

### Step 1: Implement `ProgressPage`

Create [components/progress/progress-page.tsx](file:///d:/FJ/Orkest/orkest/components/progress/progress-page.tsx). Mirror the projects list page header (title, "New progress" button, sort dropdown) and render a grid of `<ProgressCard />` items based on `computeProgressStats` + `sortProgresses`.

### Step 2: Implement `ProgressCard`

Create [components/progress/progress-card.tsx](file:///d:/FJ/Orkest/orkest/components/progress/progress-card.tsx). Visual:

- Top row: colored dot (use `normalizeProjectColor` and the `withAlpha` helper from `lib/projects/color-palette`) + name + status pill.
- Middle: a thin progress bar (`bg-black/[0.06]` track, color fill) with the percent label right-aligned.
- Bottom: `t("progress.overview.currentOfGoal", { current, goal, unit })`.
- Clicking the card routes to `/progress/<id>`.

### Step 3: Implement `ProgressOverview`

Create [components/progress/progress-overview.tsx](file:///d:/FJ/Orkest/orkest/components/progress/progress-overview.tsx). Renders the large progress bar, percent, and `t("progress.overview.remaining", { count: goalValue - currentValue })` for the detail page.

### Step 4: Implement `ProgressEmptyState`

Create [components/progress/progress-empty-state.tsx](file:///d:/FJ/Orkest/orkest/components/progress/progress-empty-state.tsx). Uses the existing `EmptyState` component with `t("progress.empty.title")` + description + a primary button that opens the `ProgressFormModal` in create mode.

### Step 5: Implement `ProgressFormModal`

Create [components/progress/progress-form-modal.tsx](file:///d:/FJ/Orkest/orkest/components/progress/progress-form-modal.tsx). Mirror `ProjectFormModal`:

- Fields: name (≤80), description (≤500), goal value, goal unit, tracking mode (count | percentage | manual), manual value (visible only for manual), color, target date.
- Save calls `useProgressStore.createProgress` / `updateProgress`. Show the `progress.error.*` strings on failure.
- Delete button (edit mode only) calls `useProgressStore.deleteProgress` after a confirm dialog with `t("progress.detail.deleteConfirm")`.

### Step 6: Implement `ProgressDetailPage`

Create [components/progress/progress-detail-page.tsx](file:///d:/FJ/Orkest/orkest/components/progress/progress-detail-page.tsx). Layout:

- Header: back button, name, status pill, edit / delete buttons.
- `ProgressOverview`.
- `ProgressTaskList` with an "Add tasks" button that opens `ProgressTaskPicker` in a dialog.

### Step 7: Implement `ProgressTaskList`

Create [components/progress/progress-task-list.tsx](file:///d:/FJ/Orkest/orkest/components/progress/progress-task-list.tsx). Reads bound item IDs from `useProgressStore.getLinksForProgress(id)`, looks up the items in `useAllPageStore.manualItems`, and renders them as a stacked list with checkbox toggle (calling `applyAiUpdates` on the underlying `ItemFormState` is **not** appropriate here — instead update the item via `useAllPageStore` using the existing `handleCreateItems` patch path or a new `updateItemStatus` helper that already exists in the store; read the store first to pick the right method). Each row has an "Unbind" icon button.

### Step 8: Implement `ProgressTaskPicker`

Create [components/progress/progress-task-picker.tsx](file:///d:/FJ/Orkest/orkest/components/progress/progress-task-picker.tsx). Modal with a search input (reuse `Fuse` style search across `manualItems`, similar to `command-palette.tsx`), a checkbox list, and a "Bind" primary button. Calls `useProgressStore.bindMany`.

### Step 9: Typecheck and commit

```bash
npx tsc --noEmit
git add components/progress
git commit -m "feat(ui): add progress page, card, modal, detail, and task picker"
```

---

## Task 14: AI integration

**Files:**
- Modify: `lib/ai/chat-types.ts`
- Modify: `lib/contexts/ai-chat-context.tsx`
- Modify (if necessary): `lib/hooks/use-ai-chat.ts`
- Modify (if necessary): `app/api/ai-chat/route.ts`

### Step 1: Extend `AiPageContext`

In [lib/ai/chat-types.ts](file:///d:/FJ/Orkest/orkest/lib/ai/chat-types.ts#L107), change:

```ts
export type AiPageContext = "all" | "today" | "focus" | "projects";
```

to:

```ts
export type AiPageContext = "all" | "today" | "focus" | "projects" | "progress";
```

### Step 2: Add `progresses` to `AiChatContext`

In the same file, in the `AiChatContext` interface, add:

```ts
progresses: AiChatProgressContext[];
```

and a new type:

```ts
export type AiChatProgressContext = {
  id: string;
  name: string;
  goalValue: number;
  goalUnit: string;
  trackingMode: "count" | "percentage" | "manual";
  manualValue: number;
  status: "active" | "completed" | "archived";
  percent: number;
  currentValue: number;
  boundItemCount: number;
};
```

### Step 3: Add the new `AiProposedAction` kinds

Append to the `AiProposedAction` union:

```ts
| {
    id: string;
    type: "create_progress";
    title: string;
    formState: ProgressFormState;
    reason?: string;
  }
| {
    id: string;
    type: "update_progress";
    title: string;
    targetProgressId: string;
    patch: Partial<ProgressFormState>;
    before: ProgressFormState;
    after: ProgressFormState;
    reason?: string;
  }
| {
    id: string;
    type: "delete_progress";
    title: string;
    progressId: string;
    progressName: string;
    boundTaskCount: number;
    reason?: string;
  }
| {
    id: string;
    type: "bind_tasks_to_progress";
    title: string;
    progressId: string;
    progressName: string;
    itemIds: string[];
    itemTitles: string[];
    reason?: string;
  }
| {
    id: string;
    type: "unbind_tasks_from_progress";
    title: string;
    progressId: string;
    progressName: string;
    itemIds: string[];
    itemTitles: string[];
    reason?: string;
  };
```

Add a new type `ProgressFormState` (mirror of `Project` shape but with progress fields) in this same file.

### Step 4: Add a `handleCreateProgress` etc. to the AI context

In [lib/contexts/ai-chat-context.tsx](file:///d:/FJ/Orkest/orkest/lib/contexts/ai-chat-context.tsx):

- Read `useProgressStore` and pick the relevant actions.
- Build `progresses` from the store: `useProgressStore.progresses.map((p) => ({ id, name, goalValue, goalUnit, trackingMode, manualValue, status, percent: computed, currentValue: computed, boundItemCount: computed }))`. Use `computeProgressStats` (or compute inline) so the AI receives up-to-date numbers.
- Pass `progresses` into `useAiChat` via the existing options.
- Expose `handleCreateProgress`, `handleUpdateProgress`, `handleDeleteProgress`, `handleBindTasks`, `handleUnbindTasks` callbacks. Each one calls the corresponding store action and then `setAiBatchPreview((prev) => prev.filter(...))` to clear the preview row that was confirmed.
- Update the spread into the `value` memo.

### Step 5: Add `ProgressFormState` and `ProgressDraft` to `AiBatchPreviewItem`

In [lib/ai/chat-types.ts](file:///d:/FJ/Orkest/orkest/lib/ai/chat-types.ts), extend `AiBatchPreviewItem`:

```ts
export type AiBatchPreviewItem = {
  /* ...existing fields... */
  progressFormState?: ProgressFormState;
  targetProgressId?: string;
  progressId?: string;
  progressName?: string;
  boundTaskCount?: number;
  bindItemIds?: string[];
};
```

Add new `kind` values: `"create_progress" | "update_progress" | "delete_progress" | "bind_tasks" | "unbind_tasks"`.

### Step 6: Update `BatchPreviewItemRenderer` (read first)

Open [components/ai/batch-preview-item.tsx](file:///d:/FJ/Orkest/orkest/components/ai/batch-preview-item.tsx) and add render branches for the five new `kind`s. For create/update show the form fields; for delete show the name + bound task count; for bind/unbind show the item titles list.

### Step 7: Hook into the AI server prompt

In `app/api/ai-chat/route.ts` (or wherever the system prompt is built — read the file to find the prompt construction), inject the `progresses` array into the `AiChatContext` payload. If the prompt is built in `lib/hooks/use-ai-chat.ts`, inject there instead.

### Step 8: Confirm quick prompts in pages

`app/(shell)/progress/page.tsx` and `app/(shell)/progress/[id]/page.tsx` already pass the `progress.aiPrompt.*` quick prompts (Task 11, 12).

### Step 9: Typecheck and commit

```bash
npx tsc --noEmit
git add lib/ai/chat-types.ts lib/contexts/ai-chat-context.tsx lib/hooks/use-ai-chat.ts app/api/ai-chat/route.ts components/ai/batch-preview-item.tsx
git commit -m "feat(ai): add progress create/update/delete/bind/unbind actions"
```

---

## Task 15: Sidebar + smoke test

**Files:**
- Modify: `app/ui/sidebar-layout.tsx` (already done in Task 10)
- (no other files)

### Step 1: Run dev server

Run: `npm run dev`
Open `http://localhost:3000/en/progress` and verify:
- The "Progress" button appears in the sidebar at the same level as Today/All/Focus (no list of progress cards in the sidebar).
- Clicking the button navigates to `/progress`.
- Empty state renders with the "New progress" button.
- Creating a progress with `tracking_mode = "manual"`, `goal_value = 10`, `manual_value = 4` shows 40% on the list page.
- Binding 3 tasks (mark one as completed) for `tracking_mode = "count"`, `goal_value = 10` shows `1 / 10` and 10%.
- Reordering via the list-page header persists across reload.
- Realtime: open the same progress in two browser profiles (use the dev sign-in helper) and confirm create / update propagates.

### Step 2: Run unit tests

Run: `npm test`
Expected: all tests pass, including `progress-stats.test.ts`.

### Step 3: Lint

Run: `npm run lint`
Expected: PASS.

### Step 4: Commit any leftovers

```bash
git status
git add <anything left>
git commit -m "chore(progress): final smoke test cleanup"
```

---

## Acceptance Checklist

- [ ] `/progress` lists all progresses with name, percent bar, and current/goal summary
- [ ] User can create / edit / delete a progress (offline-safe via sync queue)
- [ ] Each progress can bind 0..N items; the same item can belong to multiple progresses
- [ ] Tracking modes `count`, `percentage`, and `manual` all compute the right percent
- [ ] `/progress/[id]` shows the bound tasks, a progress overview, and quick stats
- [ ] Sidebar shows a single Progress nav button at the same level as Today/All/Focus (no card list)
- [ ] AI can create, update, delete, bind, and unbind progress via the chat overlay
- [ ] Quick prompts `create`, `suggestGoal`, `bindTasks`, `status` work in the AI overlay
- [ ] All 7 locales have full coverage of the new keys (no English fallback)
- [ ] Realtime syncs changes between two clients
- [ ] Offline creates / updates / deletes queue and flush on reconnect
- [ ] Unit tests for `computeProgressStats` and `sortProgresses` pass
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run lint` is clean
- [ ] `npm test` is clean

---

## Remember

- Mirror the `Project` pattern end-to-end to keep the codebase consistent.
- DRY: extract shared form / sort helpers only if you use them in **two or more** places.
- YAGNI: don't add weighted goals, AI suggestions UI, charts, or notifications unless asked.
- TDD: failing test → minimal implementation → passing test → commit.
- Frequent commits — one per task (or per logical sub-step).
- No emojis in code, UI, or commits.
- All UI text goes through `useI18n()` — no hard-coded strings.
