import { describe, expect, it } from "vitest";

import {
  getItemStatusOnDate,
  isItemTerminalOnDate,
  isRecurringOccurrenceSkippedOnDate,
  withItemStatusOnDate,
} from "@/lib/ai/recurring-status";
import type { AiChatItemContext } from "@/lib/ai/chat-types";

function makeRecurringItem(overrides: Partial<AiChatItemContext> = {}): AiChatItemContext {
  return {
    id: "recurring-1",
    title: "Daily review",
    recurrenceType: "daily",
    recurrenceInterval: "1",
    status: "active",
    timezone: "Asia/Shanghai",
    ...overrides,
  };
}

describe("recurring AI occurrence status", () => {
  it("reports a completed recurring occurrence on a specific local date", () => {
    const item = makeRecurringItem({
      completedOccurrences: ["2026-05-19T01:30:00.000Z"],
    });

    expect(getItemStatusOnDate(item, "2026-05-19", "Asia/Shanghai")).toBe("completed");
    expect(isItemTerminalOnDate(item, "2026-05-19", "Asia/Shanghai")).toBe(true);
  });

  it("uses the item timezone when converting stored occurrence instants", () => {
    const item = makeRecurringItem({
      timezone: "America/Los_Angeles",
      completedOccurrences: ["2026-05-19T06:30:00.000Z"],
    });

    expect(getItemStatusOnDate(item, "2026-05-18", "Asia/Shanghai")).toBe("completed");
    expect(getItemStatusOnDate(item, "2026-05-19", "Asia/Shanghai")).toBe("active");
  });

  it("lets skipped occurrences override completion", () => {
    const item = makeRecurringItem({
      exdates: ["2026-05-19T01:30:00.000Z"],
      completedOccurrences: ["2026-05-19T01:30:00.000Z"],
    });

    expect(isRecurringOccurrenceSkippedOnDate(item, "2026-05-19", "Asia/Shanghai")).toBe(true);
    expect(getItemStatusOnDate(item, "2026-05-19", "Asia/Shanghai")).toBe("skipped");
  });

  it("decorates a recurring item with its occurrence status", () => {
    const item = makeRecurringItem({
      completedOccurrences: ["2026-05-19T01:30:00.000Z"],
    });

    expect(withItemStatusOnDate(item, "2026-05-19", "Asia/Shanghai")).toMatchObject({
      id: "recurring-1",
      status: "completed",
    });
  });
});
