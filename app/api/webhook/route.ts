import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function verifySignature(body: string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(";");
  const ts = parts.find((p) => p.startsWith("ts="))?.split("=")[1];
  const h1 = parts.find((p) => p.startsWith("h1="))?.split("=")[1];
  if (!ts || !h1) return false;

  // Verify timestamp drift (5 minutes maximum)
  const drift = Math.abs(Date.now() - parseInt(ts, 10) * 1000);
  if (drift > 300000) {
    console.error("Signature timestamp drift is too large:", drift);
    return false;
  }

  const signedPayload = `${ts}:${body}`;
  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "utf-8"),
      Buffer.from(h1, "utf-8")
    );
  } catch (err) {
    console.error("Signature timingSafeEqual error:", err);
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("paddle-signature") || "";
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET || "";

  if (!verifySignature(rawBody, signatureHeader, secret)) {
    // Only bypass in explicit local dev mode, never on Vercel or production
    if (process.env.BYPASS_WEBHOOK_AUTH === "true" && !process.env.VERCEL) {
      console.warn("⚠️ [Webhook Warning] Invalid Paddle signature bypassed (local dev only).");
    } else {
      console.error("Invalid Paddle Webhook signature.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch (error) {
    console.error("Failed to parse webhook JSON body:", error);
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const eventType = event.event_type as string;
  const data = event.data as Record<string, unknown> | undefined;

  if (!data) {
    return NextResponse.json({ error: "Missing data payload" }, { status: 400 });
  }

  const customData = data.custom_data as Record<string, unknown> | undefined;
  const userId = (customData?.userId || customData?.user_id) as string | undefined;

  if (!userId) {
    console.warn(`No userId in custom_data for event ${eventType}`);
    return NextResponse.json({ message: "No user associated with this event" }, { status: 200 });
  }

  const supabase = createAdminClient();

  const subscriptionId = data.id as string;
  const status = data.status as string;
  const customerId = data.customer_id as string;
  const items = data.items as Array<Record<string, unknown>> | undefined;
  const priceId = (items?.[0]?.price as Record<string, unknown> | undefined)?.id as string || null;
  const billingPeriod = data.current_billing_period as Record<string, unknown> | undefined;
  const currentPeriodEnd = (billingPeriod?.ends_at as string) || null;

  try {
    if (
      eventType === "subscription.created" ||
      eventType === "subscription.updated" ||
      eventType === "subscription.canceled" ||
      eventType === "subscription.past_due"
    ) {
      const { error } = await supabase
        .from("user_subscriptions")
        .upsert({
          user_id: userId,
          subscription_id: subscriptionId,
          status: status,
          price_id: priceId,
          customer_id: customerId,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error("Failed to upsert subscription in webhook:", error);
        return NextResponse.json({ error: "Failed to process subscription" }, { status: 500 });
      }
    } else {
      console.log(`Unhandled webhook event type: ${eventType}`);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Database operation error in Paddle webhook:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
