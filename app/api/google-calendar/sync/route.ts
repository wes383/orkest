/**
 * Google Calendar sync trigger endpoint.
 * POST: Triggers a sync for all enabled Google Calendar connections.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { runSyncForUser } from "@/lib/google/sync-engine";
import { checkSharedRateLimit } from "@/lib/auth/rate-limit";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: max 2 per minute, 10 per hour per user
  const rateLimit = await checkSharedRateLimit([
    { key: `gcal-sync:user-minute:${user.id}`, limit: 2, windowMs: 60_000 },
    { key: `gcal-sync:user-hour:${user.id}`, limit: 10, windowMs: 3_600_000 },
  ]);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) } },
    );
  }

  try {
    const result = await runSyncForUser(user.id, supabase);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Google Calendar sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 },
    );
  }
}
