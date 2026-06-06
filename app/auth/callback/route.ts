import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server-client";
import { DEFAULT_LOCALE, addLocaleToPathname, getLocaleFromPathname } from "@/lib/i18n/config";

export async function GET(request: Request) {
  const { searchParams, origin, pathname } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const locale = getLocaleFromPathname(pathname) ?? DEFAULT_LOCALE;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if the user needs to set a username (new OAuth users)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const hasUsername = !!user.user_metadata?.username;
        const hasEmailIdentity = user.identities?.some((i) => i.provider === "email");
        const hasGoogleIdentity = user.identities?.some((i) => i.provider === "google");
        const hasAgreedToTerms = !!user.user_metadata?.terms_agreed;
        
        // User needs setup if:
        // 1. No username, OR
        // 2. Has Google identity but hasn't agreed to terms (unless they already have email identity)
        const needsSetup = !hasUsername || 
          (hasGoogleIdentity && !hasAgreedToTerms && !hasEmailIdentity);
        
        if (needsSetup) {
          return NextResponse.redirect(`${origin}${addLocaleToPathname("/auth/set-username", locale)}`);
        }
      }
      return NextResponse.redirect(`${origin}${addLocaleToPathname(next, locale)}`);
    }
  }

  return NextResponse.redirect(`${origin}${addLocaleToPathname("/auth", locale)}`);
}
