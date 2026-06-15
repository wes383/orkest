"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { useAuth } from "@/lib/auth/auth-provider";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { OneSignalDeferred: any[] }
}

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

export function OneSignalProvider() {
  const { user, loading } = useAuth();
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const userId = user?.id ?? null;
    if (userId === currentUserId.current) return;
    currentUserId.current = userId;

    if (!window.OneSignalDeferred) return;

    if (userId) {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        await OneSignal.login(userId);
        // Request push permission (browser will only prompt if not yet asked)
        try {
          await OneSignal.Notifications.requestPermission();
        } catch {
          // Already denied or unsupported
        }
        if (user?.email) {
          try {
            await OneSignal.User.addEmail(user.email);
          } catch {
            // Email channel may not be configured in OneSignal
          }
        }
      });
    } else {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        await OneSignal.logout();
      });
    }
  }, [user, loading]);

  if (!ONESIGNAL_APP_ID) return null;

  return (
    <>
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        defer
      />
      <Script id="onesignal-init" strategy="afterInteractive">
        {`
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          OneSignalDeferred.push(async function(OneSignal) {
            await OneSignal.init({
              appId: "${ONESIGNAL_APP_ID}",
              notifyButton: { enable: false },
              // Reuse our orkest-sw.js as the OneSignal service worker so that
              // a single SW handles both push notifications and caching.
              serviceWorkerPath: "/orkest-sw.js",
              serviceWorkerParam: { scope: "/" },
            });
          });
        `}
      </Script>
    </>
  );
}
