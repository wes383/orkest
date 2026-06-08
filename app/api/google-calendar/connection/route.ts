/**
 * Google Calendar connection management endpoint.
 * GET: Returns all calendar connections for the user.
 * DELETE: Disconnects all user's Google Calendars.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { stopNotificationChannel } from "@/lib/google/channel-manager";
import { revokeGoogleToken } from "@/lib/google/token-revoke";
import { decryptToken } from "@/lib/google/token-encryption";

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
      // Revoke OAuth tokens at Google so the connection cannot be silently reused.
      // We revoke the refresh_token so that any cached access_token is invalidated as well.
      // We never block disconnect on revoke failure — best-effort.
      try {
        // Tokens are encrypted at rest; decrypt before sending to Google.
        const refreshToken = decryptToken(conn.refresh_token);
        const accessToken = decryptToken(conn.access_token);
        if (refreshToken) {
          await revokeGoogleToken(refreshToken);
        } else if (accessToken) {
          await revokeGoogleToken(accessToken);
        }
      } catch (err) {
        console.error("Failed to revoke Google token (best-effort):", err);
      }
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
