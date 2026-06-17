import { z } from "zod";

import { checkAiDailyLimit, incrementAiUsage } from "@/lib/ai/daily-limit";
import { fetchUserMemories } from "@/lib/ai/memory";
import { generateMotivationalMessage } from "@/lib/daily-content";
import { LOCALE_AI_NAMES } from "@/lib/i18n/config";
import { buildServerTaskSummary } from "@/lib/server-task-summary";
import { createClient } from "@/lib/supabase/server-client";
import { getDateKeyWithOffset } from "@/lib/daily-digest-utils";

const requestSchema = z.object({
  username: z.string().optional(),
  locale: z.enum(["en", "zh-CN", "es", "fr", "de", "ja", "pt"]).default("en"),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezoneOffset: z.number().default(0),
  userTimezone: z.string().optional(),
  forceRegenerate: z.boolean().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { username, locale, dateKey, timezoneOffset, userTimezone, forceRegenerate } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from("daily_digests")
      .select("motivational_message")
      .eq("user_id", user.id)
      .eq("digest_date", dateKey)
      .maybeSingle();

    if (existing?.motivational_message) {
      return Response.json({ motivationalMessage: existing.motivational_message });
    }
  } else {
    // Clear existing cache entry for regeneration
    await supabase
      .from("daily_digests")
      .delete()
      .eq("user_id", user.id)
      .eq("digest_date", dateKey);
  }

  const withinLimit = await checkAiDailyLimit(user.id);
  if (!withinLimit.allowed) {
    return Response.json({ error: "Daily AI limit reached" }, { status: 429 });
  }

  const language = LOCALE_AI_NAMES[locale];

  // Build task summary server-side using the same logic as cron and frontend
  const { data: items } = await supabase
    .from("items")
    .select("id, uid, title, description, has_time, start_date, start_time, end_date, end_time, all_day, timezone, due_date, recurrence_type, recurrence_interval, days_of_week, recurrence_end_type, recurrence_end_date, recurrence_count, recurrence_bysetpos, priority, rrule, exdates, completed_occurrences, reopened_occurrences, deferred_until, dismissed_today_dates, planned_today_dates, now_override_date, parent_id, status, deleted_at, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  const { taskContext } = buildServerTaskSummary(items ?? [], dateKey, timezoneOffset, userTimezone);

  const memories = await fetchUserMemories(supabase, user.id);
  const memoryContext = memories.length > 0
    ? `Known about this user:\n${memories.map((m) => `- ${m.key}: ${m.value}`).join("\n")}`
    : "";

  try {
    const motivationalMessage = await generateMotivationalMessage({
      username,
      language,
      taskContext,
      memoryContext,
      userId: user.id,
    });

    await supabase
      .from("daily_digests")
      .upsert({
        user_id: user.id,
        digest_date: dateKey,
        motivational_message: motivationalMessage,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id,digest_date" });

    const cutoffDate = getDateKeyWithOffset(timezoneOffset, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    await supabase
      .from("daily_digests")
      .delete()
      .eq("user_id", user.id)
      .lt("digest_date", cutoffDate);

    await incrementAiUsage(user.id);

    return Response.json({ motivationalMessage });
  } catch (error) {
    console.error("Daily digest generation failed:", error);
    return Response.json({ error: "Failed to generate digest" }, { status: 500 });
  }
}
