/**
 * Reminder service.
 *
 * Handles scheduling and cancelling reminders.
 * - Push reminders: via OneSignal API
 * - Email reminders: via Inngest + Resend
 */

import { rrulestr } from "rrule";
import type { Reminder, ManualItemRecord, OccurrenceNotification } from "../types/all-page";
import type { Locale } from "../i18n/config";
import { translate } from "../i18n/dictionary";
import { inngest } from "../inngest/client";

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

/** Max future occurrences by recurrence frequency */
const MAX_OCCURRENCES_BY_FREQ: Record<string, number> = {
  DAILY: 20,    // ~3 weeks
  WEEKLY: 12,   // ~3 months
  MONTHLY: 12,  // ~1 year
  YEARLY: 5,    // ~5 years
};

/** Extract FREQ from an RRULE string and return the appropriate max occurrences */
function getMaxOccurrences(rruleString: string): number {
  const freqMatch = rruleString.match(/FREQ=(\w+)/i);
  const freq = freqMatch?.[1]?.toUpperCase() ?? "WEEKLY";
  return MAX_OCCURRENCES_BY_FREQ[freq] ?? 12;
}

interface ScheduleReminderParams {
  userId: string;
  userEmail?: string;
  itemId: string;
  itemTitle: string;
  startDate: string;
  startTime?: string | null;
  timezone?: string | null;
  reminder: Reminder;
  isAllDay?: boolean;
  locale?: Locale;
}

/**
 * Parse a datetime string as a specific timezone and return a UTC Date.
 * e.g. parseDateTimeInTimezone("2026-05-29T16:05:00", "Asia/Shanghai")
 * returns the UTC equivalent of 2026-05-29 16:05 in Shanghai.
 */
function parseDateTimeInTimezone(dtStr: string, timezone: string): Date {
  // First parse as if UTC to get a reference point
  const utcDate = new Date(dtStr + "Z");
  // Get the offset (in minutes) between this timezone and UTC at that moment
  const offset = getUtcOffset(utcDate, timezone);
  // Adjust: subtract the offset to get the real UTC time
  return new Date(utcDate.getTime() - offset * 60000);
}

/**
 * Get the UTC offset in minutes for a timezone at a given moment.
 * Positive = ahead of UTC (e.g., +480 for Asia/Shanghai UTC+8).
 */
