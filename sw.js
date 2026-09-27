// App-Shell cache-first, content/index.json network-first mit Cache-Fallback,
// gelistete Texte werden vorab gecacht. Cache-Name trägt die App-Version.
const APP_VERSION = "1.0.0";
const CACHE_NAME = `ukr-app-${APP_VERSION}`;

const SHELL_FILES = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/reader.js",
  "js/quiz.js",
  "js/stats.js",
  "js/store.js",
  "js/sync.js",
  "icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL_FILES);
      try {
        const res = await fetch("content/index.json");
        const index = await res.json();
        await cache.put("content/index.json", res.clone());
        await Promise.all(
          index.texts.map(async (t) => {
            const r = await fetch(`content/${t.file}`);
            await cache.put(`content/${t.file}`, r);
          })
        );
      } catch {
        // Offline bei Erstinstallation: Texte werden beim nächsten Online-Start gecacht.
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("content/index.json")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return cached ?? Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    return cached ?? Response.error();
  }
}
