/**
 * Google Calendar bidirectional sync engine.
 *
 * Implements incremental sync using Google's sync tokens.
 * Handles conflict resolution with "last write wins" strategy.
 */

import type { calendar_v3 } from "googleapis";
import { createClient } from "@/lib/supabase/server-client";
import type { Database } from "@/lib/supabase/database.types";
import type { ManualItemRecord } from "@/lib/types/all-page";
import {
  fetchGoogleEvents,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  isGoogleNotFoundError,
} from "./calendar-service";
import {
  itemToGoogleEvent,
  googleEventToItemPatch,
  getOrkestItemIdFromEvent,
} from "./event-converter";
import { parseGoogleByDay } from "./rrule-converter";

type GoogleConnection = Database["public"]["Tables"]["google_calendar_connections"]["Row"];
type ItemRow = Database["public"]["Tables"]["items"]["Row"];
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type SyncResult = {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
};

/**
 * Run sync for all enabled calendars of a user.
 */
export async function runSyncForUser(userId: string, supabaseClient?: SupabaseClient): Promise<SyncResult> {
  const supabase = supabaseClient ?? await createClient();
  const combined: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  const { data: connections } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("sync_enabled", true);

  if (!connections?.length) return combined;

  for (const connection of connections) {
    const result = await runSync(connection, supabase);
    combined.pushed += result.pushed;
    combined.pulled += result.pulled;
    combined.conflicts += result.conflicts;
    combined.errors.push(...result.errors);
  }

  return combined;
}

/**
 * Run a full bidirectional sync for a user's Google Calendar connection.
 * @param supabaseClient - Optional Supabase client (e.g. admin client for webhook context)
 */
