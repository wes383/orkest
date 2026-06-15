"use client";

import { useEffect } from "react";

export function ServiceWorkerProvider() {
  useEffect(() => {
    // Disable service worker in development mode to prevent infinite reload loops and caching issues
    if (process.env.NODE_ENV === "development") return;
    if (!("serviceWorker" in navigator)) return;

    // Track whether the initial controller has already been set.
    // The first `controllerchange` fires when a freshly-installed SW calls
    // skipWaiting() + clients.claim() during the *current* page load.
    // Reloading on that event causes an infinite refresh loop because the
    // same install → claim → reload cycle repeats on every load.
    let hasController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker
      .register("/orkest-sw.js", { scope: "/" })
      .then((reg) => {
        // Check for updates on registration
        reg.update().catch(() => {});

        // Re-check when the page becomes visible (user switches back to tab)
        const onVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            reg.update().catch(() => {});
          }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        // Only reload when a *new* SW replaces an existing controller (i.e. an
        // update), not during the initial claim on first visit.
        const onControllerChange = () => {
          if (hasController) {
            window.location.reload();
          }
          hasController = true;
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        return () => {
          document.removeEventListener("visibilitychange", onVisibilityChange);
        };
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });
  }, []);

  return null;
}