function getUtcOffset(date: Date, timezone: string): number {
  const tzStr = date.toLocaleString("en-US", { timeZone: timezone, hour12: false });
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC", hour12: false });
  const tzDate = new Date(tzStr);
  const utcDate = new Date(utcStr);
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

/**
 * Calculate the trigger time for a reminder on a specific date.
 */
function calculateTriggerTime(
  startDate: string,
  startTime: string | null | undefined,
  timezone: string | null | undefined,
  minutesBefore: number,
  triggerTimeStr?: string,
  dayOffset?: number,
): Date | null {
  let eventTime: Date;

  if (startTime) {
    const dt = `${startDate}T${startTime}:00`;
    eventTime = timezone ? parseDateTimeInTimezone(dt, timezone) : new Date(dt);
  } else {
    const dt = `${startDate}T09:00:00`;
    eventTime = timezone ? parseDateTimeInTimezone(dt, timezone) : new Date(dt);
  }

  let triggerTime: Date;

  if (triggerTimeStr && !startTime) {
    const offset = dayOffset ?? Math.floor(minutesBefore / 1440);
    const eventDate = new Date(`${startDate}T00:00:00Z`);
    const triggerDate = new Date(eventDate.getTime() - offset * 86400000);
    const dtStr = `${triggerDate.getUTCFullYear()}-${String(triggerDate.getUTCMonth() + 1).padStart(2, "0")}-${String(triggerDate.getUTCDate()).padStart(2, "0")}T${triggerTimeStr}:00`;
    triggerTime = timezone ? parseDateTimeInTimezone(dtStr, timezone) : new Date(dtStr);
  } else {
    triggerTime = new Date(eventTime.getTime() - minutesBefore * 60 * 1000);
  }

  if (triggerTime <= new Date()) {
    return null;
  }

  return triggerTime;
}

/**
 * Generate future occurrence dates from an RRULE string.
 * Returns date strings (YYYY-MM-DD) for up to `max` occurrences.
 * Skips dates that appear in completedOccurrences or exdates.
 */
function generateFutureOccurrences(
  rruleString: string,
  max: number = 12,
  completedOccurrences?: string[],
  exdates?: string[],
): string[] {
  try {
    const rule = rrulestr(rruleString);
    const now = new Date();
    const skipDates = new Set<string>();
    if (completedOccurrences) {
      for (const d of completedOccurrences) skipDates.add(d.slice(0, 10));
    }
    if (exdates) {
      for (const d of exdates) skipDates.add(d.slice(0, 10));
    }

    const dates: string[] = [];
    let cursor: Date | null = now;

    while (dates.length < max) {
      const next: Date | null = cursor === now ? rule.after(now, true) : rule.after(cursor, true);
      if (!next) break;
      const dateStr = formatDate(next);
      if (!skipDates.has(dateStr)) {
        dates.push(dateStr);
      }
      cursor = new Date(next.getTime() + 1000);
    }

    return dates;
  } catch {
    return [];
  }
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Schedule a single reminder.
 * - Push: via OneSignal API, returns OneSignal notification ID
 * - Email: via Inngest event, returns Inngest event ID
 */
export async function scheduleReminder(params: ScheduleReminderParams): Promise<string> {
  const { userId, userEmail, itemId, itemTitle, startDate, startTime, timezone, reminder, isAllDay, locale } = params;
  console.log("[Reminder] scheduleReminder called:", { itemId, title: itemTitle, method: reminder.method, startDate, isAllDay, triggerTime: reminder.triggerTime, dayOffset: reminder.dayOffset, minutesBefore: reminder.minutesBefore });

  const triggerTime = calculateTriggerTime(
    startDate,
    startTime,
    timezone,
    reminder.minutesBefore,
    isAllDay ? reminder.triggerTime : undefined,
    isAllDay ? reminder.dayOffset : undefined,
  );
  if (!triggerTime) {
    console.log("[Reminder] skipped — trigger time is in the past:", {
      startDate, triggerTime: reminder.triggerTime, dayOffset: reminder.dayOffset, now: new Date().toISOString(),
    });
    return "";
  }

  // Email reminders via Inngest + Resend
  if (reminder.method === "email") {
    if (!userEmail) {
      console.warn("[Reminder] Email reminder skipped — no user email");
      return "";
    }
    try {
      const result = await inngest.send({
        name: "reminder.email.scheduled",
        data: {
          itemId,
          userEmail,
          title: itemTitle,
          triggerTime: triggerTime.toISOString(),
          locale,
        },
      });
      console.log("[Reminder] Email scheduled via Inngest:", { eventId: result.ids[0], triggerTime: triggerTime.toISOString() });
      return result.ids[0] ?? "";
    } catch (err) {
      console.error("[Reminder] Failed to schedule email via Inngest:", err);
      return "";
    }
  }

  // Push reminders via OneSignal
  const appId = process.env.ONESIGNAL_APP_ID ?? process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.warn("[OneSignal] Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY");
    return "";
  }

  const response = await fetch(ONESIGNAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_aliases: { external_id: [userId] },
      target_channel: "push",
      headings: { en: translate(locale ?? "en", "reminder.heading") },
      contents: { en: itemTitle },
      send_after: triggerTime.toISOString(),
      data: { itemId, type: "reminder" },
    }),
  });

  if (!response.ok) {
    console.error("[Reminder] OneSignal failed to schedule:", response.status, await response.text());
    return "";
  }

  const data = await response.json();
  console.log("[Reminder] Push scheduled via OneSignal:", { id: data.id, triggerTime: triggerTime.toISOString(), title: itemTitle });
  return data.id || "";
}

/**
 * Cancel a scheduled reminder.
 * OneSignal IDs are UUIDs (contain hyphens), Inngest event IDs do not.
 */
export async function cancelReminder(notificationId: string, itemId?: string): Promise<void> {
  if (!notificationId) return;

  // Inngest event ID — cancel via event
  if (!notificationId.includes("-")) {
    try {
      await inngest.send({
        name: "reminder.email.cancelled",
        data: { itemId: itemId ?? "unknown" },
      });
    } catch (err) {
      console.error("[Reminder] Failed to cancel email via Inngest:", err);
    }
    return;
  }

  // OneSignal notification ID — cancel via API
  const appId = process.env.ONESIGNAL_APP_ID ?? process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) return;

  await fetch(`${ONESIGNAL_API_URL}/${notificationId}?app_id=${appId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Key ${apiKey}`,
    },
  });
}

