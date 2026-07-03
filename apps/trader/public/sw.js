// WHISTL service worker — makes the app installable + resilient offline.
// Strategy is deliberately conservative so it never serves stale match data or
// breaks dev HMR / wallet flows:
//   • _next/static & images/fonts → cache-first (content-hashed, safe forever)
//   • navigations                 → network-first, fall back to cached shell
//   • everything else (API, HMR)  → network-only (pass straight through)
const VERSION = "txagent-v1";
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_CACHE = `${VERSION}-shell`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (RPC, TxLINE, ACE)
  if (url.pathname.includes("/_next/webpack-hmr") || url.pathname.includes("hot-update")) return;

  // Cache-first for immutable static assets.
  if (isCacheableStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Network-first for page navigations, falling back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error())),
    );
    return;
  }

  // Everything else (API, data) → network-only so fans always see fresh scores.
});

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icon.png", // fallback or specific icon
        badge: "/icon.png",
        vibrate: [200, 100, 200],
        data: data.data || {},
      })
    );
  } catch (err) {
    console.error("Push event error:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data.url || "/pulse")
  );
});
