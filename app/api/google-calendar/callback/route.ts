/**
 * Google Calendar OAuth callback endpoint.
 * Handles the redirect from Google after user authorizes.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  listCalendars,
  createOAuth2Client,
} from "@/lib/google/calendar-service";
import { registerNotificationChannel } from "@/lib/google/channel-manager";
import { encryptToken, decryptToken } from "@/lib/google/token-encryption";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/all?google=error", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  // Verify OAuth state parameter from cookie (CSRF protection)
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!code || !state || !storedState || state !== storedState) {
    const errorResponse = NextResponse.redirect(new URL("/all?google=error", request.url));
    errorResponse.cookies.delete("oauth_state");
    return errorResponse;
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get Google user info
    const googleUser = await getGoogleUserInfo(tokens.accessToken);

    // Get all calendars
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    const calendars = await listCalendars({
      id: "",
      user_id: user.id,
      google_user_id: googleUser.id,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? "",
      token_expires_at: tokens.expiresAt.toISOString(),
      scope: "https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      calendar_id: "primary",
      calendar_name: null,
      sync_enabled: true,
      last_sync_at: null,
      last_sync_token: null,
      notification_channel_id: null,
      notification_channel_token: null,
      notification_channel_expires_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Upsert each calendar as a separate connection, only enable primary by default
    for (const cal of calendars) {
      // Only keep calendars owned by the user (required for calendar.events.owned scope)
      if (cal.accessRole !== "owner") continue;
      // Skip birthday calendars
      if (cal.id.includes("#contacts@") || cal.id.includes("addressbook#")) continue;

      const conflictKeys = {
        user_id: user.id,
        google_user_id: googleUser.id,
        calendar_id: cal.id || "primary",
      };

      const { data: existing } = await supabase
        .from("google_calendar_connections")
        .select("refresh_token, sync_enabled")
        .match(conflictKeys)
        .maybeSingle();

      // `existing.refresh_token` is stored encrypted at rest; decrypt to
      // get the actual Google refresh token for the upsert below.
      const decryptedExistingRefresh = decryptToken(existing?.refresh_token);
      const refreshToken = tokens.refreshToken ?? decryptedExistingRefresh;
      if (!refreshToken) continue;

      // Keep existing sync_enabled if already connected, otherwise only enable primary
      const syncEnabled = existing?.sync_enabled ?? (cal.primary === true);

      await supabase
        .from("google_calendar_connections")
        .upsert(
          {
            ...conflictKeys,
            access_token: encryptToken(tokens.accessToken),
            refresh_token: encryptToken(refreshToken),
            token_expires_at: tokens.expiresAt.toISOString(),
            scope: "https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.calendarlist.readonly",
            calendar_name: cal.name || null,
            sync_enabled: syncEnabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,google_user_id,calendar_id" },
        );
    }

    // Register push notification channel for all enabled calendars
    try {
      const { data: enabledConnections } = await supabase
        .from("google_calendar_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("google_user_id", googleUser.id)
        .eq("sync_enabled", true);

      if (enabledConnections) {
        for (const conn of enabledConnections) {
          try {
            const channel = await registerNotificationChannel(conn);
            await supabase
              .from("google_calendar_connections")
              .update({
                notification_channel_id: channel.channelId,
                notification_channel_token: channel.channelToken,
                notification_channel_expires_at: channel.expiresAt,
              })
              .eq("id", conn.id);
          } catch (err) {
            console.warn(`Failed to register channel for calendar ${conn.calendar_id}:`, err);
          }
        }
      }
    } catch (channelError) {
      // Non-fatal: connection works without webhooks, user can still use manual sync
      console.warn("Failed to register Google notification channels:", channelError);
    }

    const successResponse = NextResponse.redirect(new URL("/all?google=connected", request.url));
    successResponse.cookies.delete("oauth_state");
    return successResponse;
  } catch (error) {
    console.error("Google Calendar OAuth callback error:", error);
    const errorResponse = NextResponse.redirect(new URL("/all?google=error", request.url));
    errorResponse.cookies.delete("oauth_state");
    return errorResponse;
  }
}
