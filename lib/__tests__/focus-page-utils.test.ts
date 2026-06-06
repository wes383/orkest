import { describe, it, expect } from "vitest";
import {
  formatCountdown,
  formatStopwatch,
  formatMinutes,
} from "../focus-page-utils";

describe("formatCountdown", () => {
  it("returns minutes when >= 60 seconds", () => {
    expect(formatCountdown(60)).toBe("1");
    expect(formatCountdown(120)).toBe("2");
    expect(formatCountdown(150)).toBe("3"); // ceil(150/60) = 3
  });

  it("returns seconds with colon prefix when < 60 seconds", () => {
    expect(formatCountdown(0)).toBe("0");
    expect(formatCountdown(1)).toBe(":1");
    expect(formatCountdown(30)).toBe(":30");
    expect(formatCountdown(59)).toBe(":59");
  });
});

describe("formatStopwatch", () => {
  it("formats zero", () => {
    expect(formatStopwatch(0)).toBe("00:00");
  });

  it("formats seconds only", () => {
    expect(formatStopwatch(5)).toBe("00:05");
    expect(formatStopwatch(45)).toBe("00:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatStopwatch(60)).toBe("01:00");
    expect(formatStopwatch(90)).toBe("01:30");
    expect(formatStopwatch(3661)).toBe("61:01");
  });

  it("pads with leading zeros", () => {
    expect(formatStopwatch(7)).toBe("00:07");
    expect(formatStopwatch(600)).toBe("10:00");
  });
});

describe("formatMinutes", () => {
  it("returns only minutes when < 60", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(30)).toBe("30m");
    expect(formatMinutes(59)).toBe("59m");
  });

  it("returns hours only when exact", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(180)).toBe("3h");
  });

  it("returns hours and minutes when mixed", () => {
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(150)).toBe("2h 30m");
    expect(formatMinutes(75)).toBe("1h 15m");
  });
});
