import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { sendFeedbackEmail } from "@/lib/email/resend";
import { checkSharedRateLimit } from "@/lib/auth/rate-limit";

function getFeedbackReceiverEmail() {
  if (process.env.FEEDBACK_RECEIVER_EMAIL) {
    return process.env.FEEDBACK_RECEIVER_EMAIL;
  }
  const fromAddr = process.env.AUTH_EMAIL_FROM;
  if (fromAddr) {
    const match = fromAddr.match(/<([^>]+)>/);
    if (match) {
      return match[1];
    }
    return fromAddr;
  }
  return "support@orkest.dev";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: max 3 per minute, 10 per hour per user
    const rateLimit = await checkSharedRateLimit([
      { key: `feedback:user-minute:${user.id}`, limit: 3, windowMs: 60_000 },
      { key: `feedback:user-hour:${user.id}`, limit: 10, windowMs: 3_600_000 },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds ?? 60) } },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { type, content } = body;

    if (!type || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const allowedTypes = ["bug", "feature_request", "general", "technical_support"];
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Feedback content cannot be empty" }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: "Feedback content exceeds 1000 characters limit" }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent") || undefined;
    const receiverEmail = getFeedbackReceiverEmail();

    await sendFeedbackEmail({
      to: receiverEmail,
      fromUserEmail: user.email ?? "",
      fromUserName: user.user_metadata?.username ?? undefined,
      fromUserId: user.id,
      type,
      content: content.trim(),
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Feedback] Failed to submit:", err);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
