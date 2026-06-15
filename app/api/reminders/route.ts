/**
 * Reminders API endpoint.
 * POST: Schedule reminders for an item.
 * DELETE: Cancel reminders for an item.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server-client";
import { scheduleItemReminders, cancelItemReminders } from "@/lib/onesignal/reminder-service";
import type { Reminder } from "@/lib/types/all-page";
import type { ManualItemRecord } from "@/lib/types/all-page";
import type { Locale } from "@/lib/i18n/config";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

export async function POST(request: NextRequest) {
  console.log("[ORKEST-DEBUG][Reminders API] POST hit, url=", request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log("[ORKEST-DEBUG][Reminders API] POST 401: no user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { itemId, reminders, title, startDate, startTime, timezone, allDay, rrule, completedOccurrences, exdates } = body as {
    itemId: string;
    reminders: Reminder[];
    title: string;
    startDate: string;
    startTime?: string;
    timezone?: string;
    allDay?: boolean;
    rrule?: string;
    completedOccurrences?: string[];
    exdates?: string[];
  };

  console.log(
    "[ORKEST-DEBUG][Reminders API] POST params:",
    { itemId, remindersLen: reminders?.length, title, startDate, startTime, timezone, allDay, rrule, completedOccurrencesLen: completedOccurrences?.length, exdatesLen: exdates?.length },
  );

  if (!itemId || !reminders?.length) {
    console.log("[ORKEST-DEBUG][Reminders API] POST 400: missing itemId or reminders", { itemId, remindersLen: reminders?.length });
    return NextResponse.json({ error: "Missing itemId or reminders" }, { status: 400 });
  }

  // Verify the item exists and is not deleted
  const { data: item } = await supabase
    .from("items")
    .select("id, deleted_at")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item || item.deleted_at) {
    console.log("[ORKEST-DEBUG][Reminders API] POST 404: item not found or deleted", { itemId, itemFound: !!item, deleted: item?.deleted_at });
    return NextResponse.json({ error: "Item not found or deleted" }, { status: 404 });
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : "en";

  try {
    console.log("[ORKEST-DEBUG][Reminders API] POST calling scheduleItemReminders for", itemId, "with", reminders.length, "reminders");
    const updatedReminders = await scheduleItemReminders(user.id, {
      id: itemId,
      title,
      startDate,
      startTime,
      timezone,
      reminders,
      allDay: allDay ?? false,
      rrule,
      completedOccurrences,
      exdates,
    } as ManualItemRecord, locale, user.email);

    const upcomingCount = updatedReminders?.filter((r) => r.occurrenceNotifications?.some((n) => n.notificationId)).length ?? 0;
    console.log(
      "[ORKEST-DEBUG][Reminders API] POST scheduleItemReminders returned",
      updatedReminders?.length ?? 0,
      "reminders, with",
      upcomingCount,
      "having at least one notificationId, locale=", locale,
    );

    return NextResponse.json({ reminders: updatedReminders });
  } catch (error) {
    console.error("[Reminders API] Failed to schedule reminders:", error);
    console.error("[ORKEST-DEBUG][Reminders API] POST 500 error for", itemId, error);
    return NextResponse.json(
      { error: "Failed to schedule reminders" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Validate input with Zod
  const cancelSchema = z.object({
    itemId: z.string().min(1).optional(),
    reminders: z.array(
      z.object({
        onesignalNotificationId: z.string().optional(),
        method: z.string().optional(),
        minutesBefore: z.number().optional(),
      }).passthrough()
    ).min(1),
  });

  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { reminders, itemId } = parsed.data;

  // Verify item ownership if itemId is provided
  if (itemId) {
    const { data: item } = await supabase
      .from("items")
      .select("id")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
  }

  try {
    await cancelItemReminders(reminders as unknown as Reminder[], itemId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Reminders API] Failed to cancel reminders:", error);
    return NextResponse.json(
      { error: "Failed to cancel reminders" },
      { status: 500 },
    );
  }
}
