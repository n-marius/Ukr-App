// Gist-Sync: privates Gist mit stats.json = { v, resetAt, attempts }.
// Vereinigung nach id (append-only). resetAt ist eine gemeinsame Grenze:
// Datensätze mit ts <= resetAt werden auf allen Geräten verworfen.
import { getAllAttempts, mergeAttempts, getSetting, setSetting, clearAttempts, deleteAttemptsUpTo } from "./store.js";

const API = "https://api.github.com";
const FILE = "stats.json";
let inflight = null;

export async function getSyncConfig() {
  return {
    token: await getSetting("gistToken", ""),
    gistId: await getSetting("gistId", ""),
    lastSync: await getSetting("lastSync", null),
    lastError: await getSetting("lastSyncError", null),
  };
}

export async function setSyncConfig({ token, gistId }) {
  if (token !== undefined) await setSetting("gistToken", token);
  if (gistId !== undefined) await setSetting("gistId", gistId);
}

// Mehrere gleichzeitige Aufrufe teilen sich einen Lauf (verhindert doppelt angelegte Gists).
export function sync() {
  if (!inflight) inflight = run().finally(() => { inflight = null; });
  return inflight;
}

export async function resetAllStats() {
  await setSetting("resetAt", new Date().toISOString());
  await clearAttempts();
  await sync();
}

async function run() {
  const { token, gistId } = await getSyncConfig();
  if (!token) return { skipped: true };
  if (!navigator.onLine) return { offline: true };

  try {
    let id = gistId;
    let remote = { attempts: [], resetAt: null };

    if (id) {
      const res = await fetch(`${API}/gists/${encodeURIComponent(id)}`, { headers: headers(token), cache: "no-store" });
      if (!res.ok) throw new Error(describe(res.status, "Laden"));
      const gist = await res.json();
      const content = gist.files?.[FILE]?.content;
      if (content) {
        const parsed = JSON.parse(content);
        remote = { attempts: parsed.attempts ?? [], resetAt: parsed.resetAt ?? null };
      }
    }

    const localReset = await getSetting("resetAt", null);
    const resetAt = [localReset, remote.resetAt].filter(Boolean).sort().at(-1) ?? null;
    if (resetAt) {
      await setSetting("resetAt", resetAt);
      await deleteAttemptsUpTo(resetAt);
    }

    const before = await getAllAttempts();
    await mergeAttempts(remote.attempts.filter((a) => !resetAt || a.ts > resetAt));
    const merged = await getAllAttempts();

    const remoteIds = new Set(remote.attempts.map((a) => a.id));
    const needsWrite =
      !id ||
      resetAt !== remote.resetAt ||
      merged.length !== remote.attempts.length ||
      merged.some((a) => !remoteIds.has(a.id));

    if (needsWrite) {
      const body = {
        description: "Ukrainisch-Lese-App · Statistik",
        public: false,
        files: { [FILE]: { content: JSON.stringify({ v: 1, resetAt, attempts: merged }, null, 2) } },
      };
      const res = await fetch(id ? `${API}/gists/${encodeURIComponent(id)}` : `${API}/gists`, {
        method: id ? "PATCH" : "POST",
        headers: headers(token),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(describe(res.status, "Speichern"));
      id = (await res.json()).id;
      await setSetting("gistId", id);
    }

    await setSetting("lastSync", new Date().toISOString());
    await setSetting("lastSyncError", null);
    return { ok: true, changed: merged.length !== before.length };
  } catch (err) {
    const message = err instanceof TypeError ? "Keine Verbindung zu GitHub." : String(err.message ?? err);
    await setSetting("lastSyncError", message);
    return { ok: false, error: message };
  }
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

function describe(status, action) {
  if (status === 401) return "Token ungültig oder abgelaufen.";
  if (status === 403) return "Token hat keine Berechtigung für Gists.";
  if (status === 404) return "Gist nicht gefunden – Gist-ID prüfen.";
  return `${action} fehlgeschlagen (HTTP ${status}).`;
}
