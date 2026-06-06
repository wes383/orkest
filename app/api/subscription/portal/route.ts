import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server-client";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the customer_id and subscription_id from the database
    const { data: subscriptionData, error: dbError } = await supabase
      .from("user_subscriptions")
      .select("customer_id, subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (dbError) {
      console.error("Failed to fetch user subscription from DB:", dbError);
      return NextResponse.json({ error: "Database query failed" }, { status: 500 });
    }

    if (!subscriptionData || !subscriptionData.customer_id) {
      return NextResponse.json({ error: "No subscription customer record found" }, { status: 404 });
    }

    const customerId = subscriptionData.customer_id;
    const subscriptionId = subscriptionData.subscription_id;

    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) {
      console.error("Missing PADDLE_API_KEY in environment variables.");
      return NextResponse.json({ error: "Billing system API Key is not configured" }, { status: 500 });
    }

    const paddleEnv = process.env.NEXT_PUBLIC_PADDLE_ENV || "sandbox";
    const baseUrl = paddleEnv === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

    // Request an authenticated customer portal session
    const response = await fetch(`${baseUrl}/customers/${customerId}/portal-sessions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        subscriptionId ? { subscription_ids: [subscriptionId] } : {}
      ),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Failed to generate Paddle portal session:", result);
      return NextResponse.json({ error: result.error?.detail || "Failed to create billing portal session" }, { status: response.status });
    }

    const portalUrl = result.data?.urls?.general?.overview || result.data?.urls?.overview;
    if (!portalUrl) {
      return NextResponse.json({ error: "No portal URL found in response" }, { status: 500 });
    }

    return NextResponse.json({ url: portalUrl });
  } catch (err) {
    console.error("Unexpected error in portal session route:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
