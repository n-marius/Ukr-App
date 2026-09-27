// Lokale Datenhaltung (IndexedDB): abgeschlossene Erstbearbeitungen und Einstellungen.
const DB_NAME = "ukr-app";
const DB_VERSION = 1;
const STORE_ATTEMPTS = "attempts";
const STORE_SETTINGS = "settings";

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

async function tx(storeName, mode) {
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
  await mergeAttempts(data.attempts);
}

export function detectDevice() {
  const ua = navigator.userAgent || "";
  if (/iphone/i.test(ua)) return "iphone";
  if (/ipad/i.test(ua)) return "ipad";
  return "laptop";
}
