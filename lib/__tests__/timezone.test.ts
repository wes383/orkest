import { describe, it, expect } from "vitest";
import { getBrowserTimezone, getAllTimezones } from "../timezone";

describe("getBrowserTimezone", () => {
  it("returns a non-empty string", () => {
    const tz = getBrowserTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  it("returns a truthy IANA timezone", () => {
    const tz = getBrowserTimezone();
    expect(tz).toBeTruthy();
  });
});

describe("getAllTimezones", () => {
  it("returns an array of timezone objects", () => {
    const timezones = getAllTimezones();
    expect(Array.isArray(timezones)).toBe(true);
  });

  it("each entry has value, label, and group", () => {
    const timezones = getAllTimezones();
    for (const tz of timezones) {
      expect(tz).toHaveProperty("value");
      expect(tz).toHaveProperty("label");
      expect(tz).toHaveProperty("group");
      expect(typeof tz.value).toBe("string");
      expect(typeof tz.label).toBe("string");
      expect(typeof tz.group).toBe("string");
    }
  });
});
