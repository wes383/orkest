/**
 * Google Calendar refresh endpoint.
 * POST: Refreshes the calendar list from Google, adding new calendars.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { listCalendars } from "@/lib/google/calendar-service";
import { encryptToken } from "@/lib/google/token-encryption";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get an existing connection to use for API call
  const { data: connections } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", user.id)
    .limit(1);

  if (!connections?.length) {
    return NextResponse.json({ error: "No Google Calendar connection found" }, { status: 404 });
  }

  const connection = connections[0];

  try {
    // Fetch latest calendar list from Google
    const calendars = await listCalendars(connection);

    // Get existing connections to preserve sync_enabled state
    const { data: existingConnections } = await supabase
      .from("google_calendar_connections")
      .select("id, calendar_id, sync_enabled")
      .eq("user_id", user.id);

    const existingMap = new Map(
      (existingConnections ?? []).map((c) => [c.calendar_id, c])
    );

    // Build set of calendar IDs to filter out (non-owned, birthday calendars)
    const filteredCalendarIds = new Set(
      calendars
        .filter((cal) => {
          // Filter non-owned calendars (required for calendar.events.owned scope)
          if (cal.accessRole !== "owner") return true;
          // Filter birthday calendars
          if (cal.id.includes("#contacts@") || cal.id.includes("addressbook#")) return true;
          return false;
        })
        .map((cal) => cal.id)
    );

    // Delete filtered calendar connections
    for (const calId of filteredCalendarIds) {
      const existing = existingMap.get(calId);
      if (existing) {
        await supabase
          .from("google_calendar_connections")
          .delete()
          .eq("id", existing.id);
        existingMap.delete(calId);
      }
    }

    // Upsert each owned calendar
    for (const cal of calendars) {
      const calId = cal.id || "primary";
      const existing = existingMap.get(calId);

      // Skip if already exists (preserve sync_enabled)
      if (existing) continue;

      // Only keep owned calendars (required for calendar.events.owned scope)
      if (cal.accessRole !== "owner") continue;

      // New calendar - add with sync disabled by default
      // Tokens are copied from an existing connection; they are already
      // encrypted at rest. We re-run encryptToken() to keep the call
      // idempotent in case a future migration has plaintext values.
      await supabase
        .from("google_calendar_connections")
        .upsert(
          {
            user_id: user.id,
            google_user_id: connection.google_user_id,
            calendar_id: calId,
            access_token: encryptToken(connection.access_token ?? ""),
            refresh_token: encryptToken(connection.refresh_token ?? ""),
            token_expires_at: connection.token_expires_at,
            scope: connection.scope,
            calendar_name: cal.name || null,
            sync_enabled: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,google_user_id,calendar_id" },
        );
    }

    // Return updated list
    const { data: updatedConnections } = await supabase
      .from("google_calendar_connections")
      .select("id, calendar_id, calendar_name, sync_enabled, last_sync_at")
      .eq("user_id", user.id)
      .order("calendar_name");

    return NextResponse.json({
      connected: true,
      calendars: (updatedConnections ?? []).map((c) => ({
        id: c.id,
        calendarId: c.calendar_id,
        calendarName: c.calendar_name,
        syncEnabled: c.sync_enabled,
        lastSyncAt: c.last_sync_at,
      })),
    });
  } catch (error) {
    console.error("Failed to refresh calendars:", error);
    return NextResponse.json(
      { error: "Refresh failed" },
      { status: 500 },
    );
  }
}
