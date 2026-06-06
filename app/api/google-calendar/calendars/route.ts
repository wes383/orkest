/**
 * Google Calendar list endpoint.
 * GET: Returns all calendar connections for the user.
 * PATCH: Toggle sync_enabled for a calendar connection.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { registerNotificationChannel, stopNotificationChannel } from "@/lib/google/channel-manager";

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
    .select("id, calendar_id, calendar_name, sync_enabled, last_sync_at")
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
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, syncEnabled } = body;

  if (!id || typeof syncEnabled !== "boolean") {
    return NextResponse.json({ error: "Missing id or syncEnabled" }, { status: 400 });
  }

  // Get the connection details
  const { data: connection, error: fetchError } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("google_calendar_connections")
    .update({ sync_enabled: syncEnabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to update calendar connection:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Register or stop webhook channel based on sync_enabled
  if (syncEnabled) {
    // Register webhook for newly enabled calendar
    try {
      const channel = await registerNotificationChannel({ ...connection, sync_enabled: true });
      await supabase
        .from("google_calendar_connections")
        .update({
          notification_channel_id: channel.channelId,
          notification_channel_token: channel.channelToken,
          notification_channel_expires_at: channel.expiresAt,
        })
        .eq("id", id);
    } catch (err) {
      console.warn(`Failed to register webhook for calendar ${connection.calendar_id}:`, err);
    }
  } else {
    // Stop webhook for disabled calendar
    try {
      await stopNotificationChannel(connection);
      await supabase
        .from("google_calendar_connections")
        .update({
          notification_channel_id: null,
          notification_channel_token: null,
          notification_channel_expires_at: null,
        })
        .eq("id", id);
    } catch (err) {
      console.warn(`Failed to stop webhook for calendar ${connection.calendar_id}:`, err);
    }
  }

  return NextResponse.json({ success: true });
}
