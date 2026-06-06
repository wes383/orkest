/**
 * Google Calendar OAuth initiation endpoint.
 * Returns the Google consent URL for the user to authorize.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { getGoogleAuthUrl } from "@/lib/google/calendar-service";
import crypto from "crypto";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate cryptographically random state for CSRF protection
  const state = crypto.randomUUID();

  const authUrl = getGoogleAuthUrl(state);

  // Store state in a short-lived, httpOnly cookie for verification in callback
  const response = NextResponse.json({ url: authUrl });
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
