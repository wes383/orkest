/**
 * Google Calendar connection management endpoint.
 * GET: Returns all calendar connections for the user.
 * DELETE: Disconnects all user's Google Calendars.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { stopNotificationChannel } from "@/lib/google/channel-manager";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connections } = await supabase
    .from("google_calendar_connections")
    .select("id, calendar_id, calendar_name, sync_enabled, last_sync_at, created_at")
    .eq("user_id", user.id)
    .order("calendar_name");

  if (!connections?.length) {
    return NextResponse.json({ connected: false, calendars: [] });
  }

  return NextResponse.json({
    connected: true,
    calendars: connections.map((c) => ({
      id: c.id,
      calendarId: c.calendar_id,
      calendarName: c.calendar_name,
      syncEnabled: c.sync_enabled,
      lastSyncAt: c.last_sync_at,
      connectedAt: c.created_at,
    })),
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Stop notification channels before deleting connections
  const { data: connections } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", user.id);

  if (connections) {
    for (const conn of connections) {
      await stopNotificationChannel(conn);
    }
  }

  // Delete all connections for this user
  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete Google Calendar connections:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  // Clear Google sync data from items
  await supabase
    .from("items")
    .update({
      google_event_id: null,
      google_calendar_id: null,
      last_google_sync_at: null,
    })
    .eq("user_id", user.id)
    .not("google_event_id", "is", null);

  return NextResponse.json({ disconnected: true });
}
