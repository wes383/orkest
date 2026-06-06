import { describe, it, expect } from "vitest";
import {
  orkestRRuleToGoogle,
  googleToOrkestRRule,
  parseGoogleByDay,
  toGoogleByDay,
  formatRecurrenceForGoogle,
  parseGoogleRecurrenceToOrkest,
} from "../google/rrule-converter";

describe("orkestRRuleToGoogle", () => {
  it("converts simple RRULE to Google format", () => {
    const rrule = "DTSTART:20250615T000000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR";
    const result = orkestRRuleToGoogle(rrule, null);

    expect(result).toBeDefined();
    expect(result!.rrules).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]);
    expect(result!.exdates).toEqual([]);
  });

  it("extracts EXDATE from RRULE string", () => {
    const rrule =
      "DTSTART:20250615T000000\nRRULE:FREQ=DAILY\nEXDATE;VALUE=DATE:20250616,20250617";
    const result = orkestRRuleToGoogle(rrule, null);

    expect(result).toBeDefined();
    expect(result!.rrules).toEqual(["RRULE:FREQ=DAILY"]);
    expect(result!.exdates).toContain("20250616");
    expect(result!.exdates).toContain("20250617");
  });

  it("merges exdates from array parameter", () => {
    const rrule = "DTSTART:20250615T000000\nRRULE:FREQ=DAILY";
    const exdates = ["2025-06-16", "2025-06-17T00:00:00"];
    const result = orkestRRuleToGoogle(rrule, exdates);

    expect(result).toBeDefined();
    expect(result!.exdates).toContain("20250616");
    expect(result!.exdates).toContain("20250617");
  });

  it("returns null for empty/null rrule", () => {
    expect(orkestRRuleToGoogle(null, null)).toBeNull();
    expect(orkestRRuleToGoogle(undefined, null)).toBeNull();
    expect(orkestRRuleToGoogle("", null)).toBeNull();
  });

  it("deduplicates exdates", () => {
    const rrule =
      "DTSTART:20250615T000000\nRRULE:FREQ=DAILY\nEXDATE;VALUE=DATE:20250616";
    const exdates = ["2025-06-16"]; // same date
    const result = orkestRRuleToGoogle(rrule, exdates);

    expect(result).toBeDefined();
    const count = result!.exdates.filter((d) => d === "20250616").length;
    expect(count).toBe(1);
  });
});

describe("googleToOrkestRRule", () => {
  it("converts Google RRULE array to Orkest format", () => {
    const rrules = ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"];
    const result = googleToOrkestRRule(rrules, null);

    expect(result).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });

  it("adds RRULE prefix if missing", () => {
    const rrules = ["FREQ=DAILY;INTERVAL=2"];
    const result = googleToOrkestRRule(rrules, null);

    expect(result).toBe("RRULE:FREQ=DAILY;INTERVAL=2");
  });

  it("combines multiple RRULEs with EXDATE", () => {
    const rrules = ["RRULE:FREQ=WEEKLY;BYDAY=MO"];
    const exdates = ["2025-06-16", "2025-06-23"];
    const result = googleToOrkestRRule(rrules, exdates);

    expect(result).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(result).toContain("EXDATE;VALUE=DATE:20250616,20250623");
  });

  it("returns null for empty/null rrules", () => {
    expect(googleToOrkestRRule(null, null)).toBeNull();
    expect(googleToOrkestRRule([], null)).toBeNull();
    expect(googleToOrkestRRule(undefined, null)).toBeNull();
  });
});

describe("parseGoogleByDay", () => {
  it("parses simple day abbreviation", () => {
    const result = parseGoogleByDay("MO");
    expect(result.daysOfWeek).toEqual([1]);
    expect(result.bysetpos).toBeUndefined();
  });

  it("parses day with numeric prefix (nth weekday)", () => {
    const result = parseGoogleByDay("2TU");
    expect(result.daysOfWeek).toEqual([2]);
    expect(result.bysetpos).toBe(2);
  });

  it("parses last weekday (-1 prefix)", () => {
    const result = parseGoogleByDay("-1FR");
    expect(result.daysOfWeek).toEqual([5]);
    expect(result.bysetpos).toBe(-1);
  });

  it("parses multiple days", () => {
    const result = parseGoogleByDay("MO,WE,FR");
    expect(result.daysOfWeek).toEqual([1, 3, 5]);
    expect(result.bysetpos).toBeUndefined();
  });
});

describe("toGoogleByDay", () => {
  it("converts single day to Google format", () => {
    expect(toGoogleByDay([2])).toBe("TU");
  });

  it("converts multiple days to Google format", () => {
    expect(toGoogleByDay([1, 3, 5])).toBe("MO,WE,FR");
  });

  it("adds numeric prefix for bysetpos", () => {
    expect(toGoogleByDay([2], 2)).toBe("2TU");
    expect(toGoogleByDay([5], -1)).toBe("-1FR");
  });

  it("returns undefined for empty days", () => {
    expect(toGoogleByDay([])).toBeUndefined();
  });
});

describe("formatRecurrenceForGoogle", () => {
  it("formats simple RRULE for Google", () => {
    const rrule = "DTSTART:20250615T000000\nRRULE:FREQ=DAILY;INTERVAL=1";
    const result = formatRecurrenceForGoogle(rrule, null);

    expect(result).toEqual(["RRULE:FREQ=DAILY;INTERVAL=1"]);
  });

  it("includes EXDATE when exdates are provided", () => {
    const rrule = "DTSTART:20250615T000000\nRRULE:FREQ=DAILY";
    const result = formatRecurrenceForGoogle(rrule, ["2025-06-16", "2025-06-17"]);

    expect(result).toHaveLength(2);
    expect(result![0]).toBe("RRULE:FREQ=DAILY");
    expect(result![1]).toContain("EXDATE");
    expect(result![1]).toContain("20250616");
  });

  it("returns undefined for null rrule", () => {
    expect(formatRecurrenceForGoogle(null, null)).toBeUndefined();
  });
});

describe("parseGoogleRecurrenceToOrkest", () => {
  it("parses Google recurrence array to Orkest format", () => {
    const recurrence = [
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
      "EXDATE;VALUE=DATE:20250616,20250618",
    ];
    const result = parseGoogleRecurrenceToOrkest(recurrence);

    expect(result.rrule).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(result.exdates).toContain("2025-06-16");
    expect(result.exdates).toContain("2025-06-18");
  });

  it("handles null/undefined input", () => {
    const result = parseGoogleRecurrenceToOrkest(null);
    expect(result.rrule).toBeNull();
    expect(result.exdates).toEqual([]);
  });

  it("handles empty array", () => {
    const result = parseGoogleRecurrenceToOrkest([]);
    expect(result.rrule).toBeNull();
    expect(result.exdates).toEqual([]);
  });
});
