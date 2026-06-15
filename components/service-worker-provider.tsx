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

    navigator.serviceWorker
      .register("/orkest-sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[ORKEST-DEBUG][SW] registered, scope=", reg.scope, "active=", !!reg.active, "waiting=", !!reg.waiting, "installing=", !!reg.installing);
        // Check for updates on registration
        reg.update().catch((e) => console.log("[ORKEST-DEBUG][SW] reg.update failed:", e));

        // Re-check when the page becomes visible (user switches back to tab)
        const onVisibilityChange = () => {
          console.log("[ORKEST-DEBUG][SW] visibilitychange to", document.visibilityState);
          if (document.visibilityState === "visible") {
            reg.update().catch((e) => console.log("[ORKEST-DEBUG][SW] visibility update failed:", e));
          }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        // Only reload when a *new* SW replaces an existing controller (i.e. an
        // update), not during the initial claim on first visit.
        const onControllerChange = () => {
          console.log("[ORKEST-DEBUG][SW] controllerchange fired, hasController=", hasController, "navigator.controller=", !!navigator.serviceWorker.controller);
          if (hasController) {
            console.log("[ORKEST-DEBUG][SW] reloading because a new SW took over an already-controlling client");
            window.location.reload();
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
