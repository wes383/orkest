/**
 * Regression tests for the bug where the daily email digest reported
 * "1 left, 1 overdue" while the today page showed "2 left, 0 overdue"
 * for the same set of tasks.
 *
 * Root cause: `buildServerTaskSummary` computed "user's today" via
 *   const userToday = new Date(userMs);
 *   userToday.setHours(0, 0, 0, 0);
 * `setHours` operates in the SERVER's local zone (Vercel = UTC), so on a
 * non-UTC server the user's midnight was actually 0:00 UTC, shifting the
 * "today" boundary by hours. This made today's tasks look overdue and
 * pushed recurring occurrences to the following day.
 *
 * These tests force the Node process TZ to UTC (simulating Vercel) and
 * freeze the clock to a specific instant so the test is deterministic.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

import { buildServerTaskSummary } from "../server-task-summary";

type ItemRow = Parameters<typeof buildServerTaskSummary>[0][number];

const UTC_PLUS_8_OFFSET_MINUTES = -480; // what `getTimezoneOffset()` returns in UTC+8
const USER_TZ = "Asia/Shanghai";

// User's "now": 2026-06-17 (Wed) 12:00 in Asia/Shanghai.
// In UTC that's 2026-06-17 04:00 UTC.
const FAKED_NOW_UTC = new Date("2026-06-17T04:00:00.000Z");

function baseRow(overrides: Partial<ItemRow>): ItemRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    uid: overrides.uid ?? "uid",
    title: overrides.title ?? "Task",
    description: null,
    has_time: overrides.has_time ?? false,
    start_date: overrides.start_date ?? null,
    start_time: overrides.start_time ?? null,
    end_date: overrides.end_date ?? null,
    end_time: overrides.end_time ?? null,
    all_day: overrides.all_day ?? true,
    timezone: overrides.timezone ?? USER_TZ,
    due_date: overrides.due_date ?? null,
    recurrence_type: overrides.recurrence_type ?? "none",
    recurrence_interval: 1,
    days_of_week: overrides.days_of_week ?? [],
    recurrence_end_type: "never",
    recurrence_end_date: null,
    recurrence_count: null,
    recurrence_bysetpos: null,
    priority: overrides.priority ?? null,
    rrule: overrides.rrule ?? null,
    exdates: overrides.exdates ?? null,
    completed_occurrences: overrides.completed_occurrences ?? null,
    reopened_occurrences: null,
    deferred_until: null,
    dismissed_today_dates: overrides.dismissed_today_dates ?? null,
    planned_today_dates: overrides.planned_today_dates ?? null,
    now_override_date: null,
    parent_id: null,
    status: overrides.status ?? "active",
    deleted_at: null,
    created_at: "2026-06-10T00:00:00.000Z",
  };
}

describe("buildServerTaskSummary — daily email regression", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    // Simulate Vercel: server clock runs in UTC.
    process.env.TZ = "UTC";
  });

  afterAll(() => {
    process.env.TZ = originalTz;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKED_NOW_UTC);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts today's tasks as 'left' (not overdue) on a UTC server for a UTC+8 user", () => {
    // Reproduces the screenshot scenario:
    //   - "找王作" — completed occurrence of a weekly Mon-Thu recurring task
    //               on 2026-06-15 (Mon). Its rrule parent is what we model below.
    //   - "找工作" — the same recurring task; next pending occurrence is 2026-06-17 (today).
    //   - "测试"  — a non-recurring all-day task on 2026-06-17 (today).
    //
    // Expected (matching the today page digest card):
    //   total=2, completed=0, remaining=2, overdue=0

    const recurring = baseRow({
      id: "recurring-1",
      title: "找工作",
      start_date: "2026-06-15",
      all_day: true,
      recurrence_type: "weekly",
      days_of_week: [0, 1, 2, 3], // Mon-Thu
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH;UNTIL=20260701T000000Z",
      completed_occurrences: ["2026-06-15T00:00:00.000Z"], // Jun 15 done
      exdates: ["2026-06-16T00:00:00.000Z"], // Jun 16 skipped
      timezone: USER_TZ,
    });

    const test = baseRow({
      id: "test-1",
      title: "测试",
      start_date: "2026-06-17",
      all_day: true,
      timezone: USER_TZ,
    });

    const { taskSummary } = buildServerTaskSummary(
      [recurring, test],
      "2026-06-17",
      UTC_PLUS_8_OFFSET_MINUTES,
      USER_TZ,
    );

    expect(taskSummary.totalTasks).toBe(2);
    expect(taskSummary.completedTasks).toBe(0);
    expect(taskSummary.remainingTasks).toBe(2);
    expect(taskSummary.overdueTasks).toBe(0);
  });

  it("marks an item with a past start_date as overdue (sanity check)", () => {
    const overdue = baseRow({
      id: "overdue-1",
      title: "Past task",
      start_date: "2026-06-10", // last week
      all_day: true,
      timezone: USER_TZ,
    });

    const { taskSummary } = buildServerTaskSummary(
      [overdue],
      "2026-06-17",
      UTC_PLUS_8_OFFSET_MINUTES,
      USER_TZ,
    );

    expect(taskSummary.totalTasks).toBe(0);
    expect(taskSummary.remainingTasks).toBe(0);
    expect(taskSummary.overdueTasks).toBe(1);
  });

  it("places a completed today's occurrence in the completed bucket", () => {
    const doneToday = baseRow({
      id: "done-today",
      title: "Done today",
      start_date: "2026-06-17",
      all_day: true,
      status: "completed",
      timezone: USER_TZ,
    });

    const pending = baseRow({
      id: "pending-today",
      title: "Pending today",
      start_date: "2026-06-17",
      all_day: true,
      timezone: USER_TZ,
    });

    const { taskSummary } = buildServerTaskSummary(
      [doneToday, pending],
      "2026-06-17",
      UTC_PLUS_8_OFFSET_MINUTES,
      USER_TZ,
    );

    expect(taskSummary.totalTasks).toBe(2);
    expect(taskSummary.completedTasks).toBe(1);
    expect(taskSummary.remainingTasks).toBe(1);
    expect(taskSummary.overdueTasks).toBe(0);
  });

  it("respects user timezone at day boundaries (UTC+8 user, 23:30 user time)", () => {
    // Edge case: at 23:30 user time (= 15:30 UTC) on Jun 17, an item dated
    // Jun 18 (tomorrow in user tz) should NOT be overdue.
    vi.setSystemTime(new Date("2026-06-17T15:30:00.000Z"));

    const tomorrow = baseRow({
      id: "tomorrow-1",
      title: "Tomorrow task",
      start_date: "2026-06-18",
      all_day: true,
      timezone: USER_TZ,
    });

    const { taskSummary } = buildServerTaskSummary(
      [tomorrow],
      "2026-06-17",
      UTC_PLUS_8_OFFSET_MINUTES,
      USER_TZ,
    );

    expect(taskSummary.totalTasks).toBe(0);
    expect(taskSummary.remainingTasks).toBe(0);
    expect(taskSummary.overdueTasks).toBe(0);
  });
});
