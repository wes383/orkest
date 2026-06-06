/**
 * Google Calendar push notification channel manager.
 *
 * Registers, renews, and stops webhook channels for real-time sync.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { getCalendarClient } from "./calendar-service";

type GoogleConnection = Database["public"]["Tables"]["google_calendar_connections"]["Row"];

const WEBHOOK_CALLBACK_URL = process.env.GOOGLE_CALENDAR_WEBHOOK_URL
  || `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/google-calendar/webhook`;

// Channel expiration: 7 days (Google's max is ~a few weeks, but 7 days is safe)
const CHANNEL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Register a push notification channel for a Google Calendar.
 * Returns the channel details to store on the connection.
 */
export async function registerNotificationChannel(
  connection: GoogleConnection,
): Promise<{
  channelId: string;
  channelToken: string;
  expiresAt: string;
}> {
  const supabase = createAdminClient();
  const calendar = await getCalendarClient(connection, supabase);
  const channelId = crypto.randomUUID();
  const channelToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CHANNEL_TTL_MS);

  await calendar.events.watch({
    calendarId: connection.calendar_id,
    requestBody: {
      id: channelId,
      token: channelToken,
      type: "web_hook",
      address: WEBHOOK_CALLBACK_URL,
      expiration: expiresAt.getTime().toString(),
    },
  });

  return {
    channelId,
    channelToken,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Stop an active push notification channel.
 */
export async function stopNotificationChannel(
  connection: GoogleConnection,
): Promise<void> {
  if (!connection.notification_channel_id || !connection.notification_channel_token) {
    return;
  }

  try {
    const supabase = createAdminClient();
    const calendar = await getCalendarClient(connection, supabase);
    await calendar.channels.stop({
      requestBody: {
        id: connection.notification_channel_id,
        token: connection.notification_channel_token,
      },
    });
  } catch (error) {
    // Channel may have already expired or been stopped
    console.warn("Failed to stop Google notification channel:", error);
  }
}

/**
 * Renew a push notification channel: stop the old one, register a new one.
 */
export async function renewNotificationChannel(
  connection: GoogleConnection,
): Promise<{
  channelId: string;
  channelToken: string;
  expiresAt: string;
} | null> {
  try {
    await stopNotificationChannel(connection);
    const channel = await registerNotificationChannel(connection);

    // Update the connection in the database (use admin client to bypass RLS)
    const supabase = createAdminClient();
    await supabase
      .from("google_calendar_connections")
      .update({
        notification_channel_id: channel.channelId,
        notification_channel_token: channel.channelToken,
        notification_channel_expires_at: channel.expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    return channel;
  } catch (error) {
    console.error("Failed to renew Google notification channel:", error);
    return null;
  }
}
