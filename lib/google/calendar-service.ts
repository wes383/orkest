/**
 * Google Calendar API service.
 *
 * Handles OAuth token management and Calendar API calls.
 * Uses googleapis for the actual API interaction.
 */

import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { createClient } from "@/lib/supabase/server-client";
import type { Database } from "@/lib/supabase/database.types";
import { decryptToken, encryptToken } from "./token-encryption";

type GoogleConnection = Database["public"]["Tables"]["google_calendar_connections"]["Row"];
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Deduplicate concurrent token refreshes per connection
const refreshPromises = new Map<string, Promise<void>>();

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.owned",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export function isGoogleNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const maybeCode = (error as { code?: unknown; status?: unknown }).code
    ?? (error as { code?: unknown; status?: unknown }).status;
  return maybeCode === 404 || error.message === "Not Found";
}

/**
 * Create an OAuth2 client configured for Google Calendar.
 */
export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

/**
 * Generate the Google OAuth consent URL.
 */
export function getGoogleAuthUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error("No access token received from Google");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000),
  };
}

/**
 * Get user info from Google to identify the Google account.
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
}> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get Google user info: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return {
    id: data.id ?? data.email ?? "",
    email: data.email ?? "",
    name: data.name ?? data.email ?? "",
  };
}

/**
 * Create an authenticated Calendar API client from a stored connection.
 */
export async function getCalendarClient(
  connection: GoogleConnection,
  supabaseClient?: SupabaseClient,
): Promise<calendar_v3.Calendar> {
  const oauth2Client = createOAuth2Client();
  // Tokens are stored encrypted at rest; decrypt before handing them to googleapis.
  oauth2Client.setCredentials({
    access_token: decryptToken(connection.access_token),
    refresh_token: decryptToken(connection.refresh_token),
  });

  // Check if token needs refresh (with deduplication for concurrent calls)
  const expiresAt = new Date(connection.token_expires_at);
  if (expiresAt.getTime() - Date.now() < 60_000) {
    const existing = refreshPromises.get(connection.id);
    if (existing) {
      await existing;
      // Re-read updated tokens
      const supabase = supabaseClient ?? await createClient();
      const { data: updated } = await supabase
        .from("google_calendar_connections")
        .select("access_token, refresh_token, token_expires_at")
        .eq("id", connection.id)
        .single();
      if (updated) {
        oauth2Client.setCredentials({
          access_token: decryptToken(updated.access_token),
          refresh_token: decryptToken(updated.refresh_token),
        });
      }
    } else {
      const refreshPromise = (async () => {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);

        // Update stored tokens. We re-encrypt access_token / refresh_token
        // before writing them back to the database.
        const newAccessToken = credentials.access_token
          ? encryptToken(credentials.access_token)
          : connection.access_token;
        const newRefreshToken = credentials.refresh_token
          ? encryptToken(credentials.refresh_token)
          : connection.refresh_token;

        const supabase = supabaseClient ?? await createClient();
        const { error } = await supabase
          .from("google_calendar_connections")
          .update({
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            token_expires_at: credentials.expiry_date
              ? new Date(credentials.expiry_date).toISOString()
              : connection.token_expires_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        if (error) {
          throw error;
        }
      })();

      refreshPromises.set(connection.id, refreshPromise);
      try {
        await refreshPromise;
      } finally {
        refreshPromises.delete(connection.id);
      }
    }
  }

  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * List all calendars for the authenticated user.
 */
export async function listCalendars(
  connection: GoogleConnection,
): Promise<Array<{ id: string; name: string; primary: boolean; selected: boolean; accessRole: string }>> {
  const calendar = await getCalendarClient(connection);
  const response = await calendar.calendarList.list();

  return (response.data.items ?? []).map((cal) => ({
    id: cal.id ?? "",
    name: cal.summary ?? cal.id ?? "",
    primary: cal.primary ?? false,
    selected: cal.selected ?? true,
    accessRole: cal.accessRole ?? "reader",
  }));
}

/**
 * Fetch events from Google Calendar with optional sync token for incremental sync.
 */
export async function fetchGoogleEvents(
  connection: GoogleConnection,
  options: {
    syncToken?: string;
    pageToken?: string;
    maxResults?: number;
    supabaseClient?: SupabaseClient;
  } = {},
): Promise<{
  events: calendar_v3.Schema$Event[];
  nextSyncToken?: string;
  nextPageToken?: string;
}> {
  const calendar = await getCalendarClient(connection, options.supabaseClient);

  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId: connection.calendar_id,
    maxResults: options.maxResults ?? 2500,
    singleEvents: false,
  };

  if (options.syncToken) {
    params.syncToken = options.syncToken;
  } else {
    // Initial sync: fetch events from 30 days ago to 1 year ahead
    params.timeMin = new Date(Date.now() - 30 * 86400_000).toISOString();
    params.timeMax = new Date(Date.now() + 365 * 86400_000).toISOString();
  }

  if (options.pageToken) {
    params.pageToken = options.pageToken;
  }

  const response = await calendar.events.list(params);

  return {
    events: response.data.items ?? [],
    nextSyncToken: response.data.nextSyncToken ?? undefined,
    nextPageToken: response.data.nextPageToken ?? undefined,
  };
}

/**
 * Create an event in Google Calendar.
 */
export async function createGoogleEvent(
  connection: GoogleConnection,
  event: calendar_v3.Schema$Event,
  supabaseClient?: SupabaseClient,
): Promise<calendar_v3.Schema$Event> {
  console.log("[GoogleSync DEBUG] createGoogleEvent request:", JSON.stringify({
    calendarId: connection.calendar_id,
    requestBody: event,
  }, null, 2));
  const calendar = await getCalendarClient(connection, supabaseClient);
  const response = await calendar.events.insert({
    calendarId: connection.calendar_id,
    requestBody: event,
  });
  console.log("[GoogleSync DEBUG] createGoogleEvent response:", JSON.stringify({
    id: response.data.id,
    summary: response.data.summary,
    start: response.data.start,
    end: response.data.end,
    recurrence: response.data.recurrence,
    status: response.data.status,
  }, null, 2));
  return response.data;
}

/**
 * Update an existing event in Google Calendar.
 */
export async function updateGoogleEvent(
  connection: GoogleConnection,
  eventId: string,
  event: calendar_v3.Schema$Event,
  supabaseClient?: SupabaseClient,
): Promise<calendar_v3.Schema$Event> {
  console.log("[GoogleSync DEBUG] updateGoogleEvent request:", JSON.stringify({
    calendarId: connection.calendar_id,
    eventId,
    requestBody: event,
  }, null, 2));
  const calendar = await getCalendarClient(connection, supabaseClient);
  const response = await calendar.events.patch({
    calendarId: connection.calendar_id,
    eventId,
    requestBody: event,
  });
  console.log("[GoogleSync DEBUG] updateGoogleEvent response:", JSON.stringify({
    id: response.data.id,
    summary: response.data.summary,
    start: response.data.start,
    end: response.data.end,
    recurrence: response.data.recurrence,
    status: response.data.status,
  }, null, 2));
  return response.data;
}

/**
 * Delete an event from Google Calendar.
 */
export async function deleteGoogleEvent(
  connection: GoogleConnection,
  eventId: string,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  const calendar = await getCalendarClient(connection, supabaseClient);
  await calendar.events.delete({
    calendarId: connection.calendar_id,
    eventId,
  });
}
