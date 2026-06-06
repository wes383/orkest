import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";

import { checkSharedRateLimit, getLoginRateLimitRules } from "@/lib/auth/rate-limit";
import { getRequestIp } from "@/lib/auth/turnstile";
import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionary";

type LoginBody = {
  email?: unknown;
  password?: unknown;
  locale?: unknown;
};

function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: translate(DEFAULT_LOCALE, "auth.error.invalidBody") }, { status: 400 });
  }

  const locale = normalizeLocale(typeof body.locale === "string" ? body.locale : undefined);
  const email = normalizeEmail(body.email);
  const password = body.password;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: translate(locale, "auth.error.invalidEmail") }, { status: 400 });
  }

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: translate(locale, "auth.error.enterPassword") }, { status: 400 });
  }

  const requestIp = getRequestIp(request);
  const rateLimit = await checkSharedRateLimit(getLoginRateLimitRules({ ip: requestIp, email }));

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: translate(locale, "auth.error.rateLimit", { seconds: rateLimit.retryAfterSeconds ?? 60 }) },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
        },
      },
    );
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const isUserError =
      error.message.includes("Invalid login credentials") ||
      error.message.includes("Email not confirmed") ||
      error.message.toLowerCase().includes("invalid");

    if (isUserError) {
      return NextResponse.json({ error: translate(locale, "auth.error.invalidCredentials") }, { status: 401 });
    }

    console.error("Login error:", error.message);
    return NextResponse.json({ error: translate(locale, "auth.error.invalidCredentials") }, { status: 401 });
  }

  return NextResponse.json(
    {
      ok: true,
      session: data.session,
    },
    { status: 200 },
  );
}