export async function runSync(connection: GoogleConnection, supabaseClient?: SupabaseClient): Promise<SyncResult> {
  const supabase = supabaseClient ?? await createClient();
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  try {
    // 1. Push local changes to Google
    const pushResult = await pushLocalChanges(supabase, connection);
    result.pushed = pushResult.pushed;
    result.errors.push(...pushResult.errors);

    // 2. Pull Google changes to local
    const pullResult = await pullGoogleChanges(supabase, connection);
    result.pulled = pullResult.pulled;
    result.conflicts = pullResult.conflicts;
    result.errors.push(...pullResult.errors);

    console.log("Google sync result:", { pushed: result.pushed, pulled: result.pulled, conflicts: result.conflicts, errors: result.errors });

    // 3. Update sync token and timestamp. Do not advance last_sync_at when
    // local pushes failed, otherwise failed local edits can be skipped forever.
    const syncStateUpdate: Database["public"]["Tables"]["google_calendar_connections"]["Update"] = {
      last_sync_token: pullResult.nextSyncToken || connection.last_sync_token,
      updated_at: new Date().toISOString(),
    };

    if (pushResult.errors.length === 0) {
      syncStateUpdate.last_sync_at = new Date().toISOString();
    }

    await supabase
      .from("google_calendar_connections")
      .update(syncStateUpdate)
      .eq("id", connection.id);

  } catch (error) {
    result.errors.push(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Push local item changes to Google Calendar.
 * Items that have been modified since last sync and don't have a google_event_id
 * get created; items with a google_event_id get updated.
 */
async function pushLocalChanges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  connection: GoogleConnection,
): Promise<{ pushed: number; errors: string[] }> {
  let pushed = 0;
  const errors: string[] = [];
  const lastSync = connection.last_sync_at || new Date(0).toISOString();

  // Fetch items modified since last sync, including soft-deleted rows so
  // Google can be cleaned up even when the browser-side push was missed.
  const { data: modifiedItems } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", connection.user_id)
    .gte("updated_at", lastSync);

  if (!modifiedItems?.length) return { pushed: 0, errors: [] };

  for (const item of modifiedItems) {
    try {
      if (item.google_calendar_id && item.google_calendar_id !== connection.calendar_id) {
        continue;
      }

      if (item.deleted_at) {
        if (item.google_event_id) {
          await deleteMappedGoogleEvent(supabase, connection, item.id, item.google_event_id);
          pushed++;
        }
        continue;
      }

      if (!hasCalendarDate(item)) {
        if (item.google_event_id) {
          await deleteMappedGoogleEvent(supabase, connection, item.id, item.google_event_id);
          pushed++;
        } else {
          await markItemSyncedToGoogle(supabase, item.id);
        }
        continue;
      }

      const record = dbRowToManualItemRecord(item);
      const googleEvent = itemToGoogleEvent(record);

      console.log("[GoogleSync DEBUG] sync-engine pushLocalChanges - item:", JSON.stringify({
        id: item.id,
        google_event_id: item.google_event_id,
        timezone: item.timezone,
        start_date: item.start_date,
        start_time: item.start_time,
        rrule: item.rrule,
        days_of_week: item.days_of_week,
        updated_at: item.updated_at,
        last_google_sync_at: item.last_google_sync_at,
      }, null, 2));

      if (item.google_event_id) {
        // Update existing Google event
        await updateOrRecreateGoogleEvent(supabase, connection, item, item.google_event_id, googleEvent);
      } else {
        // Re-check google_event_id in case a concurrent sync just set it
        const { data: recheck } = await supabase
          .from("items")
          .select("google_event_id, google_calendar_id")
          .eq("id", item.id)
          .single();

        if (recheck?.google_event_id) {
          // Another sync already created this event - update instead.
          if (recheck.google_calendar_id && recheck.google_calendar_id !== connection.calendar_id) {
            continue;
          }
          await updateOrRecreateGoogleEvent(supabase, connection, item, recheck.google_event_id, googleEvent);
        } else {
          // Create new Google event
          const created = await createGoogleEvent(connection, googleEvent, supabase);

          // Store the Google event ID back on the item
          await supabase
            .from("items")
            .update({
              google_event_id: created.id,
              google_calendar_id: connection.calendar_id,
              last_google_sync_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        }
      }

      pushed++;
    } catch (error) {
      errors.push(`Failed to push item ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { pushed, errors };
}

function hasCalendarDate(item: Pick<ItemRow, "start_date" | "end_date">): boolean {
  return Boolean(item.start_date || item.end_date);
}

async function clearGoogleMapping(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
): Promise<void> {
  await supabase
    .from("items")
    .update({
      google_event_id: null,
      google_calendar_id: null,
      last_google_sync_at: new Date().toISOString(),
    })
    .eq("id", itemId);
}

async function deleteMappedGoogleEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  connection: GoogleConnection,
  itemId: string,
  eventId: string,
): Promise<void> {
  try {
    await deleteGoogleEvent(connection, eventId, supabase);
  } catch (error) {
    if (!isGoogleNotFoundError(error)) {
      throw error;
    }
    console.warn("[GoogleSync] Google event was already missing; clearing local mapping.", {
      itemId,
      eventId,
      calendarId: connection.calendar_id,
    });
  }

  await clearGoogleMapping(supabase, itemId);
}

async function updateOrRecreateGoogleEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  connection: GoogleConnection,
  item: ItemRow,
  eventId: string,
  googleEvent: Parameters<typeof updateGoogleEvent>[2],
): Promise<void> {
  try {
    await updateGoogleEvent(connection, eventId, googleEvent, supabase);
    await markItemSyncedToGoogle(supabase, item.id);
    return;
  } catch (error) {
    if (!isGoogleNotFoundError(error)) {
      throw error;
    }

    console.warn("[GoogleSync] Google event was missing during update; recreating.", {
      itemId: item.id,
      eventId,
      calendarId: connection.calendar_id,
    });
  }

  const created = await createGoogleEvent(connection, googleEvent, supabase);
  await supabase
    .from("items")
    .update({
      google_event_id: created.id,
      google_calendar_id: connection.calendar_id,
      last_google_sync_at: new Date().toISOString(),
    })
    .eq("id", item.id);
}

async function markItemSyncedToGoogle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
): Promise<void> {
  await supabase
    .from("items")
    .update({ last_google_sync_at: new Date().toISOString() })
    .eq("id", itemId);
}

/**
 * Pull changes from Google Calendar into local items.
 * Uses sync tokens for incremental sync.
 */
async function pullGoogleChanges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  connection: GoogleConnection,
): Promise<{ pulled: number; conflicts: number; errors: string[]; nextSyncToken?: string }> {
  let pulled = 0;
  let conflicts = 0;
  const errors: string[] = [];
  let nextSyncToken = connection.last_sync_token || undefined;
  let pageToken: string | undefined;

  do {
    let response: Awaited<ReturnType<typeof fetchGoogleEvents>>;
    try {
      response = await fetchGoogleEvents(connection, {
        syncToken: nextSyncToken,
        pageToken,
        supabaseClient: supabase,
      });
    } catch (error) {
      if (nextSyncToken && isInvalidSyncTokenError(error)) {
        console.warn("[GoogleSync] Sync token expired; retrying with a bounded full sync.");
        nextSyncToken = undefined;
        pageToken = undefined;
        await supabase
          .from("google_calendar_connections")
          .update({ last_sync_token: null, updated_at: new Date().toISOString() })
          .eq("id", connection.id);
        continue;
      }
      throw error;
    }

    console.log("Google fetch events:", { count: response.events.length, hasSyncToken: !!response.nextSyncToken, syncToken: nextSyncToken ? "yes" : "no" });

    nextSyncToken = response.nextSyncToken || nextSyncToken;
    pageToken = response.nextPageToken;

    for (const event of response.events) {
      try {
        const result = await processGoogleEvent(supabase, connection, event);
        if (result === "pulled") pulled++;
        if (result === "conflict") conflicts++;
      } catch (error) {
        errors.push(`Failed to process Google event ${event.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } while (pageToken);

  return { pulled, conflicts, errors, nextSyncToken };
}

function isInvalidSyncTokenError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const maybeCode = (error as { code?: unknown; status?: unknown }).code
    ?? (error as { code?: unknown; status?: unknown }).status;
  return maybeCode === 410 || error.message.includes("Sync token is no longer valid");
}

/**
 * Process a single Google Calendar event during pull sync.
 */
async function processGoogleEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  connection: GoogleConnection,
  event: calendar_v3.Schema$Event,
): Promise<"pulled" | "conflict" | "skipped"> {
  if (!event.id) return "skipped";

  // Check if this event was created by Orkest
  const orkestItemId = getOrkestItemIdFromEvent(event as Parameters<typeof getOrkestItemIdFromEvent>[0]);
  console.log("Processing Google event:", { id: event.id, summary: event.summary, status: event.status, isOrkest: !!orkestItemId });

  if (orkestItemId) {
    // This is an Orkest item that was modified in Google
    const { data: existingItem } = await supabase
      .from("items")
      .select("*")
      .eq("id", orkestItemId)
      .maybeSingle();

    if (existingItem && !existingItem.deleted_at) {
      if (event.status === "cancelled") {
        await softDeleteLocalItemFromGoogle(supabase, existingItem);
        return "pulled";
      }

      // Check for conflict: if local item was modified after last sync
      const lastGoogleSync = existingItem.last_google_sync_at || new Date(0).toISOString();
      const localUpdated = existingItem.updated_at || new Date(0).toISOString();

      if (localUpdated > lastGoogleSync) {
        // Local was also modified - conflict! Use last write wins
        // Google's updated time is usually in the event's updated field
        const googleUpdated = event.updated || new Date(0).toISOString();

        if (new Date(googleUpdated) > new Date(localUpdated)) {
          // Google is newer, update local
          await updateLocalItemFromGoogle(supabase, existingItem, event);
          return "pulled";
        } else {
          // Local is newer, will be pushed in next cycle
          return "conflict";
        }
      }

      // No conflict, update local
      await updateLocalItemFromGoogle(supabase, existingItem, event);
      return "pulled";
    }

    // Item was deleted locally — cancel the Google event to prevent resurrection
    if (event.status !== "cancelled") {
      try {
        await deleteGoogleEvent(connection, event.id!, supabase);
      } catch {
        // Event may already be deleted
      }
    }
    return "skipped";
  }

  // Not an Orkest-originated event. Check if we already have it by google_event_id.
  const { data: existingByGoogleId } = await supabase
    .from("items")
    .select("*")
    .eq("google_event_id", event.id)
    .eq("user_id", connection.user_id)
    .eq("google_calendar_id", connection.calendar_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingByGoogleId) {
    if (event.status === "cancelled") {
      await softDeleteLocalItemFromGoogle(supabase, existingByGoogleId);
      return "pulled";
    }

    await updateLocalItemFromGoogle(supabase, existingByGoogleId, event);
    return "pulled";
  }

  // This is a new event from Google - create local item
  // Skip birthday events and other non-standard event types
  if (event.status !== "cancelled" && event.eventType !== "birthday") {
    await createLocalItemFromGoogle(supabase, connection, event);
    return "pulled";
  }

  return "skipped";
}

async function softDeleteLocalItemFromGoogle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  existingItem: ItemRow,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("items")
    .update({
      deleted_at: now,
      updated_at: now,
      last_google_sync_at: now,
    })
    .eq("id", existingItem.id);
}

/**
 * Update a local item from a Google Calendar event.
 */
async function updateLocalItemFromGoogle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  existingItem: ItemRow,
  event: calendar_v3.Schema$Event,
): Promise<void> {
  const patch = googleEventToItemPatch(event as Parameters<typeof googleEventToItemPatch>[0]);
  console.log("[GoogleSync DEBUG] updateLocalItemFromGoogle:", JSON.stringify({
    eventId: event.id,
    eventSummary: event.summary,
    eventStart: event.start,
    eventEnd: event.end,
    eventRecurrence: event.recurrence,
    patch,
    existingItemTimezone: existingItem.timezone,
  }, null, 2));
  const rec = parseRruleToStructured(patch.rrule);
  const isAllDay = patch.allDay ?? false;

  // Build update with only defined fields to satisfy Supabase types
  const update: Database["public"]["Tables"]["items"]["Update"] = {
    last_google_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.startDate !== undefined) update.start_date = patch.startDate;
  if (patch.startTime !== undefined) update.start_time = isAllDay ? null : patch.startTime;
  if (patch.endDate !== undefined) update.end_date = patch.endDate;
  if (patch.endTime !== undefined) update.end_time = isAllDay ? null : patch.endTime;
  if (patch.allDay !== undefined) {
    update.all_day = patch.allDay;
    update.has_time = !patch.allDay && !!patch.startTime;
  }
  if (patch.timezone !== undefined) update.timezone = patch.timezone;
  if (patch.rrule !== undefined) {
    update.rrule = patch.rrule;
    update.recurrence_type = rec.recurrence_type;
    update.recurrence_interval = rec.recurrence_interval;
    update.days_of_week = rec.days_of_week;
    update.recurrence_end_type = rec.recurrence_end_type;
    update.recurrence_end_date = rec.recurrence_end_date;
    update.recurrence_count = rec.recurrence_count;
    update.recurrence_bysetpos = rec.recurrence_bysetpos;
  }
  if (patch.exdates !== undefined) update.exdates = patch.exdates;
  if (patch.status !== undefined) update.status = patch.status;

  await supabase
    .from("items")
    .update(update)
    .eq("id", existingItem.id);
}

/**
 * Parse an RRULE string into structured recurrence fields for the database.
 */
function parseRruleToStructured(rrule: string | null | undefined): {
  recurrence_type: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrence_interval: number;
  days_of_week: number[];
  recurrence_end_type: "never" | "on_date" | "after_count";
  recurrence_end_date: string | null;
  recurrence_count: number | null;
  recurrence_bysetpos: number | null;
} {
  const defaults = {
    recurrence_type: "none" as const,
    recurrence_interval: 1,
    days_of_week: [] as number[],
    recurrence_end_type: "never" as const,
    recurrence_end_date: null,
    recurrence_count: null,
    recurrence_bysetpos: null,
  };

  if (!rrule) return defaults;

  // Extract the RRULE line (skip EXDATE etc.)
  const rruleLine = rrule.split(/\r?\n/).find((l) => l.includes("FREQ="));
  if (!rruleLine) return defaults;

  const line = rruleLine.replace("RRULE:", "");
  const parts: Record<string, string> = {};
  for (const seg of line.split(";")) {
    const [key, val] = seg.split("=");
    if (key && val) parts[key] = val;
  }

  const freqMap: Record<string, "daily" | "weekly" | "monthly" | "yearly"> = {
    DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly",
  };
  const recurrence_type = freqMap[parts.FREQ] ?? "none";
  const recurrence_interval = parts.INTERVAL ? Number(parts.INTERVAL) || 1 : 1;

  let days_of_week: number[] = [];
  let recurrence_bysetpos: number | null = null;
  if (parts.BYDAY) {
    const { bysetpos, daysOfWeek } = parseGoogleByDay(parts.BYDAY);
    days_of_week = daysOfWeek;
    if (bysetpos !== undefined) recurrence_bysetpos = bysetpos;
  }

  let recurrence_end_type: "never" | "on_date" | "after_count" = "never";
  let recurrence_end_date: string | null = null;
  let recurrence_count: number | null = null;
  if (parts.COUNT) {
    recurrence_end_type = "after_count";
    recurrence_count = Number(parts.COUNT) || null;
  } else if (parts.UNTIL) {
    recurrence_end_type = "on_date";
    const u = parts.UNTIL;
    recurrence_end_date = u.length === 8 ? `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}` : u;
  }

  return { recurrence_type, recurrence_interval, days_of_week, recurrence_end_type, recurrence_end_date, recurrence_count, recurrence_bysetpos };
}

/**
 * Create a new local item from a Google Calendar event.
 */
async function createLocalItemFromGoogle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  connection: GoogleConnection,
  event: calendar_v3.Schema$Event,
): Promise<void> {
  const patch = googleEventToItemPatch(event as Parameters<typeof googleEventToItemPatch>[0]);
  const uid = `google-${event.id}`;
  const id = crypto.randomUUID();
  const rec = parseRruleToStructured(patch.rrule);

  const isAllDay = patch.allDay ?? false;

  const { error } = await supabase.from("items").insert({
    id,
    user_id: connection.user_id,
    uid,
    title: patch.title || event.summary || "Untitled",
    description: patch.description || null,
    has_time: !isAllDay && !!patch.startTime,
    start_date: patch.startDate || null,
    start_time: isAllDay ? null : (patch.startTime || null),
    end_date: patch.endDate || null,
    end_time: isAllDay ? null : (patch.endTime || null),
    all_day: isAllDay,
    timezone: patch.timezone || null,
    rrule: patch.rrule || null,
    exdates: patch.exdates || null,
    recurrence_type: rec.recurrence_type,
    recurrence_interval: rec.recurrence_interval,
    days_of_week: rec.days_of_week,
    recurrence_end_type: rec.recurrence_end_type,
    recurrence_end_date: rec.recurrence_end_date,
    recurrence_count: rec.recurrence_count,
    recurrence_bysetpos: rec.recurrence_bysetpos,
    status: patch.status || "active",
    google_event_id: event.id,
    google_calendar_id: connection.calendar_id,
    last_google_sync_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to create local item from Google event:", { event: event.summary, error });
    throw error;
  }
}

/**
 * Helper to convert a Supabase DB row to ManualItemRecord.
 * (Duplicated from mapping.ts to avoid circular dependency)
 */
function dbRowToManualItemRecord(row: ItemRow): ManualItemRecord {
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
    timezone: row.timezone ?? undefined,
    dueDate: row.due_date ?? undefined,
    recurrenceType: row.recurrence_type,
    recurrenceInterval: row.recurrence_interval,
    daysOfWeek: row.days_of_week ?? [],
    recurrenceEndType: row.recurrence_end_type,
    recurrenceEndDate: row.recurrence_end_date ?? undefined,
    recurrenceCount: row.recurrence_count ?? undefined,
    recurrenceBysetpos: row.recurrence_bysetpos ?? undefined,
    rrule: row.rrule ?? undefined,
    exdates: row.exdates ?? undefined,
    completedOccurrences: row.completed_occurrences ?? undefined,
    reopenedOccurrences: row.reopened_occurrences ?? undefined,
    priority: row.priority ?? undefined,
    estimateMinutes: row.estimate_minutes ?? undefined,
    tags: row.tags ?? undefined,
    parentId: row.parent_id ?? undefined,
    projectId: row.project_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
