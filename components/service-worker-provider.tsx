"use client";

import { useEffect } from "react";

export function ServiceWorkerProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/orkest-sw.js", { scope: "/" })
      .then((reg) => {
        // Check for updates periodically
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });
  }, []);

  return null;
}
