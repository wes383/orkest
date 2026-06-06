import { describe, it, expect } from "vitest";
import {
  startOfDay,
  formatDateInput,
  formatTimeInput,
  makeDateFromInput,
  hasNoDate,
  getDateCategory,
  getAnchorDate,
  makeUid,
  serializeOccurrenceKey,
  getPriorityWeight,
  sortUnscheduledItems,
  parseStoredManualItems,
  PRIORITY_CONFIG,
  DAY_NAMES,
} from "../all-page-utils";
import type { DisplayItem } from "../types/all-page";
import type { Item } from "../types/item";

describe("startOfDay", () => {
  it("sets hours, minutes, seconds, ms to zero", () => {
    const date = new Date("2025-06-15T14:30:45.123Z");
    const result = startOfDay(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("does not mutate the original date", () => {
    const date = new Date("2025-06-15T14:30:00Z");
    const original = date.getTime();
    startOfDay(date);
    expect(date.getTime()).toBe(original);
  });
});

describe("formatDateInput", () => {
  it("formats date as YYYY-MM-DD", () => {
    const date = new Date(2025, 5, 15);
    expect(formatDateInput(date)).toBe("2025-06-15");
  });

  it("returns empty string for undefined", () => {
    expect(formatDateInput(undefined)).toBe("");
  });

  it("pads single-digit month and day", () => {
    const date = new Date(2025, 0, 1);
    expect(formatDateInput(date)).toBe("2025-01-01");
  });
});

describe("formatTimeInput", () => {
  it("formats time as HH:mm", () => {
    const date = new Date(2025, 5, 15, 9, 5);
    expect(formatTimeInput(date)).toBe("09:05");
  });

  it("returns empty string for undefined", () => {
    expect(formatTimeInput(undefined)).toBe("");
  });
});

describe("makeDateFromInput", () => {
  it("creates date from date string", () => {
    const result = makeDateFromInput("2025-06-15");
    expect(result).toBeDefined();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(5);
    expect(result!.getDate()).toBe(15);
    expect(result!.getHours()).toBe(0);
  });

  it("creates date from date and time string", () => {
    const result = makeDateFromInput("2025-06-15", "14:30");
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(30);
  });

  it("returns undefined when no date", () => {
    expect(makeDateFromInput(undefined)).toBeUndefined();
  });
});

describe("hasNoDate", () => {
  function makeItem(overrides: Partial<Item> = {}): Item {
    return {
      id: "1", uid: "u1", title: "t", time: {}, actual: {},
      status: "active", createdAt: new Date(), updatedAt: new Date(),
      ...overrides,
    };
  }

  it("returns true when no time fields and no recurrence", () => {
    expect(hasNoDate(makeItem())).toBe(true);
  });

  it("returns false when has start time", () => {
    expect(hasNoDate(makeItem({ time: { start: new Date() } }))).toBe(false);
  });

  it("returns false when has recurrence", () => {
    expect(hasNoDate(makeItem({ recurrence: { type: "weekly" } }))).toBe(false);
  });

  it("returns false when has end time", () => {
    expect(hasNoDate(makeItem({ time: { end: new Date() } }))).toBe(false);
  });
});

describe("getDateCategory", () => {
  it("returns 'noDate' for undefined", () => {
    expect(getDateCategory(undefined)).toBe("noDate");
  });

  it("returns 'today' for current date", () => {
    expect(getDateCategory(new Date())).toBe("today");
  });

  it("returns 'history' for past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 2);
    expect(getDateCategory(past)).toBe("history");
  });

  it("returns 'upcoming' for future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 2);
    expect(getDateCategory(future)).toBe("upcoming");
  });
});

describe("getAnchorDate", () => {
  function makeItem(overrides: Partial<Item & { occurrenceDate?: Date }> = {}): Item {
    return {
      id: "1", uid: "u1", title: "t", time: {}, actual: {},
      status: "active", createdAt: new Date(), updatedAt: new Date(),
      ...overrides,
    };
  }

  it("uses start time as anchor", () => {
    const start = new Date("2025-06-15T10:00:00Z");
    expect(getAnchorDate(makeItem({ time: { start } }))).toBe(start);
  });

  it("falls back to due date", () => {
    const due = new Date("2025-06-20T10:00:00Z");
    expect(getAnchorDate(makeItem({ time: { due } }))).toBe(due);
  });

  it("falls back to end time", () => {
    const end = new Date("2025-06-25T10:00:00Z");
    expect(getAnchorDate(makeItem({ time: { end } }))).toBe(end);
  });

  it("falls back to createdAt", () => {
    const createdAt = new Date("2025-06-01T10:00:00Z");
    expect(getAnchorDate(makeItem({ time: {}, createdAt }))).toBe(createdAt);
  });

  it("uses occurrenceDate for recurring instances", () => {
    const occurrence = new Date("2025-07-01T10:00:00Z");
    const item = makeItem({
      time: { start: new Date("2025-06-15T10:00:00Z") },
    }) as Item & { occurrenceDate?: Date };
    item.occurrenceDate = occurrence;
    expect(getAnchorDate(item)).toBe(occurrence);
  });
});

describe("makeUid", () => {
  it("returns a string", () => {
    expect(typeof makeUid()).toBe("string");
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => makeUid()));
    expect(ids.size).toBe(100);
  });
});

