import { describe, it, expect } from "vitest";
import {
  computeProgressStats,
  sortProgresses,
} from "../progress/progress-stats";
import type { Progress, ProgressTaskLink } from "../types/progress";
import type { ManualItemRecord } from "../types/all-page";

function makeProgress(overrides: Partial<Progress> = {}): Progress {
  return {
    id: "pg-1",
    userId: "u-1",
    name: "Read 10 books",
    goalValue: 10,
    goalUnit: "books",
    trackingMode: "count",
    manualValue: 0,
    status: "active",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeItem(overrides: Partial<ManualItemRecord> = {}): ManualItemRecord {
  return {
    id: "i-1",
    uid: "uid-1",
    title: "Task",
    hasTime: false,
    allDay: false,
    recurrenceType: "none",
    recurrenceInterval: 1,
    daysOfWeek: [],
    recurrenceEndType: "never",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeLink(overrides: Partial<ProgressTaskLink> = {}): ProgressTaskLink {
  return {
    id: "pt-1",
    progressId: "pg-1",
    itemId: "i-1",
    weight: 1,
    addedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("computeProgressStats - count mode", () => {
  it("returns zeros when no items are bound", () => {
    const p = makeProgress();
    const result = computeProgressStats([p], [], []);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      boundTaskCount: 0,
      completed: 0,
      currentValue: 0,
      percent: 0,
      isOnTrack: false,
    });
  });

  it("counts completed bound items in count mode", () => {
    const p = makeProgress({ id: "pg-1", trackingMode: "count", goalValue: 10 });
    const items = [
      makeItem({ id: "i-1", status: "completed" }),
      makeItem({ id: "i-2", status: "completed" }),
      makeItem({ id: "i-3" }),
    ];
    const links = [
      makeLink({ id: "l-1", itemId: "i-1" }),
      makeLink({ id: "l-2", itemId: "i-2" }),
      makeLink({ id: "l-3", itemId: "i-3" }),
    ];
    const [result] = computeProgressStats([p], items, links);
    expect(result.boundTaskCount).toBe(3);
    expect(result.completed).toBe(2);
    expect(result.currentValue).toBe(2);
    expect(result.percent).toBe(20);
  });

  it("clamps percent at 100 when over the goal", () => {
    const p = makeProgress({ goalValue: 2 });
    const items = [
      makeItem({ id: "i-1", status: "completed" }),
      makeItem({ id: "i-2", status: "completed" }),
      makeItem({ id: "i-3", status: "completed" }),
    ];
    const links = [
      makeLink({ id: "l-1", itemId: "i-1" }),
      makeLink({ id: "l-2", itemId: "i-2" }),
      makeLink({ id: "l-3", itemId: "i-3" }),
    ];
    const [result] = computeProgressStats([p], items, links);
    expect(result.percent).toBe(100);
    expect(result.isOnTrack).toBe(true);
  });
});

describe("computeProgressStats - percentage mode", () => {
  it("uses completed/total*100 as percent regardless of goalValue", () => {
    const p = makeProgress({ trackingMode: "percentage", goalValue: 100 });
    const items = [
      makeItem({ id: "i-1", status: "completed" }),
      makeItem({ id: "i-2", status: "completed" }),
      makeItem({ id: "i-3" }),
      makeItem({ id: "i-4" }),
    ];
    const links = items.map((it, i) => makeLink({ id: `l-${i}`, itemId: it.id }));
    const [result] = computeProgressStats([p], items, links);
    expect(result.completed).toBe(2);
    expect(result.boundTaskCount).toBe(4);
    expect(result.currentValue).toBe(50);
    expect(result.percent).toBe(50);
  });

  it("returns 0% when no items are bound", () => {
    const p = makeProgress({ trackingMode: "percentage" });
    const [result] = computeProgressStats([p], [], []);
    expect(result.percent).toBe(0);
    expect(result.currentValue).toBe(0);
  });
});

describe("computeProgressStats - manual mode", () => {
  it("uses progress.manualValue as currentValue", () => {
    const p = makeProgress({
      trackingMode: "manual",
      goalValue: 500,
      manualValue: 200,
    });
    const [result] = computeProgressStats([p], [], []);
    expect(result.currentValue).toBe(200);
    expect(result.percent).toBe(40);
  });

  it("clamps percent at 100 for manual above goal", () => {
    const p = makeProgress({
      trackingMode: "manual",
      goalValue: 100,
      manualValue: 150,
    });
    const [result] = computeProgressStats([p], [], []);
    expect(result.currentValue).toBe(150);
    expect(result.percent).toBe(100);
  });
});

describe("computeProgressStats - filtering", () => {
  it("ignores soft-deleted items", () => {
    const p = makeProgress({ goalValue: 5 });
    const items = [
      makeItem({ id: "i-1", status: "completed" }),
      makeItem({ id: "i-2", status: "completed", deletedAt: "2025-02-01T00:00:00Z" }),
    ];
    const links = [
      makeLink({ id: "l-1", itemId: "i-1" }),
      makeLink({ id: "l-2", itemId: "i-2" }),
    ];
    const [result] = computeProgressStats([p], items, links);
    expect(result.boundTaskCount).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.percent).toBe(20);
  });

  it("ignores sub-items (parentId != null)", () => {
    const p = makeProgress({ goalValue: 5 });
    const items = [
      makeItem({ id: "i-1", status: "completed", parentId: "parent-1" }),
      makeItem({ id: "i-2", status: "completed" }),
    ];
    const links = [
      makeLink({ id: "l-1", itemId: "i-1" }),
      makeLink({ id: "l-2", itemId: "i-2" }),
    ];
    const [result] = computeProgressStats([p], items, links);
    expect(result.boundTaskCount).toBe(1);
    expect(result.completed).toBe(1);
  });

  it("ignores links whose item is not in items", () => {
    const p = makeProgress({ goalValue: 5 });
    const items = [makeItem({ id: "i-1", status: "completed" })];
    const links = [
      makeLink({ id: "l-1", itemId: "i-1" }),
      makeLink({ id: "l-2", progressId: "pg-1", itemId: "i-missing" }),
    ];
    const [result] = computeProgressStats([p], items, links);
    expect(result.boundTaskCount).toBe(1);
  });
});

describe("computeProgressStats - multi-progress", () => {
  it("isolates counts per progress", () => {
    const a = makeProgress({ id: "a", goalValue: 2 });
    const b = makeProgress({ id: "b", goalValue: 5 });
    const items = [
      makeItem({ id: "i-1", status: "completed" }),
      makeItem({ id: "i-2" }),
      makeItem({ id: "i-3", status: "completed" }),
    ];
    const links = [
      makeLink({ id: "l-1", progressId: "a", itemId: "i-1" }),
      makeLink({ id: "l-2", progressId: "a", itemId: "i-2" }),
      makeLink({ id: "l-3", progressId: "b", itemId: "i-3" }),
    ];
    const result = computeProgressStats([a, b], items, links);
    const ra = result.find((r) => r.id === "a")!;
    const rb = result.find((r) => r.id === "b")!;
    expect(ra.completed).toBe(1);
    expect(ra.percent).toBe(50);
    expect(rb.completed).toBe(1);
    expect(rb.percent).toBe(20);
  });
});

describe("sortProgresses", () => {
  const a = makeProgress({ id: "a", name: "Charlie", sortOrder: 3, createdAt: new Date("2025-01-01") });
  const b = makeProgress({ id: "b", name: "alpha", sortOrder: 1, createdAt: new Date("2025-01-02") });
  const c = makeProgress({ id: "c", name: "Bravo", sortOrder: 2, createdAt: new Date("2025-01-03") });
  const all = [a, b, c];

  it("default sort uses sortOrder then createdAt", () => {
    const sorted = sortProgresses(all as never[], "default");
    expect(sorted.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("alpha sort is case-insensitive", () => {
    const sorted = sortProgresses(all as never[], "alpha");
    expect(sorted.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("completion sort ranks higher percent first", () => {
    const x = makeProgress({ id: "x", percent: 80 } as never);
    const y = makeProgress({ id: "y", percent: 30 } as never);
    const z = makeProgress({ id: "z", percent: 100 } as never);
    const sorted = sortProgresses([x, y, z] as never[], "completion");
    expect(sorted.map((p) => p.id)).toEqual(["z", "x", "y"]);
  });
});
