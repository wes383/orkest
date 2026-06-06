/**
 * Google Calendar sync trigger endpoint.
 * POST: Triggers a sync for all enabled Google Calendar connections.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { runSyncForUser } from "@/lib/google/sync-engine";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSyncForUser(user.id, supabase);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Google Calendar sync error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
