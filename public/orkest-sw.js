// Orkest Service Worker
// Handles caching for offline support + imports OneSignal push SW

importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = "orkest-v1";
const PRECACHE_URLS = ["/", "/logo.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

// Install: precache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: route-based caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip cross-origin requests (except CDN assets)
  if (url.origin !== self.location.origin) return;

  // Skip API routes, auth routes, and service workers
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.endsWith(".js") && url.pathname.includes("OneSignal")
  ) {
    return;
  }

  // Static assets (/_next/static/, images, fonts): cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|svg|jpg|jpeg|gif|webp|ico|mp3|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Page navigations: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
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
    // Return cached page or fallback to home
    const cached = await caches.match(request);
    return cached || caches.match("/");
  }
}
