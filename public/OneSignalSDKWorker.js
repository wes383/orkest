// OneSignalSDKWorker.js — identical to orkest-sw.js
// OneSignal SDK v16 internally registers this file regardless of
// serviceWorkerPath config. Keeping it in sync with orkest-sw.js ensures
// consistent behavior whichever script URL the SDK registers.

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = "orkest-v2";
const PRECACHE_URLS = ["/", "/logo.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

// Install: precache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all(PRECACHE_URLS.map((u) =>
        cache.add(u).catch(() => { /* precache failed for non-critical asset */ })
      )))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: route-based caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    // Navigation request — handled by networkFirst below
  }

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip API routes, auth routes, and service workers
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    (url.pathname.endsWith(".js") && url.pathname.includes("OneSignal"))
  ) {
    return;
  }

  // Static assets: stale-while-revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|svg|jpg|jpeg|gif|webp|ico|mp3|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Page navigations: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response("Offline", { status: 503 });
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match("/");
  }
}
