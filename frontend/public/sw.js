const CACHE     = "spicy-shelf-v3";
const OFFLINE   = "/offline.html";

// App shell — files to cache on install
const SHELL = [
  "/",
  "/offline.html",
  "/favicon.ico",
  "/icon-32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

// ── Install — cache the app shell ────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// ── Activate — clear old caches ──────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — network first for API, cache first for assets ────────────────────
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Always go network-first for API calls — never serve stale data
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: "You're offline" }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        })
      )
    );
    return;
  }

  // For navigation requests (page loads) — network first, fall back to cache, then offline page
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(e.request);
          return cached || caches.match(OFFLINE);
        })
    );
    return;
  }

  // For static assets (JS, CSS, fonts, images) — cache first, then network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === "opaque") return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
