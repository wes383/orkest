"use client";

import { useEffect } from "react";

export function ServiceWorkerProvider() {
  useEffect(() => {
    // Disable service worker in development mode to prevent infinite reload loops and caching issues
    if (process.env.NODE_ENV === "development") return;
    if (!("serviceWorker" in navigator)) return;

    // Track whether the initial controller has already been set.
    let hasController = !!navigator.serviceWorker.controller;

    const loadStartedAt = Date.now();
    const RELOAD_COOLDOWN_MS = 30_000;
    const initialControllerUrl = navigator.serviceWorker.controller?.scriptURL ?? null;

    const findRegistration = async () => {
      // Look for any existing SW registration at root scope — either
      // orkest-sw.js (registered by us) or OneSignalSDKWorker.js
      // (registered by OneSignal SDK). Both files have identical content,
      // so either one is fine.
      let reg: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration("/");

      // If still no registration, register ourselves (fallback for cases
      // where OneSignal hasn't loaded yet or is disabled)
      if (!reg) {
        try {
          reg = await navigator.serviceWorker.register("/orkest-sw.js", { scope: "/" });
        } catch (err) {
          console.warn("[SW] registration failed:", err);
          return;
        }
      }

      setupListeners(reg);
    };

    const setupListeners = (reg: ServiceWorkerRegistration) => {
      // Re-check when the page becomes visible after being hidden for at
      // least 30s — the standard "background → foreground" refresh path.
      let lastHiddenAt = 0;
      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          lastHiddenAt = Date.now();
          return;
        }
        if (document.visibilityState === "visible" && lastHiddenAt && Date.now() - lastHiddenAt > 30_000) {
          reg.update().catch(() => {});
        }
        lastHiddenAt = 0;
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      // Only reload when a *new* SW (different scriptURL) replaces an
      // existing controller.
      const onControllerChange = () => {
        const newController = navigator.serviceWorker.controller;
        const newUrl = newController?.scriptURL ?? null;
        const isDifferentVersion = newUrl && initialControllerUrl && newUrl !== initialControllerUrl;
        const withinCooldown = Date.now() - loadStartedAt < RELOAD_COOLDOWN_MS;
        if (hasController && isDifferentVersion && !withinCooldown) {
          window.location.reload();
        }
        hasController = true;
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

      const onUpdateFound = () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {});
      };
      reg.addEventListener("updatefound", onUpdateFound);
    };

    findRegistration();
  }, []);

  return null;
}
