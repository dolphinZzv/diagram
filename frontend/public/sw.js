/*
 * Runtime-caching service worker for offline / PWA support.
 *
 * Strategy:
 *  - Navigations (the HTML shell) are NETWORK-FIRST. A new deploy is picked up
 *    on the next load, so a stale shell can never reference removed assets
 *    (which previously caused a white screen).
 *  - Hashed /assets/* files are CACHE-FIRST (their names change per build).
 *  - API / MCP endpoints are never cached.
 *
 * Bump CACHE when the strategy changes so old caches are purged on activate.
 */
const CACHE = "diagram-v2";
const ASSET_RE = /\/assets\/[^/]+\.(?:js|css|woff2?|ttf|png|jpe?g|webp|gif|svg)$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

async function networkFirst(event, req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    // Only cache successful, same-origin responses of the expected type.
    if (res && res.ok && res.type === "basic") {
      await cache.put(req, res.clone());
      if (event.request.mode === "navigate") {
        await cache.put("/index.html", res.clone());
      }
    }
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match("/index.html")) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok && res.type === "basic") await cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache the API or MCP endpoints.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/mcp")) return;

  if (req.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(networkFirst(event, req));
    return;
  }
  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(networkFirst(event, req));
});
