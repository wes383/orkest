import { describe, it, expect } from "vitest";
import { sortTableRows, nextTableSortDirection } from "../table-sort";
import type { DisplayItem } from "../types/all-page";
import type { Item } from "../types/item";

function makeItem(overrides: Partial<DisplayItem> = {}): DisplayItem {
  const base: Item = {
    id: overrides.id ?? "i1",
    uid: "uid-1",
    title: "Untitled",
    description: "",
    time: { start: undefined, end: undefined, due: undefined, allDay: false },
    actual: {},
    status: "active",
    recurrence: { type: "none" },
    priority: undefined,
    tags: [],
    estimateMinutes: undefined,
    actualMinutes: undefined,
    focusSessions: undefined,
    projectId: undefined,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
  };
  return { ...base, ...overrides } as DisplayItem;
}

describe("sortTableRows - start", () => {
  it("sorts ascending by anchor date (start/due/created)", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "a", time: { due: new Date("2025-06-01") } }),
      makeItem({ id: "b", time: { start: new Date("2025-05-01") } }),
      makeItem({ id: "c", time: {} }),
    ];
    const result = sortTableRows(items, { column: "start", direction: "asc" });
    // c has no time fields so it anchors to its createdAt (2025-01-01).
    expect(result.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  it("sorts descending by start", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "a", time: { start: new Date("2025-05-01") } }),
      makeItem({ id: "b", time: { start: new Date("2025-06-01") } }),
    ];
    const result = sortTableRows(items, { column: "start", direction: "desc" });
    expect(result.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("sortTableRows - end", () => {
  it("sorts ascending by end datetime; missing end values go last", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "later", time: { start: new Date("2025-05-01"), end: new Date("2025-05-10") } }),
      makeItem({ id: "noEnd", time: { start: new Date("2025-05-02") } }),
      makeItem({ id: "earlier", time: { start: new Date("2025-04-01"), end: new Date("2025-04-02") } }),
    ];
    const result = sortTableRows(items, { column: "end", direction: "asc" });
    expect(result.map((i) => i.id)).toEqual(["earlier", "later", "noEnd"]);
  });

  it("sorts descending by end datetime", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "a", time: { end: new Date("2025-05-01") } }),
      makeItem({ id: "b", time: { end: new Date("2025-06-01") } }),
    ];
    const result = sortTableRows(items, { column: "end", direction: "desc" });
    expect(result.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("sortTableRows - title", () => {
  it("sorts alphabetically, case-insensitive", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "1", title: "Banana" }),
      makeItem({ id: "2", title: "apple" }),
      makeItem({ id: "3", title: "Cherry" }),
    ];
    const result = sortTableRows(items, { column: "title", direction: "asc" });
    expect(result.map((i) => i.id)).toEqual(["2", "1", "3"]);
  });

  it("descending reverses order", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "1", title: "A" }),
      makeItem({ id: "2", title: "B" }),
    ];
    const result = sortTableRows(items, { column: "title", direction: "desc" });
    expect(result.map((i) => i.id)).toEqual(["2", "1"]);
  });
});

describe("sortTableRows - priority", () => {
  it("asc puts low priority before high", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "u", priority: "urgent" }),
      makeItem({ id: "l", priority: "low" }),
      makeItem({ id: "h", priority: "high" }),
    ];
    const result = sortTableRows(items, { column: "priority", direction: "asc" });
    expect(result.map((i) => i.id)).toEqual(["l", "h", "u"]);
  });

  it("desc puts high priority first", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "u", priority: "urgent" }),
      makeItem({ id: "l", priority: "low" }),
    ];
    const result = sortTableRows(items, { column: "priority", direction: "desc" });
    expect(result.map((i) => i.id)).toEqual(["u", "l"]);
  });
});

describe("sortTableRows - status", () => {
  it("asc places active rows before completed", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "d", status: "completed" }),
      makeItem({ id: "a", status: "active" }),
    ];
    const result = sortTableRows(items, { column: "status", direction: "asc" });
    expect(result.map((i) => i.id)).toEqual(["a", "d"]);
  });
});

describe("sortTableRows - estimate", () => {
  it("sorts by minutes; missing values go to the end", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "30", estimateMinutes: 30 }),
      makeItem({ id: "na" }),
      makeItem({ id: "10", estimateMinutes: 10 }),
    ];
    const result = sortTableRows(items, { column: "estimate", direction: "asc" });
    expect(result.map((i) => i.id)).toEqual(["10", "30", "na"]);
  });
});

describe("sortTableRows - immutability and stability", () => {
  it("does not mutate the input array", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "b", title: "B" }),
      makeItem({ id: "a", title: "A" }),
    ];
    const snapshot = items.map((i) => i.id);
    sortTableRows(items, { column: "title", direction: "asc" });
    expect(items.map((i) => i.id)).toEqual(snapshot);
  });

  it("falls back to id ascending on ties", () => {
    const items: DisplayItem[] = [
      makeItem({ id: "z", title: "Same" }),
      makeItem({ id: "a", title: "Same" }),
      makeItem({ id: "m", title: "Same" }),
    ];
    const result = sortTableRows(items, { column: "title", direction: "asc" });
    expect(result.map((i) => i.id)).toEqual(["a", "m", "z"]);
  });
});

describe("nextTableSortDirection", () => {
  it("returns asc when no current sort", () => {
    expect(nextTableSortDirection(undefined, "start")).toEqual({ column: "start", direction: "asc" });
  });

  it("cycles asc → desc → asc on the same column", () => {
    const a = nextTableSortDirection(undefined, "start");
    expect(a.direction).toBe("asc");
    const b = nextTableSortDirection(a, "start");
    expect(b.direction).toBe("desc");
    const c = nextTableSortDirection(b, "start");
    expect(c.direction).toBe("asc");
  });

  it("resets to asc when switching to a new column", () => {
    const a: Parameters<typeof nextTableSortDirection>[0] = { column: "title", direction: "desc" };
    const b = nextTableSortDirection(a, "start");
    expect(b).toEqual({ column: "start", direction: "asc" });
  });
});
