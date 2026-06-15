import type { ManualItemRecord } from "../types/all-page";
import type { Progress, ProgressStatus, ProgressTaskLink, ProgressTrackingMode } from "../types/progress";

export type ProgressSortMode = "default" | "alpha" | "recent" | "completion";

export type ProgressWithStats = Progress & {
  /** Number of items currently bound to this progress (excluding soft-deleted & sub-items). */
  boundTaskCount: number;
  /** Number of bound items that are `status = "completed"`. */
  completed: number;
  /** Total bound items (alias of `boundTaskCount`; kept for symmetry with `computeProjectsWithStats`). */
  total: number;
  /** Current value, interpretation depends on `trackingMode`. */
  currentValue: number;
  /** Progress in [0, 100]. */
  percent: number;
  /** True if `percent >= 100` and status is still `active`. */
  isOnTrack: boolean;
};

const clampPercent = (raw: number): number => {
  if (!Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > 100) return 100;
  return raw;
};

/**
 * Compute stats for each progress tracker.
 *
 * Inputs:
 *  - `progresses`: the user's progress records.
 *  - `items`: the live manual item records (Today/All/Focus/Project data).
 *  - `links`: rows of `progress_tasks` that connect a progress to an item.
 *
 * Tracking modes:
 *  - `count`      → currentValue = count of completed bound items.
 *  - `percentage` → currentValue = (completed / bound) * 100; percent = currentValue.
 *  - `manual`     → currentValue = `progress.manualValue` (caller edits this directly).
 */
export function computeProgressStats(
  progresses: Progress[],
  items: ManualItemRecord[],
  links: ProgressTaskLink[],
): ProgressWithStats[] {
  // Build a fast set of valid (non-deleted, non-subtask) item ids.
  const liveItems = new Map<string, ManualItemRecord>();
  for (const item of items) {
    if (item.deletedAt) continue;
    if (item.parentId) continue;
    liveItems.set(item.id, item);
  }

  // Bucket per progress.
  const counts = new Map<string, { bound: number; completed: number }>();
  for (const progress of progresses) {
    counts.set(progress.id, { bound: 0, completed: 0 });
  }

  // Walk the join table; for each link, look up the live item.
  for (const link of links) {
    const item = liveItems.get(link.itemId);
    if (!item) continue;
    const bucket = counts.get(link.progressId) ?? { bound: 0, completed: 0 };
    bucket.bound += 1;
    if (item.status === "completed") {
      bucket.completed += 1;
    }
    counts.set(link.progressId, bucket);
  }

  return progresses.map((progress) => {
    const bucket = counts.get(progress.id) ?? { bound: 0, completed: 0 };
    const { bound, completed } = bucket;

    const { currentValue, percent } = computeCurrentAndPercent(
      progress,
      { bound, completed },
    );

    return {
      ...progress,
      total: bound,
      boundTaskCount: bound,
      completed,
      currentValue,
      percent,
      isOnTrack: percent >= 100 && progress.status === "active",
    };
  });
}

function computeCurrentAndPercent(
  progress: Progress,
  bucket: { bound: number; completed: number },
): { currentValue: number; percent: number } {
  const { trackingMode, goalValue } = progress;

  if (trackingMode === "manual") {
    const current = progress.manualValue ?? 0;
    const pct = goalValue > 0 ? clampPercent((current / goalValue) * 100) : 0;
    return { currentValue: current, percent: pct };
  }

  if (trackingMode === "percentage") {
    const pct = bucket.bound > 0 ? clampPercent((bucket.completed / bucket.bound) * 100) : 0;
    return { currentValue: pct, percent: pct };
  }

  // `count` mode: the "goal" is the number of currently bound tasks, not the
  // stored `goalValue` (which was captured at create time and can go stale as
  // the user binds/unbinds items). Always derive both `currentValue` and
  // `percent` from the live bucket so the UI stays in sync.
  const current = bucket.completed;
  const pct = bucket.bound > 0 ? clampPercent((current / bucket.bound) * 100) : 0;
  return { currentValue: current, percent: pct };
}

/**
 * Sort progresses by the requested mode. The original array is not mutated.
 */
export function sortProgresses(
  progresses: ProgressWithStats[],
  mode: ProgressSortMode,
): ProgressWithStats[] {
  const copy = [...progresses];
  if (mode === "default") {
    copy.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  } else if (mode === "alpha") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (mode === "recent") {
    copy.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        a.name.localeCompare(b.name),
    );
  } else if (mode === "completion") {
    copy.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  }
  return copy;
}

export function summarizeProgress(progress: ProgressWithStats): {
  status: ProgressStatus;
  remaining: number;
  isStale: boolean;
} {
  // For count/percentage the "goal" is derived from live bound tasks; for
  // manual mode we still rely on the stored `goalValue`.
  const effectiveGoal =
    progress.trackingMode === "count" ? progress.boundTaskCount : progress.goalValue;
  const remaining =
    progress.trackingMode === "percentage" ? 0 : Math.max(effectiveGoal - progress.currentValue, 0);
  const isStale = progress.status === "active" && progress.percent < 1 && progress.total === 0;
  return { status: progress.status, remaining, isStale };
}

export type { ProgressTrackingMode };
