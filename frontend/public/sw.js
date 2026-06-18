const CACHE     = "spicy-shelf-v4";
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

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Skip non-http(s) requests entirely (chrome-extension://, etc.)
  if (!url.protocol.startsWith("http")) return;

  // Skip cross-origin requests — let them go straight to the network.
  // This covers external API calls like openlibrary.org so they are
  // never served from cache and always return fresh results.
  if (url.origin !== self.location.origin) return;

  // Network-first for our own API/auth routes
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

  // Network-first for navigation (page loads), fall back to cache then offline
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

  // Cache-first for same-origin static assets (JS, CSS, images, fonts)
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
