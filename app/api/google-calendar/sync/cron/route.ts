/**
 * Google Calendar fallback sync cron.
 * Runs incremental sync for all active connections as a safety net
 * for missed webhook notifications.
 *
 * Protected by CRON_SECRET header from Vercel Cron.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/google/sync-engine";

async function handleCronSync(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[SyncCron] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: connections, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("sync_enabled", true);

  if (error) {
    console.error("[SyncCron] Failed to query connections:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!connections?.length) {
    return NextResponse.json({ synced: 0 });
  }

  const results = await Promise.allSettled(
    connections.map(async (conn) => {
      const result = await runSync(conn, supabase);
      return { id: conn.id, result };
    }),
  );

  let synced = 0;
  const errors: string[] = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      synced++;
      if (r.value.result.errors.length > 0) {
        errors.push(`Connection ${r.value.id}: ${r.value.result.errors.join(", ")}`);
      }
    } else {
      errors.push(`Connection sync failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
  }

  console.log("[SyncCron] Completed:", { synced, total: connections.length, errors: errors.length });

  return NextResponse.json({ synced, total: connections.length, errors });
}

export async function GET(request: NextRequest) {
  return handleCronSync(request);
}

export async function POST(request: NextRequest) {
  return handleCronSync(request);
}
