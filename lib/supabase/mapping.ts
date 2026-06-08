import type { ManualItemRecord } from "../types/all-page";
import type { TablesInsert, TablesRow, Json } from "../supabase/database.types";

/**
 * Convert a Supabase DB row to a ManualItemRecord for use in the store.
 * Maps snake_case DB columns to camelCase app fields.
 */
export function dbRowToManualItemRecord(row: TablesRow<"items">): ManualItemRecord {
  return {
    id: row.id,
    uid: row.uid,
    title: row.title,
    description: row.description ?? undefined,
    hasTime: row.has_time,
    startDate: row.start_date ?? undefined,
    startTime: row.start_time ?? undefined,
    endDate: row.end_date ?? undefined,
    endTime: row.end_time ?? undefined,
    allDay: row.all_day,
    dueDate: row.due_date ?? undefined,
    timezone: row.timezone ?? undefined,
    recurrenceType: row.recurrence_type,
    recurrenceInterval: row.recurrence_interval,
    daysOfWeek: row.days_of_week ?? [],
    recurrenceEndType: row.recurrence_end_type,
    recurrenceEndDate: row.recurrence_end_date ?? undefined,
    recurrenceCount: row.recurrence_count ?? undefined,
    recurrenceBysetpos: row.recurrence_bysetpos ?? undefined,
    priority: row.priority ?? undefined,
    estimateMinutes: row.estimate_minutes ?? undefined,
    tags: row.tags ?? undefined,
    parentId: row.parent_id ?? undefined,
    completedOccurrenceKeys: row.completed_occurrence_keys ?? undefined,
    rrule: row.rrule ?? undefined,
    exdates: row.exdates ?? undefined,
    completedOccurrences: row.completed_occurrences ?? undefined,
    reopenedOccurrences: row.reopened_occurrences ?? undefined,
    deferredUntil: row.deferred_until ?? undefined,
    dismissedTodayDates: row.dismissed_today_dates ?? undefined,
    plannedTodayDates: row.planned_today_dates ?? undefined,
    nowOverrideDate: row.now_override_date ?? undefined,
    projectId: row.project_id ?? undefined,
    googleEventId: row.google_event_id ?? undefined,
    status: row.status ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    reminders: (row.reminders as Array<{ id: string; minutesBefore: number; method: string; onesignalNotificationId?: string; triggerTime?: string; dayOffset?: number; occurrenceNotifications?: Array<{ date: string; notificationId: string }> }> | null)?.map((r) => ({
      id: r.id,
      minutesBefore: r.minutesBefore,
      method: r.method as "push" | "email",
      onesignalNotificationId: r.onesignalNotificationId,
      triggerTime: r.triggerTime,
      dayOffset: r.dayOffset,
      occurrenceNotifications: r.occurrenceNotifications,
    })) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert a ManualItemRecord to a Supabase DB row insert/update payload.
 * Maps camelCase app fields to snake_case DB columns.
 */
export function manualItemRecordToDbRow(
  record: ManualItemRecord,
  userId: string,
): TablesInsert<"items"> {
  return {
    id: record.id,
    user_id: userId,
    uid: record.uid,
    title: record.title,
    description: record.description ?? null,
    has_time: record.hasTime,
    start_date: record.startDate ?? null,
    start_time: record.startTime ?? null,
    end_date: record.endDate ?? null,
    end_time: record.endTime ?? null,
    all_day: record.allDay,
    due_date: record.dueDate ?? null,
    timezone: record.timezone ?? null,
    recurrence_type: record.recurrenceType,
    recurrence_interval: record.recurrenceInterval,
    days_of_week: record.daysOfWeek,
    recurrence_end_type: record.recurrenceEndType,
    recurrence_end_date: record.recurrenceEndDate ?? null,
    recurrence_count: record.recurrenceCount ?? null,
    recurrence_bysetpos: record.recurrenceBysetpos ?? null,
    priority: record.priority ?? null,
    estimate_minutes: record.estimateMinutes ?? null,
    tags: record.tags ?? null,
    parent_id: record.parentId ?? null,
    completed_occurrence_keys: record.completedOccurrenceKeys ?? null,
    rrule: record.rrule ?? null,
    exdates: record.exdates ?? null,
    completed_occurrences: record.completedOccurrences ?? null,
    reopened_occurrences: record.reopenedOccurrences ?? null,
    deferred_until: record.deferredUntil ?? null,
    dismissed_today_dates: record.dismissedTodayDates ?? null,
    planned_today_dates: record.plannedTodayDates ?? null,
    now_override_date: record.nowOverrideDate ?? null,
    project_id: record.projectId ?? null,
    status: record.status ?? "active",
    deleted_at: record.deletedAt ?? null,
    reminders: (record.reminders as unknown as Json[]) ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}
