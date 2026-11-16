/* Offline support. The build fills in ASSETS (every built file: code, styles,
 * fonts) and sets VERSION to a hash of that list (see vite.config.js), so the
 * whole app is cached on the first visit and each deploy replaces the cache. */
const VERSION = "dev";
const ASSETS = [];
const CACHE = "sprint-" + VERSION;
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", ...ASSETS];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      // Everything except the current cache, including "webllm/*" model caches
      // left by an earlier on-device version of the Talk tab (hundreds of MB).
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return; // always network

  // Pages: network first so deploys show up, cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Our own hashed assets and icons: stale-while-revalidate.
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req)
        .then((res) => {
          if (res.ok || res.type === "opaque") c.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
