import { NextResponse } from "next/server";

import { sendAuthEmail } from "@/lib/email/resend";
import { checkSharedRateLimit, getAuthCodeRateLimitRules } from "@/lib/auth/rate-limit";
import { getRequestIp, verifyTurnstileToken } from "@/lib/auth/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LOCALE, addLocaleToPathname, normalizeLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionary";

type AuthCodePurpose = "signup" | "recovery";

type SendCodeBody = {
  email?: unknown;
  password?: unknown;
  purpose?: unknown;
  turnstileToken?: unknown;
  locale?: unknown;
};

function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function getRequestOrigin(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return new URL(request.url).origin;
}

function getEmailCopy(purpose: AuthCodePurpose, locale: Locale) {
  if (purpose === "signup") {
    return {
      subject: translate(locale, "auth.emailSubject.signup"),
      intro: translate(locale, "auth.emailIntro.signup"),
    };
  }

  return {
    subject: translate(locale, "auth.emailSubject.recovery"),
    intro: translate(locale, "auth.emailIntro.recovery"),
  };
}

export async function POST(request: Request) {
  let body: SendCodeBody;

  try {
    body = (await request.json()) as SendCodeBody;
  } catch {
    return NextResponse.json({ error: translate(DEFAULT_LOCALE, "auth.error.invalidBody") }, { status: 400 });
  }

  const locale = normalizeLocale(typeof body.locale === "string" ? body.locale : undefined);
  const email = normalizeEmail(body.email);
  const purpose = body.purpose;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: translate(locale, "auth.error.invalidEmail") }, { status: 400 });
  }

  if (purpose !== "signup" && purpose !== "recovery") {
    return NextResponse.json({ error: translate(locale, "auth.error.invalidPurpose") }, { status: 400 });
  }

  const requestIp = getRequestIp(request);
  const rateLimit = await checkSharedRateLimit(getAuthCodeRateLimitRules({ ip: requestIp, email, purpose }));

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

  const turnstile = await verifyTurnstileToken(body.turnstileToken, requestIp);
  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.error }, { status: 400 });
  }

  const origin = getRequestOrigin(request);
  const password = typeof body.password === "string" ? body.password : "";

  if (purpose === "signup" && password.length < 6) {
    return NextResponse.json({ error: translate(locale, "auth.error.passwordLength") }, { status: 400 });
  }

  const linkParams =
    purpose === "signup"
      ? {
          type: "signup" as const,
          email,
          password,
          options: {
            redirectTo: `${origin}${addLocaleToPathname("/auth/callback", locale)}?next=/`,
          },
        }
      : {
          type: "recovery" as const,
          email,
          options: {
            redirectTo: `${origin}${addLocaleToPathname("/auth/update-password", locale)}`,
          },
        };

  let data;
  let generateError;

  try {
    const supabase = createAdminClient();
    const result = await supabase.auth.admin.generateLink(linkParams);
    data = result.data;
    generateError = result.error;
  } catch (error) {
    console.error("[Auth] generateLink error:", error);
    return NextResponse.json({ error: translate(locale, "auth.error.generateCode") }, { status: 500 });
  }

  if (generateError) {
    console.error("[Auth] generateLink returned error:", generateError);
    return NextResponse.json({ error: translate(locale, "auth.error.generateCode") }, { status: 400 });
  }

  const properties = data?.properties;
  if (!properties) {
    return NextResponse.json({ error: translate(locale, "auth.error.generateCode") }, { status: 500 });
  }

  const copy = getEmailCopy(purpose, locale);

  try {
    await sendAuthEmail({
      to: email,
      subject: copy.subject,
      code: properties.email_otp,
      intro: copy.intro,
      locale,
    });
  } catch (sendError) {
    console.error("[Auth] sendAuthEmail error:", sendError);
    return NextResponse.json({ error: translate(locale, "auth.error.sendEmail") }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
