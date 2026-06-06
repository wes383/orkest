import { describe, it, expect } from "vitest";
import { dbRowToManualItemRecord, manualItemRecordToDbRow } from "../supabase/mapping";
import type { ManualItemRecord } from "../types/all-page";

function makeRecord(overrides: Partial<ManualItemRecord> = {}): ManualItemRecord {
  return {
    id: "id-1",
    uid: "uid-1",
    title: "test item",
    hasTime: false,
    allDay: false,
    recurrenceType: "none",
    recurrenceInterval: 1,
    daysOfWeek: [],
    recurrenceEndType: "never",
    createdAt: "2025-06-15T10:00:00.000Z",
    updatedAt: "2025-06-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("dbRowToManualItemRecord", () => {
  it("converts snake_case DB row to camelCase record", () => {
    const row = {
      id: "row-1",
      user_id: "user-123",
      uid: "row-uid",
      title: "Row Title",
      description: "A description",
      has_time: true,
      start_date: "2025-06-15",
      start_time: "10:00",
      end_date: null,
      end_time: null,
      all_day: false,
      due_date: null,
      timezone: "Asia/Shanghai",
      recurrence_type: "daily" as const,
      recurrence_interval: 2,
      days_of_week: [1, 3, 5],
      recurrence_end_type: "never" as const,
      recurrence_end_date: null,
      recurrence_count: null,
      recurrence_bysetpos: null,
      priority: "high" as const,
      estimate_minutes: 60,
      tags: ["work", "dev"],
      parent_id: null,
      completed_occurrence_keys: null,
      rrule: null,
      exdates: null,
      completed_occurrences: null,
      reopened_occurrences: null,
      deferred_until: null,
      dismissed_today_dates: null,
      planned_today_dates: null,
      now_override_date: null,
      project_id: null,
      status: "active" as const,
      deleted_at: null,
      created_at: "2025-06-15T10:00:00.000Z",
      updated_at: "2025-06-15T10:00:00.000Z",
      google_event_id: null,
      google_calendar_id: null,
      last_google_sync_at: null,
    };

    const result = dbRowToManualItemRecord(row);
    expect(result.id).toBe("row-1");
    expect(result.uid).toBe("row-uid");
    expect(result.title).toBe("Row Title");
    expect(result.description).toBe("A description");
    expect(result.hasTime).toBe(true);
    expect(result.startDate).toBe("2025-06-15");
    expect(result.startTime).toBe("10:00");
    expect(result.endDate).toBeUndefined();
    expect(result.endTime).toBeUndefined();
    expect(result.allDay).toBe(false);
    expect(result.dueDate).toBeUndefined();
    expect(result.timezone).toBe("Asia/Shanghai");
    expect(result.recurrenceType).toBe("daily");
    expect(result.recurrenceInterval).toBe(2);
    expect(result.daysOfWeek).toEqual([1, 3, 5]);
    expect(result.recurrenceEndType).toBe("never");
    expect(result.recurrenceEndDate).toBeUndefined();
    expect(result.priority).toBe("high");
    expect(result.estimateMinutes).toBe(60);
    expect(result.tags).toEqual(["work", "dev"]);
    expect(result.status).toBe("active");
    expect(result.createdAt).toBe("2025-06-15T10:00:00.000Z");
    expect(result.updatedAt).toBe("2025-06-15T10:00:00.000Z");
  });

  it("handles null description as undefined", () => {
    const row = {
      id: "1", user_id: "user-123", uid: "u1", title: "t",
      description: null, has_time: false, start_date: null,
      start_time: null, end_date: null, end_time: null,
      all_day: false, due_date: null, timezone: null,
      recurrence_type: "none" as const, recurrence_interval: 1,
      days_of_week: [], recurrence_end_type: "never" as const,
      recurrence_end_date: null, recurrence_count: null, recurrence_bysetpos: null, priority: null,
      estimate_minutes: null, tags: null,
      parent_id: null, completed_occurrence_keys: null,
      rrule: null, exdates: null, completed_occurrences: null,
      reopened_occurrences: null, deferred_until: null,
      dismissed_today_dates: null, planned_today_dates: null,
      now_override_date: null, project_id: null,
      status: "active" as const, deleted_at: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      google_event_id: null, google_calendar_id: null, last_google_sync_at: null,
    };
    const result = dbRowToManualItemRecord(row);
    expect(result.description).toBeUndefined();
    expect(result.priority).toBeUndefined();
  });
});

describe("manualItemRecordToDbRow", () => {
  it("converts camelCase record to snake_case DB row", () => {
    const record = makeRecord({
      title: "Test",
      description: "Desc",
      hasTime: true,
      startDate: "2025-06-15",
      startTime: "10:00",
      allDay: false,
      timezone: "UTC",
      recurrenceType: "weekly",
      recurrenceInterval: 1,
      daysOfWeek: [0, 2, 4],
      recurrenceEndType: "on_date",
      recurrenceEndDate: "2025-07-15",
      priority: "urgent",
      estimateMinutes: 30,
      tags: ["urgent", "work"],
      status: "active",
    });

    const result = manualItemRecordToDbRow(record, "user-123");
    expect(result.user_id).toBe("user-123");
    expect(result.title).toBe("Test");
    expect(result.description).toBe("Desc");
    expect(result.has_time).toBe(true);
    expect(result.start_date).toBe("2025-06-15");
    expect(result.start_time).toBe("10:00");
    expect(result.all_day).toBe(false);
    expect(result.timezone).toBe("UTC");
    expect(result.recurrence_type).toBe("weekly");
    expect(result.recurrence_interval).toBe(1);
    expect(result.days_of_week).toEqual([0, 2, 4]);
    expect(result.recurrence_end_type).toBe("on_date");
    expect(result.recurrence_end_date).toBe("2025-07-15");
    expect(result.priority).toBe("urgent");
    expect(result.estimate_minutes).toBe(30);
    expect(result.tags).toEqual(["urgent", "work"]);
    expect(result.status).toBe("active");
  });

  it("converts undefined fields to null", () => {
    const record = makeRecord({ description: undefined, priority: undefined, tags: undefined });
    const result = manualItemRecordToDbRow(record, "user-1");
    expect(result.description).toBeNull();
    expect(result.priority).toBeNull();
    expect(result.tags).toBeNull();
  });

  it("sets default status to active when undefined", () => {
    const record = makeRecord({ status: undefined });
    const result = manualItemRecordToDbRow(record, "user-1");
    expect(result.status).toBe("active");
  });
});
