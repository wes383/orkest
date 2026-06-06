import { describe, it, expect } from "vitest";
import { rrulestr } from "rrule";
import { buildRRuleString, formatRecurrence, RRULE_WEEKDAYS, DAY_NAMES } from "../all-page-utils";
import type { Item } from "../types/item";

// Helper to extract just the RRULE part from the DTSTART+RRULE string
function extractRRule(rruleString: string | undefined): string | undefined {
  if (!rruleString) return undefined;
  const line = rruleString.split("\n").find((l) => l.startsWith("RRULE:"));
  return line;
}

// Helper to get occurrences from an RRULE string
function getOccurrences(rruleString: string, count: number): Date[] {
  const rule = rrulestr(rruleString);
  return rule.all((_, i) => i < count);
}

describe("buildRRuleString - BYSETPOS (nth weekday of month)", () => {
  it("generates BYSETPOS for 2nd Tuesday of every month", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-10T00:00:00"),
      recurrenceType: "monthly",
      recurrenceInterval: 1,
      daysOfWeek: [2], // Tuesday
      recurrenceBysetpos: 2,
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).toContain("FREQ=MONTHLY");
    // BYDAY and BYSETPOS are separate RRULE parts
    expect(ruleLine).toContain("BYDAY=TU");
    expect(ruleLine).toContain("BYSETPOS=2");
    expect(ruleLine).not.toContain("BYMONTHDAY");
  });

  it("generates BYSETPOS for last Friday of every month", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-27T00:00:00"),
      recurrenceType: "monthly",
      recurrenceInterval: 1,
      daysOfWeek: [5], // Friday
      recurrenceBysetpos: -1,
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).toContain("BYDAY=FR");
    expect(ruleLine).toContain("BYSETPOS=-1");
  });

  it("generates BYSETPOS for 3rd Monday with interval 2", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-16T00:00:00"),
      recurrenceType: "monthly",
      recurrenceInterval: 2,
      daysOfWeek: [1], // Monday
      recurrenceBysetpos: 3,
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).toContain("FREQ=MONTHLY");
    expect(ruleLine).toContain("INTERVAL=2");
    expect(ruleLine).toContain("BYDAY=MO");
    expect(ruleLine).toContain("BYSETPOS=3");
  });

  it("falls back to BYMONTHDAY when bysetpos is not set", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "monthly",
      recurrenceInterval: 1,
      daysOfWeek: [],
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).toContain("BYMONTHDAY=15");
    expect(ruleLine).not.toContain("BYSETPOS");
  });

  it("falls back to BYMONTHDAY when multiple daysOfWeek are selected", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "monthly",
      recurrenceInterval: 1,
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      recurrenceBysetpos: 2,
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    // BYSETPOS only works with a single day, so should fall back
    expect(ruleLine).toContain("BYMONTHDAY=15");
  });

  it("produces correct occurrences for 2nd Tuesday", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-01-14T00:00:00"),
      recurrenceType: "monthly",
      recurrenceInterval: 1,
      daysOfWeek: [2], // Tuesday
      recurrenceBysetpos: 2,
    });

    expect(rrule).toBeDefined();
    const occurrences = getOccurrences(rrule!, 4);

    // Each occurrence should be a Tuesday
    for (const occ of occurrences) {
      expect(occ.getDay()).toBe(2); // Tuesday
    }

    // Verify specific dates: 2nd Tuesday of Jan 2025 = Jan 14
    expect(occurrences[0].getDate()).toBe(14);
    expect(occurrences[0].getMonth()).toBe(0); // January
  });
});

describe("buildRRuleString - COUNT end condition", () => {
  it("generates COUNT for daily recurrence", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "daily",
      recurrenceInterval: 1,
      daysOfWeek: [],
      recurrenceCount: 10,
      recurrenceEndType: "after_count",
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).toContain("COUNT=10");
    expect(ruleLine).not.toContain("UNTIL");
  });

  it("generates COUNT for weekly recurrence", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "weekly",
      recurrenceInterval: 1,
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      recurrenceCount: 5,
      recurrenceEndType: "after_count",
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).toContain("FREQ=WEEKLY");
    expect(ruleLine).toContain("BYDAY=MO,WE,FR");
    expect(ruleLine).toContain("COUNT=5");
  });

  it("produces exactly N occurrences with COUNT", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "daily",
      recurrenceInterval: 1,
      daysOfWeek: [],
      recurrenceCount: 7,
      recurrenceEndType: "after_count",
    });

    expect(rrule).toBeDefined();
    const occurrences = getOccurrences(rrule!, 100);
    expect(occurrences.length).toBe(7);
  });

  it("COUNT=1 produces only the anchor date", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "daily",
      recurrenceInterval: 1,
      daysOfWeek: [],
      recurrenceCount: 1,
      recurrenceEndType: "after_count",
    });

    expect(rrule).toBeDefined();
    const occurrences = getOccurrences(rrule!, 100);
    expect(occurrences.length).toBe(1);
  });

  it("generates UNTIL when endType is on_date", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "daily",
      recurrenceInterval: 1,
      daysOfWeek: [],
      recurrenceEndDate: "2025-06-20",
      recurrenceEndType: "on_date",
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).toContain("UNTIL=");
    expect(ruleLine).not.toContain("COUNT");
  });

  it("generates neither COUNT nor UNTIL when endType is never", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "daily",
      recurrenceInterval: 1,
      daysOfWeek: [],
      recurrenceEndType: "never",
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).not.toContain("COUNT");
    expect(ruleLine).not.toContain("UNTIL");
  });
});

