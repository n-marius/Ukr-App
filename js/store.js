// Lokale Datenhaltung (IndexedDB): abgeschlossene Erstbearbeitungen, Einstellungen, Chat-Startzähler.
const DB_NAME = "ukr-app";
const DB_VERSION = 3;
const STORE_ATTEMPTS = "attempts";
const STORE_SETTINGS = "settings";
const STORE_CHAT_STARTS = "chatStarts";
// Vokabeln (js/vstore.js): Stufen, Prios, Ereignisse, Meldungen, Korrekturen.
export const V_STORES = { levels: "vLevels", prios: "vPrios", events: "vEvents", flags: "vFlags", edits: "vEdits" };

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
        const store = db.createObjectStore(STORE_ATTEMPTS, { keyPath: "id" });
        store.createIndex("textId", "textId", { unique: false });
        store.createIndex("level", "level", { unique: false });
        store.createIndex("ts", "ts", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_CHAT_STARTS)) {
        db.createObjectStore(STORE_CHAT_STARTS, { keyPath: "id" });
      }
      for (const [kind, name] of Object.entries(V_STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        db.createObjectStore(name, { keyPath: { levels: "key", prios: "key", events: "id", flags: "id", edits: "wordId" }[kind] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
function getDb() {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

export async function tx(storeName, mode) {
  const db = await getDb();
  const t = db.transaction(storeName, mode);
  return { t, store: t.objectStore(storeName) };
}

export async function addAttempt(attempt) {
  const { t, store } = await tx(STORE_ATTEMPTS, "readwrite");
  store.put(attempt);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(attempt);
    t.onerror = () => reject(t.error);
  });
}

export async function clearAttempts() {
  const { t, store } = await tx(STORE_ATTEMPTS, "readwrite");
  store.clear();
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getAllAttempts() {
  const { store } = await tx(STORE_ATTEMPTS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function hasAttempt(textId) {
  const attempts = await getAllAttempts();
  return attempts.some((a) => a.textId === textId);
}

export async function mergeAttempts(remoteAttempts) {
  const { t, store } = await tx(STORE_ATTEMPTS, "readwrite");
  for (const a of remoteAttempts) store.put(a);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getSetting(key, fallback = null) {
  const { store } = await tx(STORE_SETTINGS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting(key, value) {
  const { t, store } = await tx(STORE_SETTINGS, "readwrite");
  store.put({ key, value });
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function exportData() {
  const attempts = await getAllAttempts();
  return JSON.stringify({ v: 1, attempts }, null, 2);
}

export async function importData(json) {
  const data = JSON.parse(json);
  if (!Array.isArray(data.attempts)) throw new Error("Ungültiges Importformat");
  const resetAt = await getSetting("resetAt", null);
  const valid = data.attempts.filter((a) => a && a.id && a.textId && a.level && a.ts && (!resetAt || a.ts > resetAt));
  await mergeAttempts(valid);
  return valid.length;
}

// Entfernt alle Datensätze, die vor oder bei einem Zurücksetzen entstanden sind.
export async function deleteAttemptsUpTo(resetAt) {
  const stale = (await getAllAttempts()).filter((a) => a.ts <= resetAt);
  if (stale.length === 0) return;
  const { t, store } = await tx(STORE_ATTEMPTS, "readwrite");
  for (const a of stale) store.delete(a.id);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Chat-Starts sind append-only Ereignisse (wie attempts), damit dieselbe
// resetAt-Schranke und derselbe Sync-Mechanismus wiederverwendet werden können.
export async function bumpChatStartCount(chatId) {
  const event = { id: crypto.randomUUID(), chatId, ts: new Date().toISOString() };
  const { t, store } = await tx(STORE_CHAT_STARTS, "readwrite");
  store.put(event);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(event);
    t.onerror = () => reject(t.error);
  });
}

export async function getAllChatStarts() {
  const { store } = await tx(STORE_CHAT_STARTS, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllChatStartCounts() {
  const resetAt = await getSetting("resetAt", null);
  const counts = {};
  for (const e of await getAllChatStarts()) {
    if (resetAt && e.ts <= resetAt) continue;
    counts[e.chatId] = (counts[e.chatId] ?? 0) + 1;
  }
  return counts;
}

export async function mergeChatStarts(remoteEvents) {
  const { t, store } = await tx(STORE_CHAT_STARTS, "readwrite");
  for (const e of remoteEvents) store.put(e);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Entfernt Chat-Start-Ereignisse, die vor oder bei einem Zurücksetzen entstanden sind.
export async function deleteChatStartsUpTo(resetAt) {
  const stale = (await getAllChatStarts()).filter((e) => e.ts <= resetAt);
  if (stale.length === 0) return;
  const { t, store } = await tx(STORE_CHAT_STARTS, "readwrite");
  for (const e of stale) store.delete(e.id);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function detectDevice() {
  const ua = navigator.userAgent || "";
  if (/iphone/i.test(ua)) return "iphone";
  if (/ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ipad";
  return "laptop";
}
