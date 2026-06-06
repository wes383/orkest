/**
 * Google Calendar push endpoint.
 * POST: Pushes a single local item change to Google Calendar.
 *
 * Body: { itemId: string, operation: "create" | "update" | "delete" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import {
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  isGoogleNotFoundError,
} from "@/lib/google/calendar-service";
import { itemToGoogleEvent } from "@/lib/google/event-converter";
import { dbRowToManualItemRecord } from "@/lib/supabase/mapping";
import type { Database } from "@/lib/supabase/database.types";

type GoogleConnection = Database["public"]["Tables"]["google_calendar_connections"]["Row"];
type ItemRow = Database["public"]["Tables"]["items"]["Row"];

function selectConnection(
  connections: GoogleConnection[],
  googleCalendarId?: string | null,
): GoogleConnection | null {
  if (googleCalendarId) {
    return connections.find((conn) => conn.calendar_id === googleCalendarId) ?? null;
  }
  return connections[0] ?? null;
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

async function markGoogleSynced(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
): Promise<void> {
  await supabase
    .from("items")
    .update({ last_google_sync_at: new Date().toISOString() })
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
    console.warn("[Push] Google event was already missing; clearing local mapping.", {
      itemId,
      eventId,
      calendarId: connection.calendar_id,
    });
  }

  await clearGoogleMapping(supabase, itemId);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { itemId, operation } = body as { itemId: string; operation: "create" | "update" | "delete" };

  if (!itemId || !operation) {
    return NextResponse.json({ error: "Missing itemId or operation" }, { status: 400 });
  }

  // Get all enabled Google Calendar connections
  const { data: connections, error: connError } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("sync_enabled", true);

  if (connError || !connections?.length) {
    return NextResponse.json({ error: "No active Google Calendar connection" }, { status: 404 });
  }

  // For delete, we just need the google_event_id
  if (operation === "delete") {
    // Item may already be soft-deleted, so query without deleted_at filter
    const { data: item } = await supabase
      .from("items")
      .select("google_event_id, google_calendar_id")
      .eq("id", itemId)
      .single();

    if (item?.google_event_id) {
      const connection = selectConnection(connections, item.google_calendar_id);
      if (!connection) {
        return NextResponse.json({ error: "Google Calendar connection for item not found" }, { status: 404 });
      }

      try {
        await deleteMappedGoogleEvent(supabase, connection, itemId, item.google_event_id);
      } catch (error) {
        console.error("[Push] Failed to delete Google event:", error);
        return NextResponse.json({ error: "Failed to delete Google event" }, { status: 500 });
      }
    }
    return NextResponse.json({ success: true });
  }

  // For create/update, fetch the full item
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .is("deleted_at", null)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const connection = selectConnection(connections, item.google_calendar_id);
  if (!connection) {
    return NextResponse.json({ error: "Google Calendar connection for item not found" }, { status: 404 });
  }

  if (!hasCalendarDate(item)) {
    if (item.google_event_id) {
      try {
        await deleteMappedGoogleEvent(supabase, connection, item.id, item.google_event_id);
      } catch (error) {
        console.error("[Push] Failed to delete undated Google event:", error);
        return NextResponse.json({ error: "Failed to delete Google event for undated item" }, { status: 500 });
      }
    } else {
      await markGoogleSynced(supabase, item.id);
    }

    return NextResponse.json({ success: true, skipped: true, reason: "undated_item" });
  }

  // Idempotency: skip if already synced after last update
  if (item.last_google_sync_at && item.updated_at) {
    if (new Date(item.last_google_sync_at).getTime() >= new Date(item.updated_at).getTime()) {
      return NextResponse.json({ success: true, skipped: true });
    }
  }

  const record = dbRowToManualItemRecord(item);
  const googleEvent = itemToGoogleEvent(record);

  if (process.env.NODE_ENV === "development") {
    console.log("[GoogleSync DEBUG] push route - item data:", JSON.stringify({
      id: item.id,
      google_event_id: item.google_event_id,
      timezone: item.timezone,
      start_date: item.start_date,
      start_time: item.start_time,
      end_date: item.end_date,
      end_time: item.end_time,
      rrule: item.rrule,
      days_of_week: item.days_of_week,
      updated_at: item.updated_at,
      last_google_sync_at: item.last_google_sync_at,
    }, null, 2));
  }

  try {
    if (item.google_event_id) {
      // Update existing Google event
      try {
        await updateGoogleEvent(connection, item.google_event_id, googleEvent, supabase);
      } catch (error) {
        if (!isGoogleNotFoundError(error)) {
          throw error;
        }

        console.warn("[Push] Google event was missing during update; recreating.", {
          itemId: item.id,
          eventId: item.google_event_id,
          calendarId: connection.calendar_id,
        });
        const created = await createGoogleEvent(connection, googleEvent, supabase);
        await supabase
          .from("items")
          .update({
            google_event_id: created.id,
            google_calendar_id: connection.calendar_id,
            last_google_sync_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        return NextResponse.json({ success: true, googleEventId: created.id, recreated: true });
      }
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

      return NextResponse.json({ success: true, googleEventId: created.id });
    }

    // Update sync timestamp
    await supabase
      .from("items")
      .update({ last_google_sync_at: new Date().toISOString() })
      .eq("id", item.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push] Failed to push to Google:", error);
    return NextResponse.json(
      { error: "Failed to push to Google" },
      { status: 500 },
    );
  }
}