describe("buildRRuleString - basic recurrence types", () => {
  it("generates daily recurrence", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "daily",
      recurrenceInterval: 1,
      daysOfWeek: [],
    });

    expect(rrule).toBeDefined();
    expect(extractRRule(rrule)).toContain("FREQ=DAILY");
    expect(extractRRule(rrule)).toContain("INTERVAL=1");
  });

  it("generates weekly recurrence with selected days", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "weekly",
      recurrenceInterval: 1,
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).toContain("FREQ=WEEKLY");
    expect(ruleLine).toContain("BYDAY=MO,WE,FR");
  });

  it("generates yearly recurrence", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "yearly",
      recurrenceInterval: 1,
      daysOfWeek: [],
    });

    expect(rrule).toBeDefined();
    const ruleLine = extractRRule(rrule);
    expect(ruleLine).toContain("FREQ=YEARLY");
    expect(ruleLine).toContain("BYMONTH=6");
    expect(ruleLine).toContain("BYMONTHDAY=15");
  });

  it("returns undefined for none type", () => {
    const rrule = buildRRuleString({
      anchorDate: new Date("2025-06-15T00:00:00"),
      recurrenceType: "none",
      recurrenceInterval: 1,
      daysOfWeek: [],
    });

    expect(rrule).toBeUndefined();
  });

  it("returns undefined when anchorDate is missing", () => {
    const rrule = buildRRuleString({
      recurrenceType: "daily",
      recurrenceInterval: 1,
      daysOfWeek: [],
    });

    expect(rrule).toBeUndefined();
  });
});

describe("formatRecurrence - BYSETPOS display", () => {
  function makeItem(recurrence: Item["recurrence"]): Item {
    return {
      id: "test",
      uid: "test-uid",
      title: "Test",
      time: {},
      recurrence,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it("displays 'Monthly on the 2nd Tue' (uses DAY_NAMES abbreviations)", () => {
    const item = makeItem({
      type: "monthly",
      interval: 1,
      daysOfWeek: [2], // Tuesday
      bysetpos: 2,
    });

    const result = formatRecurrence(item);
    expect(result).toContain("Monthly on the 2nd");
    expect(result).toContain(DAY_NAMES[2]); // abbreviated day name
  });

  it("displays 'Monthly on the last Fri'", () => {
    const item = makeItem({
      type: "monthly",
      interval: 1,
      daysOfWeek: [5], // Friday
      bysetpos: -1,
    });

    const result = formatRecurrence(item);
    expect(result).toContain("last");
    expect(result).toContain(DAY_NAMES[5]);
  });

  it("displays 'Every 3 months on the 1st Mon'", () => {
    const item = makeItem({
      type: "monthly",
      interval: 3,
      daysOfWeek: [1], // Monday
      bysetpos: 1,
    });

    const result = formatRecurrence(item);
    expect(result).toContain("Every 3 months");
    expect(result).toContain("1st");
    expect(result).toContain(DAY_NAMES[1]);
  });

  it("displays 'Monthly' for day-of-month pattern", () => {
    const item = makeItem({
      type: "monthly",
      interval: 1,
    });

    expect(formatRecurrence(item)).toBe("Monthly");
  });
});

describe("formatRecurrence - COUNT display", () => {
  function makeItem(recurrence: Item["recurrence"]): Item {
    return {
      id: "test",
      uid: "test-uid",
      title: "Test",
      time: {},
      recurrence,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it("displays 'Daily for 10 times'", () => {
    const item = makeItem({
      type: "daily",
      interval: 1,
      count: 10,
    });

    expect(formatRecurrence(item)).toBe("Daily for 10 times");
  });

  it("displays weekly with abbreviated day names and count", () => {
    const item = makeItem({
      type: "weekly",
      interval: 1,
      daysOfWeek: [1, 3], // Mon, Wed
      count: 5,
    });

    const result = formatRecurrence(item);
    expect(result).toContain("Weekly on");
    expect(result).toContain(DAY_NAMES[1]);
    expect(result).toContain(DAY_NAMES[3]);
    expect(result).toContain("for 5 times");
  });

  it("displays monthly BYSETPOS with count", () => {
    const item = makeItem({
      type: "monthly",
      interval: 1,
      daysOfWeek: [2], // Tuesday
      bysetpos: 2,
      count: 12,
    });

    const result = formatRecurrence(item);
    expect(result).toContain("Monthly on the 2nd");
    expect(result).toContain(DAY_NAMES[2]);
    expect(result).toContain("for 12 times");
  });

  it("displays end date when set", () => {
    const item = makeItem({
      type: "daily",
      interval: 1,
      endDate: new Date("2025-12-31"),
    });

    expect(formatRecurrence(item)).toContain("until");
  });
});

describe("RRULE_WEEKDAYS", () => {
  it("maps day indices to RRULE Weekday objects", () => {
    // RRULE_WEEKDAYS are rrule Weekday objects with weekday property
    expect(RRULE_WEEKDAYS[0].weekday).toBe(6); // SU = 6 in rrule
    expect(RRULE_WEEKDAYS[1].weekday).toBe(0); // MO = 0
    expect(RRULE_WEEKDAYS[2].weekday).toBe(1); // TU = 1
    expect(RRULE_WEEKDAYS[3].weekday).toBe(2); // WE = 2
    expect(RRULE_WEEKDAYS[4].weekday).toBe(3); // TH = 3
    expect(RRULE_WEEKDAYS[5].weekday).toBe(4); // FR = 4
    expect(RRULE_WEEKDAYS[6].weekday).toBe(5); // SA = 5
  });

  it("converts to string representation for RRULE", () => {
    expect(RRULE_WEEKDAYS[0].toString()).toBe("SU");
    expect(RRULE_WEEKDAYS[1].toString()).toBe("MO");
    expect(RRULE_WEEKDAYS[2].toString()).toBe("TU");
    expect(RRULE_WEEKDAYS[5].toString()).toBe("FR");
  });
});
