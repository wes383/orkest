/**
 * Google Calendar webhook endpoint.
 * Receives push notifications when calendar events change.
 *
 * Google sends:
 * - X-Goog-Channel-ID: our channel UUID
 * - X-Goog-Channel-Token: our verification token
 * - X-Goog-Resource-State: "sync" (handshake) | "exists" (changes) | "not_exists"
 * - X-Goog-Resource-ID: Google's resource ID
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/google/sync-engine";

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("X-Goog-Channel-ID");
  const channelToken = request.headers.get("X-Goog-Channel-Token");
  const resourceState = request.headers.get("X-Goog-Resource-State");

  if (!channelId || !channelToken) {
    return NextResponse.json({ error: "Missing channel headers" }, { status: 400 });
  }

  // Initial handshake: Google sends "sync" state when channel is first registered
  if (resourceState === "sync") {
    console.log("[Webhook] Channel sync handshake:", channelId);
    return new NextResponse(null, { status: 200 });
  }

  // Use admin client to bypass RLS (webhook has no user session)
  const supabase = createAdminClient();

  // First try exact match
  let { data: connections, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("notification_channel_id", channelId)
    .eq("sync_enabled", true);

  // Fallback: channel ID match without sync_enabled filter
  if (!connections?.length) {
    const fallback = await supabase
      .from("google_calendar_connections")
      .select("*")
      .eq("notification_channel_id", channelId);
    if (fallback.data?.length) {
      console.log("[Webhook] Found channel but sync_enabled is false, proceeding anyway");
      connections = fallback.data;
      error = fallback.error;
    }
  }

  if (error || !connections?.length) {
    // Return 200 so Google stops retrying this stale channel.
    // 404 causes Google to retry for days, spamming the logs.
    console.warn("[Webhook] Unknown channel (stale notification):", channelId);
    return new NextResponse(null, { status: 200 });
  }

  const connection = connections[0];

  // Verify token if provided by Google
  if (channelToken && connection.notification_channel_token !== channelToken) {
    console.warn("[Webhook] Token mismatch for channel:", channelId);
    return new NextResponse(null, { status: 200 });
  }

  try {
    const result = await runSync(connection, supabase);
    console.log("[Webhook] Sync completed:", {
      pushed: result.pushed,
      pulled: result.pulled,
      conflicts: result.conflicts,
      errors: result.errors,
    });
  } catch (err) {
    console.error("[Webhook] Sync failed:", err);
  }

  return new NextResponse(null, { status: 200 });
}
