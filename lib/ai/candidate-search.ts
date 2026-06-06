import Fuse, { type IFuseOptions } from "fuse.js";
import { rrulestr } from "rrule";
import { dayjs } from "../dayjs";
import { buildRRuleString, RRULE_WEEKDAYS } from "../all-page-utils";

const DATE_FORMAT = "YYYY-MM-DD";
const RECENCY_DECAY_DAYS = 30;
const TEMPORAL_DECAY_DAYS = 90;

export type CandidateItem = {
  id: string;
  title: string;
  description?: string;
  hasTime?: boolean;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  allDay?: boolean;
  hasDueDate?: boolean;
  dueDate?: string;
  timezone?: string;
  recurrenceType?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceInterval?: string;
  daysOfWeek?: Array<boolean | number>;
  recurrenceEndType?: "never" | "on_date" | "after_count";
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurrenceBysetpos?: number;
  rrule?: string;
  exdates?: string[];
  completedOccurrences?: string[];
  reopenedOccurrences?: string[];
  priority?: "low" | "medium" | "high" | "urgent";
  estimateMinutes?: string;
  tags?: string[];
  projectId?: string;
  projectName?: string;
  subtasks?: string[];
  reminders?: Array<{
    minutesBefore: number;
    method: "push" | "email";
    triggerTime?: string;
    dayOffset?: number;
  }>;
  status?: "active" | "in_progress" | "completed" | "cancelled" | "skipped";
  createdAt?: string;
  updatedAt?: string;
};

export type ScoredCandidate = CandidateItem & {
  score: number;
  textScore: number;
  temporalScore: number;
  recencyScore: number;
};

export type DateRange = {
  start: string;
  end: string;
};

type RankOptions = {
  searchQuery?: string;
  preferredRange?: DateRange | null;
};

const fuseOptions: IFuseOptions<CandidateItem> = {
  keys: [
    { name: "title", weight: 0.5 },
    { name: "tags", weight: 0.15 },
    { name: "description", weight: 0.15 },
    { name: "subtasks", weight: 0.1 },
    { name: "projectName", weight: 0.1 },
  ],
  threshold: 0.35,
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
  ignoreLocation: true,
};

const fuseCache = new WeakMap<CandidateItem[], Fuse<CandidateItem>>();

