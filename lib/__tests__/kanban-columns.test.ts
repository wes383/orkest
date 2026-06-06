import { describe, it, expect } from "vitest";
import { buildKanbanColumns, isOverdueDisplayItem } from "../all-page-utils";
import type { DisplayItem, ListSortConfig } from "../types/all-page";
import type { Item as DomainItem } from "../types/item";

type ItemOverrides = Partial<DomainItem> & { occurrenceDate?: Date };

function makeBase(overrides: ItemOverrides = {}): DisplayItem {
  const base: DomainItem = {
    id: "item-1",
    uid: "uid-1",
    title: "Test item",
    time: {},
    actual: {},
    status: "active",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
  return base as DisplayItem;
}

function at(date: Date, hours = 9): Date {
  const result = new Date(date);
  result.setHours(hours, 0, 0, 0);
  return result;
}

const NOW = new Date(2025, 5, 15, 14, 30, 0);

describe("buildKanbanColumns", () => {
  it("returns the three default columns in the canonical order", () => {
    const result = buildKanbanColumns([], NOW);
    expect(result.map((c) => c.id)).toEqual(["backlog", "today", "done"]);
    expect(result.every((c) => c.count === 0 && c.items.length === 0)).toBe(true);
  });

  it("places items with no time/recurrence into backlog", () => {
    const item = makeBase({ id: "a" });
    const result = buildKanbanColumns([item], NOW);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].id).toBe("a");
    expect(result[1].items).toHaveLength(0);
    expect(result[2].items).toHaveLength(0);
  });

  it("places items scheduled for today into the today column", () => {
    const item = makeBase({
      id: "a",
      time: { start: at(NOW) },
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result[0].items).toHaveLength(0);
    expect(result[1].items).toHaveLength(1);
    expect(result[1].items[0].id).toBe("a");
  });

  it("treats overdue items (start in the past) as today", () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 2);
    const item = makeBase({
      id: "a",
      time: { start: at(yesterday) },
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result[1].items).toHaveLength(1);
  });

  it("excludes future-dated items from all columns", () => {
    const nextWeek = new Date(NOW);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const item = makeBase({
      id: "a",
      time: { start: at(nextWeek) },
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result.every((c) => c.items.length === 0)).toBe(true);
  });

  it("places completed items into the done column within lookback window", () => {
    const item = makeBase({
      id: "a",
      status: "completed",
      completedAt: NOW,
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result[2].items).toHaveLength(1);
    expect(result[2].items[0].id).toBe("a");
  });

  it("excludes completed items outside the lookback window", () => {
    const longAgo = new Date(NOW);
    longAgo.setDate(longAgo.getDate() - 30);
    const item = makeBase({
      id: "a",
      status: "completed",
      completedAt: longAgo,
    });
    const result = buildKanbanColumns([item], NOW, { doneLookbackDays: 1 });
    expect(result[2].items).toHaveLength(0);
  });

  it("respects custom doneLookbackDays", () => {
    const fourDaysAgo = new Date(NOW);
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const item = makeBase({
      id: "a",
      status: "completed",
      completedAt: fourDaysAgo,
    });
    const resultDefault = buildKanbanColumns([item], NOW);
    expect(resultDefault[2].items).toHaveLength(0);

    const resultExtended = buildKanbanColumns([item], NOW, { doneLookbackDays: 7 });
    expect(resultExtended[2].items).toHaveLength(1);
  });

  it("uses completedAt as fallback when status does not say completed", () => {
    const item = makeBase({
      id: "a",
      status: "active",
      completedAt: NOW,
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result[2].items).toHaveLength(1);
  });

  it("skips soft-deleted items entirely", () => {
    const item = makeBase({
      id: "a",
      deletedAt: NOW,
      status: "completed",
      completedAt: NOW,
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result.every((c) => c.items.length === 0)).toBe(true);
  });

  it("keeps multi-day events in today when they overlap today", () => {
    const start = new Date(NOW);
    start.setDate(start.getDate() - 2);
    const end = new Date(NOW);
    end.setDate(end.getDate() + 1);
    const item = makeBase({
      id: "a",
      time: { start: at(start), end: at(end) },
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result[1].items).toHaveLength(1);
  });

  it("treats items with a recurrence as having a date (not backlog)", () => {
    const item = makeBase({
      id: "a",
      recurrence: { type: "daily" },
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result[0].items).toHaveLength(0);
  });

  it("honors enabledColumns to omit columns", () => {
    const item = makeBase({ id: "a" });
    const result = buildKanbanColumns([item], NOW, {
      enabledColumns: ["today", "done"],
    });
    expect(result.map((c) => c.id)).toEqual(["today", "done"]);
    expect(result[0].items).toHaveLength(0);
  });

  it("only emits done column when only done is enabled", () => {
    const item = makeBase({
      id: "a",
      status: "completed",
      completedAt: NOW,
    });
    const result = buildKanbanColumns([item], NOW, { enabledColumns: ["done"] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("done");
    expect(result[0].items[0].id).toBe("a");
  });

  it("reports the correct count for each column", () => {
    const items: DisplayItem[] = [
      makeBase({ id: "b1" }),
      makeBase({ id: "b2" }),
      makeBase({ id: "t1", time: { start: at(NOW) } }),
      makeBase({ id: "d1", status: "completed", completedAt: NOW }),
    ];
    const result = buildKanbanColumns(items, NOW);
    expect(result[0].count).toBe(2);
    expect(result[1].count).toBe(1);
    expect(result[2].count).toBe(1);
  });

  it("marks the done column as collapsible and others not", () => {
    const result = buildKanbanColumns([], NOW);
    expect(result[0].isCollapsible).toBe(false);
    expect(result[1].isCollapsible).toBe(false);
    expect(result[2].isCollapsible).toBe(true);
  });

  it("includes the right titleKey for each column", () => {
    const result = buildKanbanColumns([], NOW);
    expect(result[0].titleKey).toBe("kanban.column.backlog");
    expect(result[1].titleKey).toBe("kanban.column.today");
    expect(result[2].titleKey).toBe("kanban.column.done");
  });

  it("uses due date as anchor when no start time", () => {
    const due = new Date(NOW);
    due.setHours(23, 59, 0, 0);
    const item = makeBase({
      id: "a",
      time: { due },
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result[1].items).toHaveLength(1);
  });

  it("places items with only a future due date into backlog", () => {
    const nextWeek = new Date(NOW);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const item = makeBase({
      id: "a",
      time: { due: nextWeek },
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].id).toBe("a");
    expect(result[1].items).toHaveLength(0);
  });

  it("places items with only a past due date into today", () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const item = makeBase({
      id: "a",
      time: { due: yesterday },
    });
    const result = buildKanbanColumns([item], NOW);
    expect(result[0].items).toHaveLength(0);
    expect(result[1].items).toHaveLength(1);
    expect(result[1].items[0].id).toBe("a");
  });

  it("sorts today column by time ascending (earliest first) when sortConfig is provided", () => {
    const early = new Date(NOW);
    early.setHours(6, 0, 0, 0);
    const late = new Date(NOW);
    late.setHours(18, 0, 0, 0);
    const items: DisplayItem[] = [
      makeBase({ id: "late", time: { start: late } }),
      makeBase({ id: "early", time: { start: early } }),
    ];
    const sortConfig: ListSortConfig = {
      mode: "time",
      timeDirection: "asc",
      allDayPreference: "none",
      unscheduledSort: "newest",
      createdDirection: "desc",
      prioritySubField: "startTime",
      prioritySubDirection: "asc",
      prioritySchedulePreference: "scheduledFirst",
    };
    const result = buildKanbanColumns(items, NOW, { sortConfig });
    expect(result[1].items.map((i) => i.id)).toEqual(["early", "late"]);
  });

  it("sorts backlog using unscheduledSort strategy", () => {
    const older = makeBase({
      id: "older",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    });
    const newer = makeBase({
      id: "newer",
      createdAt: new Date("2025-12-01T00:00:00Z"),
    });
    const sortConfig: ListSortConfig = {
      mode: "time",
      timeDirection: "asc",
      allDayPreference: "none",
      unscheduledSort: "oldest",
      createdDirection: "desc",
      prioritySubField: "startTime",
      prioritySubDirection: "asc",
      prioritySchedulePreference: "scheduledFirst",
    };
    const result = buildKanbanColumns([newer, older], NOW, { sortConfig });
    expect(result[0].items.map((i) => i.id)).toEqual(["older", "newer"]);
  });

  it("does not sort when sortConfig is omitted", () => {
    const items: DisplayItem[] = [
      makeBase({ id: "b1" }),
      makeBase({ id: "b2" }),
    ];
    const result = buildKanbanColumns(items, NOW);
    expect(result[0].items.map((i) => i.id)).toEqual(["b1", "b2"]);
  });
});

describe("isOverdueDisplayItem", () => {
  it("returns false for completed items", () => {
    const item = makeBase({
      id: "a",
      status: "completed",
      completedAt: NOW,
      time: { start: new Date(NOW.getTime() - 86400000 * 5) },
    });
    expect(isOverdueDisplayItem(item, NOW)).toBe(false);
  });

  it("returns true when the only date (start) is before today", () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const item = makeBase({ id: "a", time: { start: at(yesterday) } });
    expect(isOverdueDisplayItem(item, NOW)).toBe(true);
  });

  it("returns true when the due date is before today", () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const item = makeBase({ id: "a", time: { due: at(yesterday) } });
    expect(isOverdueDisplayItem(item, NOW)).toBe(true);
  });

  it("returns false for items scheduled for today", () => {
    const item = makeBase({ id: "a", time: { start: at(NOW) } });
    expect(isOverdueDisplayItem(item, NOW)).toBe(false);
  });

  it("returns false for items with no dates (backlog)", () => {
    const item = makeBase({ id: "a" });
    expect(isOverdueDisplayItem(item, NOW)).toBe(false);
  });

  it("returns false for in-progress multi-day events that span today", () => {
    const start = new Date(NOW);
    start.setDate(start.getDate() - 2);
    const end = new Date(NOW);
    end.setDate(end.getDate() + 1);
    const item = makeBase({ id: "a", time: { start: at(start), end: at(end) } });
    expect(isOverdueDisplayItem(item, NOW)).toBe(false);
  });

  it("returns true for a multi-day event that has already ended", () => {
    const start = new Date(NOW);
    start.setDate(start.getDate() - 5);
    const end = new Date(NOW);
    end.setDate(end.getDate() - 1);
    const item = makeBase({ id: "a", time: { start: at(start), end: at(end) } });
    expect(isOverdueDisplayItem(item, NOW)).toBe(true);
  });

  it("returns false for soft-deleted items", () => {
    const yesterday = new Date(NOW);
    yesterday.setDate(yesterday.getDate() - 1);
    const item = makeBase({
      id: "a",
      time: { start: at(yesterday) },
      deletedAt: NOW,
    });
    expect(isOverdueDisplayItem(item, NOW)).toBe(false);
  });
});
