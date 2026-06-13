import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  addLocaleToPathname,
  detectLocaleFromAcceptLanguage,
  getLocaleFromPathname,
  isLocale,
  stripLocaleFromPathname,
  type Locale,
} from "@/lib/i18n/config";

function resolveRequestLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }
  return detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));
}

function localizedRedirect(request: NextRequest, pathname: string, locale: Locale) {
  const url = request.nextUrl.clone();
  url.pathname = addLocaleToPathname(pathname, locale);
  const response = NextResponse.redirect(url);
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

function localizedRewrite(request: NextRequest, pathname: string, locale: Locale) {
  const url = request.nextUrl.clone();
  url.pathname = addLocaleToPathname(pathname, locale);
  const response = NextResponse.rewrite(url);
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export async function proxy(request: NextRequest) {
  // Serve Service Workers directly to avoid locale redirect
  if (request.nextUrl.pathname === "/OneSignalSDKWorker.js") {
    return new NextResponse(
      `importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");`,
      {
        status: 200,
        headers: {
          "Content-Type": "application/javascript",
          "Cache-Control": "public, max-age=0, must-revalidate",
          "Service-Worker-Allowed": "/",
        },
      },
    );
  }

  const pathnameLocale = getLocaleFromPathname(request.nextUrl.pathname);
  const locale = pathnameLocale ?? resolveRequestLocale(request);

  if (!pathnameLocale) {
    return localizedRedirect(request, request.nextUrl.pathname, locale);
  }

  const pathname = stripLocaleFromPathname(request.nextUrl.pathname);
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow access to auth pages and public pages when not logged in
  const isAuthPage = pathname.startsWith("/auth");
  const isPublicPage =
    pathname === "/landing" ||
    pathname === "/pricing" ||
    pathname === "/terms-of-service" ||
    pathname === "/privacy-policy" ||
    pathname === "/refund-policy" ||
    pathname === "/open-source-licenses" ||
    pathname === "/sitemap.xml";

  if (!user && pathname === "/") {
    return localizedRewrite(request, "/landing", locale);
  }

  if (!user && !isAuthPage && !isPublicPage) {
    return localizedRedirect(request, "/auth", locale);
  }

  // Redirect logged-in users away from auth page
  if (
    user &&
    isAuthPage &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/auth/update-password") &&
    !pathname.startsWith("/auth/set-username")
  ) {
    return localizedRedirect(request, "/", locale);
  }

  supabaseResponse.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|opengraph-image|twitter-image|manifest\\.webmanifest|orkest-sw\\.js|OneSignalSDKWorker\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|xml|mp3|wav|ogg|html)$).*)",
  ],
};
