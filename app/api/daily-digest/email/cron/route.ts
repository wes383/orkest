import { createAdminClient } from "@/lib/supabase/admin";
import { ensureQuote, ensureOnThisDay, ensureBook, ensureMovie } from "@/lib/daily-content";
import { sendDailyDigestEmail, type DailyDigestExtras } from "@/lib/email/resend";
import { type Locale } from "@/lib/i18n/config";
import { buildServerTaskSummary } from "@/lib/server-task-summary";
import type { DigestTopic } from "@/lib/types/daily-digest";

export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const now = new Date();
  const currentUtcHour = now.getUTCHours();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  const { data: allSubscribers, error } = await admin
    .from("daily_digest_email")
    .select("user_id, send_hour, timezone_offset")
    .eq("enabled", true);

  if (error || !allSubscribers || allSubscribers.length === 0) {
    return Response.json({ processed: 0 });
  }

  const subscribers = allSubscribers.filter((sub) => {
    const utcHour = ((sub.send_hour + sub.timezone_offset / 60) % 24 + 24) % 24;
    return utcHour === currentUtcHour;
  });

  if (subscribers.length === 0) {
    return Response.json({ processed: 0 });
  }

  // Process subscribers with concurrency control to avoid overwhelming the DB
  const CONCURRENCY = 5;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < subscribers.length; i += CONCURRENCY) {
    const batch = subscribers.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (sub) => {
      const { data: { user } } = await admin.auth.admin.getUserById(sub.user_id);
      if (!user?.email) throw new Error("No email");

      const { data: subscription } = await admin
        .from("user_subscriptions")
        .select("status")
        .eq("user_id", sub.user_id)
        .maybeSingle();

      const isPro = subscription?.status === "active" || subscription?.status === "trialing";
      const signupDate = user.created_at ? new Date(user.created_at) : null;
      const trialEnd = signupDate ? new Date(signupDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
      const isTrial = trialEnd ? new Date() < trialEnd : false;

      if (!isPro && !isTrial) {
        return { skipped: true };
      }

      const username = user.user_metadata?.username as string | undefined;

      const { data: settings } = await admin
        .from("user_settings")
        .select("settings")
        .eq("user_id", sub.user_id)
        .maybeSingle();

      const settingsPayload = (settings?.settings as Record<string, unknown>) ?? {};
      const locale = (settingsPayload.locale as Locale) || "en";
      const userTopics: DigestTopic[] = (settingsPayload.dailyDigestTopics as DigestTopic[]) ?? ["task_summary"];

      const { data: items } = await admin
        .from("items")
        .select("id, uid, title, description, has_time, start_date, start_time, end_date, end_time, all_day, timezone, due_date, recurrence_type, recurrence_interval, days_of_week, recurrence_end_type, recurrence_end_date, recurrence_count, recurrence_bysetpos, priority, rrule, exdates, completed_occurrences, reopened_occurrences, deferred_until, dismissed_today_dates, planned_today_dates, now_override_date, parent_id, status, deleted_at, created_at")
        .eq("user_id", sub.user_id)
        .is("deleted_at", null);

      const { taskSummary } = buildServerTaskSummary(items ?? [], todayKey, sub.timezone_offset);

      const extras: DailyDigestExtras = {};

      const [quoteResult, onThisDayResult, bookResult, movieResult] = await Promise.allSettled([
        userTopics.includes("daily_quote") ? ensureQuote(admin, todayKey, locale, sub.user_id) : null,
        userTopics.includes("today_in_history") ? ensureOnThisDay(admin, todayKey, locale, sub.user_id) : null,
        userTopics.includes("daily_book") ? ensureBook(admin, todayKey, locale, sub.user_id) : null,
        userTopics.includes("daily_movie") ? ensureMovie(admin, todayKey, locale, sub.user_id) : null,
      ]);

      if (quoteResult.status === "fulfilled" && quoteResult.value) {
        extras.quote = quoteResult.value;
      }
      if (onThisDayResult.status === "fulfilled" && onThisDayResult.value) {
        extras.onThisDay = onThisDayResult.value.events;
      }
      if (bookResult.status === "fulfilled" && bookResult.value) {
        extras.book = bookResult.value;
      }
      if (movieResult.status === "fulfilled" && movieResult.value) {
        extras.movie = movieResult.value;
      }

      await sendDailyDigestEmail({
        to: user.email,
        username,
        locale,
        stats: {
          totalTasks: taskSummary.totalTasks,
          completedTasks: taskSummary.completedTasks,
          remainingTasks: taskSummary.remainingTasks,
          overdueTasks: taskSummary.overdueTasks,
        },
        highPriorityTitles: taskSummary.highPriorityTitles,
        extras,
      });

      await admin
        .from("daily_digest_email")
        .update({ last_sent_date: todayKey })
        .eq("user_id", sub.user_id);

      return { sent: true };
    })
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled" && "sent" in r.value && r.value.sent) sent++;
      if (r.status === "rejected") failed++;
    }
  }

  return Response.json({ processed: subscribers.length, sent, failed });
}
