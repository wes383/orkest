"use client";

import { useEffect } from "react";

export function ServiceWorkerProvider() {
  useEffect(() => {
    // Disable service worker in development mode to prevent infinite reload loops and caching issues
    if (process.env.NODE_ENV === "development") return;
    if (!("serviceWorker" in navigator)) return;

    console.log("[ORKEST-DEBUG][SW] provider mounted, controller=", !!navigator.serviceWorker.controller);

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
          console.log("[ORKEST-DEBUG][SW] registered (fallback), scope=", reg.scope);
        } catch (err) {
          console.warn("[ORKEST-DEBUG][SW] registration failed:", err);
          return;
        }
      } else {
        console.log("[ORKEST-DEBUG][SW] found existing registration, scope=", reg.scope, "active=", !!reg.active, "waiting=", !!reg.waiting, "installing=", !!reg.installing);
      }

      setupListeners(reg);
    };

    const setupListeners = (reg: ServiceWorkerRegistration) => {
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
      // existing controller.
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
    };

    findRegistration();
  }, []);

  return null;
}
