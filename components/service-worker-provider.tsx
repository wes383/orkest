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
      // Clean up legacy OneSignalSDKWorker.js registrations that were created
      // before we switched to a single combined SW (orkest-sw.js).
      // If we find one, unregister it and reload immediately so that
      // OneSignal SDK re-initializes with the correct orkest-sw.js on the
      // next page load. Without the reload, OneSignal's internal reference
      // to the old registration becomes stale and postMessage fails.
      const allRegs = await navigator.serviceWorker.getRegistrations();
      let foundLegacy = false;
      for (const r of allRegs) {
        if (r.active?.scriptURL.includes("OneSignalSDKWorker") || r.waiting?.scriptURL.includes("OneSignalSDKWorker") || r.installing?.scriptURL.includes("OneSignalSDKWorker")) {
          console.log("[ORKEST-DEBUG][SW] unregistering legacy OneSignalSDKWorker registration, scope=", r.scope);
          await r.unregister();
          foundLegacy = true;
        }
      }
      if (foundLegacy) {
        // Register orkest-sw.js so it's ready on the next load, then reload
        try {
          await navigator.serviceWorker.register("/orkest-sw.js", { scope: "/" });
          console.log("[ORKEST-DEBUG][SW] registered orkest-sw.js, reloading to re-initialize OneSignal SDK");
        } catch {
          console.warn("[ORKEST-DEBUG][SW] fallback registration failed before reload");
        }
        window.location.reload();
        return;
      }

      // No legacy registrations — look for the orkest-sw.js registration
      let reg: ServiceWorkerRegistration | null | undefined = await navigator.serviceWorker.getRegistration("/orkest-sw.js");

      // If not found by URL, try getting any remaining registration at root scope
      if (!reg) {
        const remaining = await navigator.serviceWorker.getRegistrations();
        reg = remaining.find((r) => r.scope.endsWith("/")) ?? null;
      }

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