/**
 * Schedule all reminders for an item.
 * For recurring items, schedules reminders for multiple future occurrences.
 * Returns updated reminders with onesignalNotificationId / occurrenceNotifications.
 */
export async function scheduleItemReminders(
  userId: string,
  item: ManualItemRecord,
  locale?: Locale,
  userEmail?: string,
): Promise<Reminder[]> {
  if (!item.reminders?.length || !item.startDate) return item.reminders || [];

  // For recurring events: schedule reminders for multiple future occurrences
  if (item.rrule) {
    const maxOcc = getMaxOccurrences(item.rrule);
    const dates = generateFutureOccurrences(
      item.rrule,
      maxOcc,
      item.completedOccurrences,
      item.exdates,
    );
    const updatedReminders: Reminder[] = [];

    for (const reminder of item.reminders) {
      const occurrenceNotifications: OccurrenceNotification[] = [];

      for (const date of dates) {
        const notificationId = await scheduleReminder({
          userId,
          userEmail,
          itemId: item.id,
          itemTitle: item.title,
          startDate: date,
          startTime: item.startTime,
          timezone: item.timezone,
          reminder,
          isAllDay: item.allDay,
          locale,
        });
        if (notificationId) {
          occurrenceNotifications.push({ date, notificationId });
        }
      }

      updatedReminders.push({
        ...reminder,
        onesignalNotificationId: undefined,
        occurrenceNotifications,
      });
    }

    return updatedReminders;
  }

  // Non-recurring: schedule single occurrence
  const updatedReminders: Reminder[] = [];

  for (const reminder of item.reminders) {
    const notificationId = await scheduleReminder({
      userId,
      userEmail,
      itemId: item.id,
      itemTitle: item.title,
      startDate: item.startDate,
      startTime: item.startTime,
      timezone: item.timezone,
      reminder,
      isAllDay: item.allDay,
      locale,
    });
    updatedReminders.push({ ...reminder, onesignalNotificationId: notificationId });
  }

  return updatedReminders;
}

/**
 * Cancel all reminders for an item (including occurrence-based reminders).
 */
export async function cancelItemReminders(reminders: Reminder[], itemId?: string): Promise<void> {
  for (const reminder of reminders) {
    if (reminder.onesignalNotificationId) {
      await cancelReminder(reminder.onesignalNotificationId, itemId);
    }
    if (reminder.occurrenceNotifications?.length) {
      for (const occ of reminder.occurrenceNotifications) {
        await cancelReminder(occ.notificationId, itemId);
      }
    }
  }
}

/** Minimum upcoming occurrence notifications to keep per item */
const MIN_UPCOMING_NOTIFICATIONS = 10;

/**
 * Check if a recurring item's occurrence notifications are running low
 * and reschedule if needed. Call this after a reminder fires to maintain
 * a rolling window of upcoming reminders.
 *
 * Returns the updated reminders array if rescheduled, or null if no action taken.
 */
export async function rescheduleItemRemindersIfNeeded(
  userId: string,
  item: ManualItemRecord,
  locale?: Locale,
  userEmail?: string,
): Promise<Reminder[] | null> {
  if (!item.rrule || !item.reminders?.length || !item.startDate) return null;

  const today = new Date().toISOString().slice(0, 10);
  let upcomingCount = 0;

  for (const reminder of item.reminders) {
    if (reminder.occurrenceNotifications?.length) {
      for (const occ of reminder.occurrenceNotifications) {
        if (occ.date >= today) upcomingCount++;
      }
    }
  }

  if (upcomingCount >= MIN_UPCOMING_NOTIFICATIONS) return null;

  console.log("[Reminder] Rescheduling — upcoming count below threshold:", {
    itemId: item.id,
    upcomingCount,
    threshold: MIN_UPCOMING_NOTIFICATIONS,
  });

  await cancelItemReminders(item.reminders, item.id);
  return scheduleItemReminders(userId, item, locale, userEmail);
}