describe("serializeOccurrenceKey", () => {
  it("returns ISO string", () => {
    const date = new Date("2025-06-15T10:00:00.000Z");
    expect(serializeOccurrenceKey(date)).toBe("2025-06-15T10:00:00.000Z");
  });
});

describe("PRIORITY_CONFIG", () => {
  it("has all four priorities", () => {
    expect(PRIORITY_CONFIG).toHaveProperty("low");
    expect(PRIORITY_CONFIG).toHaveProperty("medium");
    expect(PRIORITY_CONFIG).toHaveProperty("high");
    expect(PRIORITY_CONFIG).toHaveProperty("urgent");
  });

  it("each priority has label, color, textColor", () => {
    for (const key of Object.keys(PRIORITY_CONFIG)) {
      const config = PRIORITY_CONFIG[key as keyof typeof PRIORITY_CONFIG];
      expect(typeof config.label).toBe("string");
      expect(typeof config.color).toBe("string");
      expect(typeof config.textColor).toBe("string");
    }
  });
});

describe("getPriorityWeight", () => {
  it("returns 4 for urgent", () => expect(getPriorityWeight("urgent")).toBe(4));
  it("returns 3 for high", () => expect(getPriorityWeight("high")).toBe(3));
  it("returns 2 for medium", () => expect(getPriorityWeight("medium")).toBe(2));
  it("returns 1 for low", () => expect(getPriorityWeight("low")).toBe(1));
  it("returns 0 for undefined", () => expect(getPriorityWeight(undefined)).toBe(0));
  it("returns 0 for unknown", () => expect(getPriorityWeight("unknown")).toBe(0));
});

describe("sortUnscheduledItems", () => {
  function makeDisplayItem(id: string, priority: string, createdAt: string): DisplayItem {
    const p = priority === "low" || priority === "medium" || priority === "high" || priority === "urgent"
      ? priority : undefined;
    return {
      id,
      uid: id,
      title: `Item ${id}`,
      time: {},
      actual: {},
      status: "active",
      priority: p,
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt),
    } as DisplayItem;
  }

  it("sorts by newest first", () => {
    const items = [
      makeDisplayItem("a", "medium", "2025-06-10T00:00:00Z"),
      makeDisplayItem("b", "medium", "2025-06-15T00:00:00Z"),
      makeDisplayItem("c", "medium", "2025-06-01T00:00:00Z"),
    ];
    const result = sortUnscheduledItems(items, "newest");
    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("a");
    expect(result[2].id).toBe("c");
  });

  it("sorts by oldest first", () => {
    const items = [
      makeDisplayItem("a", "medium", "2025-06-10T00:00:00Z"),
      makeDisplayItem("b", "medium", "2025-06-15T00:00:00Z"),
    ];
    const result = sortUnscheduledItems(items, "oldest");
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
  });

  it("sorts by priority descending, then newest", () => {
    const items = [
      makeDisplayItem("a", "medium", "2025-06-10T00:00:00Z"),
      makeDisplayItem("b", "high", "2025-06-05T00:00:00Z"),
      makeDisplayItem("c", "urgent", "2025-06-01T00:00:00Z"),
    ];
    const result = sortUnscheduledItems(items, "priority");
    expect(result[0].id).toBe("c"); // urgent first
    expect(result[1].id).toBe("b"); // high second
    expect(result[2].id).toBe("a"); // medium last
  });
});

describe("parseStoredManualItems", () => {
  it("returns empty array for null input", () => {
    expect(parseStoredManualItems(null)).toEqual([]);
  });

  it("parses valid JSON array", () => {
    const input = JSON.stringify([{ id: "1", uid: "u1", title: "Test" }]);
    const result = parseStoredManualItems(input);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test");
  });

  it("filters invalid items", () => {
    const input = JSON.stringify([
      { id: "1", uid: "u1", title: "Valid" },
      { id: "2", uid: "u2", title: "Also valid" },
      { notId: true },
    ]);
    const result = parseStoredManualItems(input);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseStoredManualItems("not json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseStoredManualItems('{"id": "1"}')).toEqual([]);
  });
});

describe("DAY_NAMES", () => {
  it("has 7 days", () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
});
