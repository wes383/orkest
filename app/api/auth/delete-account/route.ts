import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server-client";
import { stopNotificationChannel } from "@/lib/google/channel-manager";
import { inngest } from "@/lib/inngest/client";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // --- Cleanup external subscriptions before deleting data ---

    // 1. Cancel pending Inngest email reminders
    const { data: itemsWithReminders } = await admin
      .from("items")
      .select("id, reminders")
      .eq("user_id", user.id);

    if (itemsWithReminders?.length) {
      for (const item of itemsWithReminders) {
        const reminders = item.reminders as Array<{ method?: string }> | null;
        if (!reminders?.length) continue;
        const hasEmailReminder = reminders.some((r) => r.method === "email");
        if (!hasEmailReminder) continue;
        try {
          await inngest.send({
            name: "reminder.email.cancelled",
            data: { itemId: item.id },
          });
        } catch {
          // Best-effort cleanup — don't block account deletion
        }
      }
    }

    // 2. Stop Google Calendar notification channels
    const { data: connections } = await admin
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", user.id);

    if (connections?.length) {
      for (const conn of connections) {
        try {
          await stopNotificationChannel(conn);
        } catch {
          // Best-effort cleanup — channel may have already expired
        }
      }
    }

    // 3. Delete OneSignal user (removes push subscriptions & email channel)
    const appId = process.env.ONESIGNAL_APP_ID ?? process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_REST_API_KEY;

    if (appId && apiKey) {
      try {
        await fetch(
          `https://api.onesignal.com/apps/${appId}/users/by/external_id/${user.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Key ${apiKey}` },
          },
        );
      } catch {
        // Best-effort cleanup — don't block account deletion
      }
    }

    // --- Delete all user data via atomic RPC ---
    // All deletes run in a single database transaction to prevent partial deletion.
    const { error: dataDeleteError } = await (admin.rpc as any)("delete_user_data_cascade", {
      p_user_id: user.id,
    });

    if (dataDeleteError) {
      console.error("Failed to delete user data:", dataDeleteError);
      return NextResponse.json({ error: "Failed to delete user data" }, { status: 500 });
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Failed to delete auth user (data already removed):", deleteError);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Account deletion error:", err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
