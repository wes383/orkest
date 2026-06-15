"use client";

import { useEffect } from "react";

export function ServiceWorkerProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

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

        // Also listen for controllerchange – reload when a new SW takes over
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });

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
