import type { ManualItemRecord } from "../types/all-page";
import type { Progress, ProgressStatus, ProgressTaskLink, ProgressTrackingMode } from "../types/progress";
import {
  toItemFromManualRecord,
  getCompletedRecurringDisplayItems,
  getReopenedRecurringDisplayItems,
  getNextPendingRecurringDisplayItem,
  getRecurrenceAnchor,
  serializeOccurrenceKey,
  fromRRuleDate,
} from "../all-page-utils";
import { rrulestr } from "rrule";

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
 * For a recurring item with a finite end condition (end date or count),
 * compute the total number of instances the rrule will generate,
 * minus any excluded dates (exdates).
 * Returns null for infinite recurrences.
 */
function getFiniteRecurringTotal(item: ManualItemRecord): number | null {
  if (item.recurrenceEndType === "never") return null;

  const fullItem = toItemFromManualRecord(item);
  const ruleString = fullItem.rrule;
  if (!ruleString) return null;

  const anchor = getRecurrenceAnchor(fullItem);
  if (!anchor) return null;

  try {
    const tz = fullItem.time.timezone || undefined;
    const parsedRule = rrulestr(ruleString);
    const allOccurrences = parsedRule.all();
    const totalFromRule = allOccurrences.length;

    // Subtract exdates that match any of the generated occurrences
    const exdates = item.exdates ?? [];
    if (exdates.length === 0) return totalFromRule;

    // Convert RRule dates to timezone-aware dates before comparing,
    // so that the keys match the exdate keys stored in the database.
    const exdateSet = new Set(exdates.map((d) => serializeOccurrenceKey(new Date(d))));
    const excludedCount = allOccurrences.filter(
      (occ) => exdateSet.has(serializeOccurrenceKey(fromRRuleDate(occ, tz))),
    ).length;

    return totalFromRule - excludedCount;
  } catch {
    return null;
  }
}

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

    if (item.recurrenceType && item.recurrenceType !== "none") {
      const fullItem = toItemFromManualRecord(item);
      const completedItems = getCompletedRecurringDisplayItems(fullItem);
      const reopenedItems = getReopenedRecurringDisplayItems(fullItem);
      const nextPending = getNextPendingRecurringDisplayItem(fullItem);

      const finiteTotal = getFiniteRecurringTotal(item);
      if (finiteTotal !== null) {
        // Finite recurrence: use total planned instances as bound
        bucket.bound += finiteTotal;
      } else {
        // Infinite recurrence: use current visible instances
        bucket.bound += completedItems.length + reopenedItems.length + (nextPending ? 1 : 0);
      }
      bucket.completed += completedItems.length;
    } else {
      bucket.bound += 1;
      if (item.status === "completed") {
        bucket.completed += 1;
      }
    }

    counts.set(link.progressId, bucket);
  }

  return progresses.map((progress) => {
    const bucket = counts.get(progress.id) ?? { bound: 0, completed: 0 };
    const { bound, completed } = bucket;

    const effectiveGoal = progress.trackingMode === "count" ? bound : progress.goalValue;
    const { currentValue, percent } = computeCurrentAndPercent(
      progress,
      { bound, completed },
      effectiveGoal,
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
  effectiveGoal: number,
): { currentValue: number; percent: number } {
  const { trackingMode } = progress;

  if (trackingMode === "manual") {
    const current = progress.manualValue ?? 0;
    const pct = effectiveGoal > 0 ? clampPercent((current / effectiveGoal) * 100) : 0;
    return { currentValue: current, percent: pct };
  }

  if (trackingMode === "percentage") {
    const rawPct = bucket.bound > 0 ? (bucket.completed / bucket.bound) * 100 : 0;
    const pct = effectiveGoal > 0 ? clampPercent((rawPct / effectiveGoal) * 100) : 0;
    return { currentValue: rawPct, percent: pct };
  }

  const current = bucket.completed;
  const pct = effectiveGoal > 0 ? clampPercent((current / effectiveGoal) * 100) : 0;
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
    progress.trackingMode === "percentage"
      ? Math.max(effectiveGoal - progress.currentValue, 0)
      : Math.max(effectiveGoal - progress.currentValue, 0);
  const isStale = progress.status === "active" && progress.percent < 1 && progress.total === 0;
  return { status: progress.status, remaining, isStale };
}

export type { ProgressTrackingMode };