function isIsoDateString(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getFuse(items: CandidateItem[]): Fuse<CandidateItem> {
  const cached = fuseCache.get(items);
  if (cached) return cached;

  const fuse = new Fuse(items, fuseOptions);
  fuseCache.set(items, fuse);
  return fuse;
}

function getStatusScopedItemsForQuery(
  items: CandidateItem[],
  requestText?: string,
): CandidateItem[] {
  const text = requestText?.toLowerCase() ?? "";

  const requestedStatuses = new Set<CandidateItem["status"]>();
  if (/\b(completed|done|finished)\b/.test(text)) {
    requestedStatuses.add("completed");
  }
  if (/\b(cancelled|canceled)\b/.test(text)) {
    requestedStatuses.add("cancelled");
  }
  if (/\b(skipped|skip)\b/.test(text)) {
    requestedStatuses.add("skipped");
  }
  if (/\b(in progress|ongoing|working on|started)\b/.test(text)) {
    requestedStatuses.add("in_progress");
  }
  if (/\b(active|open|upcoming|remaining|todo|to do)\b/.test(text)) {
    requestedStatuses.add("active");
    requestedStatuses.add("in_progress");
  }

  if (requestedStatuses.size > 0) {
    return items.filter((item) => requestedStatuses.has(item.status ?? "active"));
  }

  return items.filter((item) => {
    const status = item.status ?? "active";
    return status === "active" || status === "in_progress";
  });
}

function getTemporalScore(item: CandidateItem, preferredRange?: DateRange | null): number {
  // Determine the effective start date: use startDate if present,
  // otherwise fall back to createdAt for recurring items with no date set.
  let effectiveDateStr = item.startDate;
  if (!isIsoDateString(effectiveDateStr)) {
    if (item.recurrenceType && item.recurrenceType !== "none" && item.createdAt) {
      effectiveDateStr = dayjs(item.createdAt).format(DATE_FORMAT);
    } else {
      return 0;
    }
  }

  if (preferredRange) {
    // If the item has a recurrenceType and no explicit startDate, it was
    // already confirmed to occur in the range by doesItemOccurInRange —
    // give it full score so it isn't pushed below the candidate limit.
    if (!isIsoDateString(item.startDate) && item.recurrenceType && item.recurrenceType !== "none") {
      return 1;
    }

    if (effectiveDateStr >= preferredRange.start && effectiveDateStr <= preferredRange.end) {
      return 1;
    }

    const itemDate = dayjs(effectiveDateStr);
    const rangeStart = dayjs(preferredRange.start);
    const diffDays = itemDate.isBefore(rangeStart, "day")
      ? rangeStart.diff(itemDate, "day")
      : itemDate.diff(dayjs(preferredRange.end), "day");

    return Math.max(0, 1 - diffDays / TEMPORAL_DECAY_DAYS);
  }

  const diffDays = Math.abs(dayjs(effectiveDateStr).diff(dayjs(), "day"));
  return Math.max(0, 1 - diffDays / TEMPORAL_DECAY_DAYS);
}

function getRecencyScore(item: CandidateItem): number {
  const updatedAt = item.updatedAt || item.createdAt;
  if (!updatedAt) return 0;

  const parsed = dayjs(updatedAt);
  if (!parsed.isValid()) return 0;

  const diffDays = Math.max(0, dayjs().diff(parsed, "day"));
  return Math.max(0, 1 - diffDays / RECENCY_DECAY_DAYS);
}

function rankCandidates(items: CandidateItem[], options: RankOptions = {}): ScoredCandidate[] {
  const { searchQuery, preferredRange } = options;
  const normalizedQuery = searchQuery?.trim();

  const textResults = normalizedQuery
    ? getFuse(items).search(normalizedQuery).map((result) => ({
        item: result.item,
        textScore: 1 - (result.score ?? 1),
      }))
    : items.map((item) => ({ item, textScore: preferredRange ? 0.4 : 0.2 }));

  const scored = textResults.map(({ item, textScore }) => {
    const temporalScore = getTemporalScore(item, preferredRange);
    const recencyScore = getRecencyScore(item);
    const score = normalizedQuery
      ? textScore * 0.6 + temporalScore * 0.25 + recencyScore * 0.15
      : temporalScore * 0.75 + recencyScore * 0.25;

    return {
      ...item,
      score,
      textScore,
      temporalScore,
      recencyScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function toCandidateItem(candidate: ScoredCandidate): CandidateItem {
  return {
    id: candidate.id,
    title: candidate.title,
    description: candidate.description,
    hasTime: candidate.hasTime,
    startDate: candidate.startDate,
    startTime: candidate.startTime,
    endDate: candidate.endDate,
    endTime: candidate.endTime,
    allDay: candidate.allDay,
    hasDueDate: Boolean(candidate.dueDate),
    dueDate: candidate.dueDate,
    recurrenceType: candidate.recurrenceType,
    recurrenceInterval: candidate.recurrenceInterval,
    daysOfWeek: candidate.daysOfWeek,
    recurrenceEndType: candidate.recurrenceEndType,
    recurrenceEndDate: candidate.recurrenceEndDate,
    recurrenceCount: candidate.recurrenceCount,
    recurrenceBysetpos: candidate.recurrenceBysetpos,
    rrule: candidate.rrule,
    exdates: candidate.exdates,
    completedOccurrences: candidate.completedOccurrences,
    reopenedOccurrences: candidate.reopenedOccurrences,
    status: candidate.status,
    priority: candidate.priority,
    estimateMinutes: candidate.estimateMinutes,
    tags: candidate.tags,
    projectName: candidate.projectName,
    subtasks: candidate.subtasks,
    projectId: candidate.projectId,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

export function fuzzySearchItems(
  items: CandidateItem[],
  query: string,
  dateRange?: { start: string; end: string } | null,
): ScoredCandidate[] {
  if (!query.trim() && !dateRange) {
    // Return all items ranked by temporal score when no specific query
    return rankCandidates(items, { preferredRange: undefined });
  }

  let candidates = items;
  if (dateRange) {
    candidates = filterItemsByDateRange(items, dateRange);
  }

  return rankCandidates(candidates, { searchQuery: query, preferredRange: dateRange ?? undefined });
}

function buildCandidateRRule(item: CandidateItem): string | null {
  if (!item.recurrenceType || item.recurrenceType === "none") return null;

  const anchorStr = item.startDate || (item.createdAt ? dayjs(item.createdAt).format("YYYY-MM-DD") : null);
  if (!anchorStr) return null;

  const daysOfWeekIndices = item.daysOfWeek
    ? item.daysOfWeek.reduce<number[]>((acc, val, index) => {
        if (typeof val === "number") { if (val >= 0 && val <= 6) acc.push(val); }
        else if (val) acc.push(index);
        return acc;
      }, [])
    : [];

  return buildRRuleString({
    anchorDate: new Date(anchorStr + "T00:00:00"),
    recurrenceType: item.recurrenceType,
    recurrenceInterval: parseInt(item.recurrenceInterval || "1", 10) || 1,
    daysOfWeek: daysOfWeekIndices,
    recurrenceEndDate: item.recurrenceEndDate,
    recurrenceCount: item.recurrenceCount,
    recurrenceBysetpos: item.recurrenceBysetpos,
    recurrenceEndType: item.recurrenceEndType,
    timezone: item.timezone,
  }) ?? null;
}

export function doesItemOccurInRange(item: CandidateItem, range: DateRange): boolean {
  const itemStartStr = item.startDate;
  const itemEndStr = item.endDate || itemStartStr;

  if (!item.recurrenceType || item.recurrenceType === "none") {
    if (!isIsoDateString(itemStartStr)) return false;
    return itemStartStr <= range.end && (itemEndStr || itemStartStr) >= range.start;
  }

  const rruleString = item.rrule || buildCandidateRRule(item);
  if (!rruleString) return false;

  try {
    const rule = rrulestr(rruleString);
    const rangeStart = new Date(range.start + "T00:00:00");
    const rangeEnd = new Date(range.end + "T23:59:59");
    const occurrences = rule.between(rangeStart, rangeEnd, true);
    if (occurrences.length === 0) return false;
    if (item.exdates?.length) {
      const exdateSet = new Set(item.exdates);
      return occurrences.some((occ) => {
        const y = occ.getFullYear();
        const m = String(occ.getMonth() + 1).padStart(2, "0");
        const d = String(occ.getDate()).padStart(2, "0");
        return !exdateSet.has(`${y}-${m}-${d}`);
      });
    }
    return true;
  } catch {
    return false;
  }
}

export function filterItemsByDateRange(
  items: CandidateItem[],
  range: DateRange,
): CandidateItem[] {
  return items.filter((item) => doesItemOccurInRange(item, range));
}

/**
 * For a recurring item, returns the list of ISO date strings on which it
 * actually occurs within [range.start, range.end]. For non-recurring items
 * returns an empty array (callers should use startDate directly).
 * Results are capped at MAX_OCCURRENCES to avoid huge lists.
 */
export function getOccurrencesInRange(
  item: CandidateItem,
  range: DateRange,
): string[] {
  if (!item.recurrenceType || item.recurrenceType === "none") return [];

  const MAX_OCCURRENCES = 31;
  const rruleString = item.rrule || buildCandidateRRule(item);
  if (!rruleString) return [];

  try {
    const rule = rrulestr(rruleString);
    const rangeStart = new Date(range.start + "T00:00:00");
    const rangeEnd = new Date(range.end + "T23:59:59");
    return rule
      .between(rangeStart, rangeEnd, true)
      .slice(0, MAX_OCCURRENCES)
      .map((d) => dayjs(d).format(DATE_FORMAT));
  } catch {
    return [];
  }
}

export async function getQueryCandidates(
  items: CandidateItem[],
  aiDateRange: { start: string; end: string } | null | undefined,
  aiSearchKeywords: string | null | undefined,
  limit = 50,
  options: {
    requestText?: string;
    applyStatusScopeForQuery?: boolean;
    allowFallbackToAllWhenNoMatch?: boolean;
  } = {},
): Promise<CandidateItem[]> {
  const range = aiDateRange ?? null;
  const searchQuery = aiSearchKeywords?.trim() || undefined;
  const allowFallbackToAllWhenNoMatch = options.allowFallbackToAllWhenNoMatch ?? true;

  const dateFilteredItems = range ? filterItemsByDateRange(items, range) : [];
  const initialItems = dateFilteredItems.length > 0 ? dateFilteredItems : items;
  const filteredItems = options.applyStatusScopeForQuery
    ? getStatusScopedItemsForQuery(
        initialItems,
        [options.requestText, searchQuery].filter(Boolean).join(" "),
      )
    : initialItems;
  const fallbackItems = options.applyStatusScopeForQuery
    ? getStatusScopedItemsForQuery(
        items,
        [options.requestText, searchQuery].filter(Boolean).join(" "),
      )
    : items;

  let ranked = rankCandidates(filteredItems, {
    searchQuery,
    preferredRange: range,
  });

  if (ranked.length === 0 && searchQuery && allowFallbackToAllWhenNoMatch) {
    ranked = rankCandidates(fallbackItems, {
      searchQuery,
      preferredRange: range,
    });
  }

  if (ranked.length === 0) {
    if (!allowFallbackToAllWhenNoMatch) {
      return [];
    }

    ranked = rankCandidates(fallbackItems, { preferredRange: range });
  }

  return ranked.slice(0, limit).map(toCandidateItem);
}
