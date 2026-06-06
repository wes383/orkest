import { describe, expect, it } from "vitest";
import { googleEventToItemPatch, itemToGoogleEvent } from "../google/event-converter";
import type { ManualItemRecord } from "../types/all-page";

function makeItem(overrides: Partial<ManualItemRecord> = {}): ManualItemRecord {
  return {
    id: "item-1",
    uid: "uid-1",
    title: "Task",
    hasTime: true,
    startDate: "2026-06-01",
    startTime: "09:00",
    allDay: false,
    recurrenceType: "none",
    recurrenceInterval: 1,
    daysOfWeek: [],
    recurrenceEndType: "never",
    status: "active",
    createdAt: "2026-05-28T00:00:00.000Z",
    updatedAt: "2026-05-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("Google event conversion", () => {
  it("keeps completed tasks as confirmed transparent events", () => {
    const event = itemToGoogleEvent(makeItem({ status: "completed" }));

    expect(event.status).toBe("confirmed");
    expect(event.transparency).toBe("transparent");
  });

  it("marks one-hour Google end times as generated when the App item has no end", () => {
    const event = itemToGoogleEvent(makeItem({ endDate: undefined, endTime: undefined }));

    expect(event.end?.dateTime).toContain("10:00:00");
    expect(event.extendedProperties?.private?.orkest_auto_end).toBe("true");

    const patch = googleEventToItemPatch(event);
    expect(patch.startDate).toBe("2026-06-01");
    expect(patch.startTime).toBe("09:00");
    expect(patch.endDate).toBeUndefined();
    expect(patch.endTime).toBeUndefined();
  });

  it("keeps a Google-modified end time even when the original end was generated", () => {
    const event = itemToGoogleEvent(makeItem({ endDate: undefined, endTime: undefined }));
    event.end = { ...event.end, dateTime: "2026-06-01T11:30:00+08:00" };

    const patch = googleEventToItemPatch(event);
    expect(patch.endDate).toBe("2026-06-01");
    expect(patch.endTime).toBe("11:30");
  });

  it("exports date-only App items as all-day Google events", () => {
    const event = itemToGoogleEvent(makeItem({
      hasTime: false,
      startTime: undefined,
      allDay: false,
    }));

    expect(event.start).toEqual({ date: "2026-06-01" });
    expect(event.end).toEqual({ date: "2026-06-02" });
    expect(event.extendedProperties?.private?.orkest_auto_end).toBe("false");
  });

  it("does not let stale private status override a cancelled Google event", () => {
    const patch = googleEventToItemPatch({
      id: "google-event-1",
      summary: "Deleted remotely",
      status: "cancelled",
      extendedProperties: {
        private: {
          orkest_item_id: "item-1",
          orkest_status: "active",
        },
      },
    });

    expect(patch.status).toBe("cancelled");
  });
});
