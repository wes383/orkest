import { z } from "zod";
import { createClient } from "@/lib/supabase/server-client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("daily_digest_email")
    .select("enabled, send_hour, timezone_offset, last_sent_date")
    .eq("user_id", user.id)
    .maybeSingle();

  return Response.json({
    enabled: data?.enabled ?? false,
    sendHour: data?.send_hour ?? 8,
    timezoneOffset: data?.timezone_offset ?? 0,
    lastSentDate: data?.last_sent_date ?? null,
  });
}

const updateSchema = z.object({
  enabled: z.boolean(),
  sendHour: z.number().int().min(0).max(23).optional(),
  timezoneOffset: z.number().int().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { enabled, sendHour, timezoneOffset } = parsed.data;

  // Allow disabling for anyone, but enabling requires Pro or active trial
  if (!enabled) {
    await supabase
      .from("daily_digest_email")
      .upsert({ user_id: user.id, enabled: false }, { onConflict: "user_id" });
    return Response.json({ enabled: false });
  }

  // Check Pro or active trial
  const { data: subscription } = await supabase
    .from("user_subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const isPro = subscription?.status === "active" || subscription?.status === "trialing";
  const signupDate = user.created_at ? new Date(user.created_at) : null;
  const trialEnd = signupDate ? new Date(signupDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
  const isTrial = trialEnd ? new Date() < trialEnd : false;

  if (!isPro && !isTrial) {
    return Response.json({ error: "Pro subscription required" }, { status: 403 });
  }

  const { error } = await supabase
    .from("daily_digest_email")
    .upsert(
      {
        user_id: user.id,
        enabled: true,
        send_hour: sendHour ?? 8,
        timezone_offset: timezoneOffset ?? 0,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    return Response.json({ error: "Failed to update settings" }, { status: 500 });
  }

  return Response.json({ enabled: true, sendHour: sendHour ?? 8, timezoneOffset: timezoneOffset ?? 0 });
}
