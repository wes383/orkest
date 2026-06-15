"use client";

import { useEffect } from "react";

export function ServiceWorkerProvider() {
  useEffect(() => {
    // Disable service worker in development mode to prevent infinite reload loops and caching issues
    if (process.env.NODE_ENV === "development") return;
    if (!("serviceWorker" in navigator)) return;

    console.log("[ORKEST-DEBUG][SW] provider mounted, controller=", !!navigator.serviceWorker.controller);

    // Track whether the initial controller has already been set.
    // The first `controllerchange` fires when a freshly-installed SW calls
    // skipWaiting() + clients.claim() during the *current* page load.
    // Reloading on that event causes an infinite refresh loop because the
    // same install → claim → reload cycle repeats on every load.
    let hasController = !!navigator.serviceWorker.controller;

    // Cooldown: if the page was reloaded very recently, don't reload again on
    // controllerchange. This breaks install→claim→reload loops where the SW
    // file's bytes differ on each request (e.g. Vercel serving 200 instead
    // of 304) but the content is effectively the same.
    const loadStartedAt = Date.now();
    const RELOAD_COOLDOWN_MS = 30_000;
    // The known controller scriptURL captured at first mount; we only reload
    // for an *update* (different scriptURL, e.g. ?v=2), not for a re-install
    // of the same URL.
    const initialControllerUrl = navigator.serviceWorker.controller?.scriptURL ?? null;

    navigator.serviceWorker
      .register("/orkest-sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[ORKEST-DEBUG][SW] registered, scope=", reg.scope, "active=", !!reg.active, "waiting=", !!reg.waiting, "installing=", !!reg.installing);
        // Do NOT call reg.update() here. The browser already checks for SW
        // updates on page load; an extra explicit update() during mount
        // combined with Vercel's max-age=0 responses was triggering an
        // install→claim→reload loop on every navigation. We only re-check
        // when the tab becomes visible after being hidden for a while.

        // Re-check when the page becomes visible after being hidden for at
        // least 30s — the standard "background → foreground" refresh path.
        let lastHiddenAt = 0;
        const onVisibilityChange = () => {
          console.log("[ORKEST-DEBUG][SW] visibilitychange to", document.visibilityState);
          if (document.visibilityState === "hidden") {
            lastHiddenAt = Date.now();
            return;
          }
          if (document.visibilityState === "visible" && lastHiddenAt && Date.now() - lastHiddenAt > 30_000) {
            console.log("[ORKEST-DEBUG][SW] tab returned after >30s, checking for update");
            reg.update().catch((e) => console.log("[ORKEST-DEBUG][SW] visibility update failed:", e));
          }
          lastHiddenAt = 0;
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        // Only reload when a *new* SW (different scriptURL) replaces an
        // existing controller. A same-URL reinstall (e.g. Vercel returning
        // 200 instead of 304 for byte-identical content) is treated as a
        // no-op so we don't loop.
        const onControllerChange = () => {
          const newController = navigator.serviceWorker.controller;
          const newUrl = newController?.scriptURL ?? null;
          const isDifferentVersion = newUrl && initialControllerUrl && newUrl !== initialControllerUrl;
          const withinCooldown = Date.now() - loadStartedAt < RELOAD_COOLDOWN_MS;
          console.log(
            "[ORKEST-DEBUG][SW] controllerchange fired, hasController=", hasController,
            "initialUrl=", initialControllerUrl,
            "newUrl=", newUrl,
            "differentVersion=", !!isDifferentVersion,
            "withinCooldown=", withinCooldown,
          );
          if (hasController && isDifferentVersion && !withinCooldown) {
            console.log("[ORKEST-DEBUG][SW] reloading because a genuinely new SW version took over");
            window.location.reload();
          } else if (hasController) {
            console.log("[ORKEST-DEBUG][SW] same-URL reinstall, ignoring (no reload)");
          }
          hasController = true;
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        const onUpdateFound = () => {
          console.log("[ORKEST-DEBUG][SW] updatefound — new SW installing");
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            console.log("[ORKEST-DEBUG][SW] new worker state ->", newWorker.state);
          });
        };
        reg.addEventListener("updatefound", onUpdateFound);

        return () => {
          document.removeEventListener("visibilitychange", onVisibilityChange);
        };
      })
      .catch((err) => {
        console.warn("[ORKEST-DEBUG][SW] registration failed:", err);
      });
  }, []);

  return null;
}
