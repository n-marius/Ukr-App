// App-Shell: cache-first, Cache-Name enthält die App-Version (bei jeder Änderung erhöhen!).
// content/index.json und content/chat/index.json: network-first mit Cache-Fallback;
// alle gelisteten Texte/Chats werden vorab gecacht und bei geänderter Content-Version neu geladen
// (Vokabeln: der Index enthält bereits alle Wörter).
const APP_VERSION = "3.5.0";
const SHELL_CACHE = `ukr-shell-${APP_VERSION}`;
const CONTENT_CACHE = "ukr-content";

const INDEXES = [
  { url: "content/index.json", listKey: "texts", versionKey: "text-content-version" },
  { url: "content/chat/index.json", listKey: "chats", versionKey: "chat-content-version" },
  // Vokabeln: der Index enthält bereits alle Wörter (keine Einzeldateien)
  { url: "content/vokabeln/index.json", listKey: "words", versionKey: "vocab-content-version", inline: true },
];

const SHELL_FILES = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/reader.js",
  "js/quiz.js",
  "js/chat.js",
  "js/stats.js",
  "js/store.js",
  "js/sync.js",
  "js/tokens.js",
  "js/prio.js",
  "js/vapp.js",
  "js/vcards.js",
  "js/vocab.js",
  "js/vstore.js",
  "fonts/literata-latin-opsz-normal.woff2",
  "fonts/literata-cyrillic-opsz-normal.woff2",
  "fonts/inter-latin-wght-normal.woff2",
  "fonts/inter-cyrillic-wght-normal.woff2",
  "icons/icon-180.png",
  "icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_FILES.map((url) => new Request(url, { cache: "reload" })));
    await Promise.all(INDEXES.map(async (idx) => {
      try {
        await refreshContent(idx, await fetch(idx.url, { cache: "no-store" }));
      } catch {
        // offline: Inhalte werden beim nächsten Online-Start geladen
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== SHELL_CACHE && key !== CONTENT_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const idx = INDEXES.find((i) => url.pathname.endsWith("/" + i.url));
  if (idx) {
    event.respondWith(indexNetworkFirst(idx, event));
  } else if (url.pathname.includes("/content/")) {
    event.respondWith(cacheFirst(CONTENT_CACHE, request));
  } else {
    event.respondWith(cacheFirst(SHELL_CACHE, request));
  }
});

async function indexNetworkFirst(idx, event) {
  try {
    const res = await fetch(event.request, { cache: "no-store" });
    if (res.ok) {
      event.waitUntil(refreshContent(idx, res.clone()).catch(() => {}));
      return res;
    }
    throw new Error(String(res.status));
  } catch {
    const cached = await (await caches.open(CONTENT_CACHE)).match(idx.url);
    return cached ?? Response.error();
  }
}

async function refreshContent(idx, indexResponse) {
  if (!indexResponse.ok) return;
  const cache = await caches.open(CONTENT_CACHE);
  const copy = indexResponse.clone();
  const index = await indexResponse.json();
  const base = idx.url.replace(/index\.json$/, "");
  const stored = await cache.match(idx.versionKey);
  const changed = !stored || (await stored.text()) !== String(index.version);

  await cache.put(idx.url, copy);
  await Promise.all((idx.inline ? [] : index[idx.listKey] ?? []).map(async (item) => {
    const url = `${base}${item.file}`;
    if (!changed && (await cache.match(url))) return;
    const res = await fetch(url, { cache: "reload" });
    if (res.ok) await cache.put(url, res);
  }));
  await cache.put(idx.versionKey, new Response(String(index.version)));
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  } catch {
    if (request.mode === "navigate") {
      const shell = await cache.match("index.html");
      if (shell) return shell;
    }
    return Response.error();
  }
}
