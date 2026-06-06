/**
 * Google Calendar channel renewal cron.
 * Renews notification channels that are expiring within 24 hours.
 *
 * Protected by CRON_SECRET header from Vercel Cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renewNotificationChannel } from "@/lib/google/channel-manager";

async function handleRenewChannels(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find channels expiring within 24 hours
  const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: connections, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("sync_enabled", true)
    .not("notification_channel_id", "is", null)
    .lte("notification_channel_expires_at", in24Hours);

  if (error) {
    console.error("[RenewChannels] Failed to query connections:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!connections?.length) {
    return NextResponse.json({ renewed: 0 });
  }

  let renewed = 0;
  const errors: string[] = [];

  for (const conn of connections) {
    try {
      const result = await renewNotificationChannel(conn);
      if (result) renewed++;
    } catch (err) {
      errors.push(`Connection ${conn.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("[RenewChannels] Completed:", { renewed, total: connections.length, errors: errors.length });

  return NextResponse.json({ renewed, total: connections.length, errors });
}

export async function GET(request: NextRequest) {
  return handleRenewChannels(request);
}

export async function POST(request: NextRequest) {
  return handleRenewChannels(request);
}
