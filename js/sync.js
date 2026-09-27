// Gist-Sync: privates Gist mit stats.json, Vereinigung nach id, append-only.
import { getAllAttempts, mergeAttempts, getSetting, setSetting } from "./store.js";

const API = "https://api.github.com";

export async function getSyncConfig() {
  const token = await getSetting("gistToken", "");
  const gistId = await getSetting("gistId", "");
  const lastSync = await getSetting("lastSync", null);
  const lastError = await getSetting("lastSyncError", null);
  return { token, gistId, lastSync, lastError };
}

export async function setSyncConfig({ token, gistId }) {
  if (token !== undefined) await setSetting("gistToken", token);
  if (gistId !== undefined) await setSetting("gistId", gistId);
}

export async function sync() {
  const { token, gistId } = await getSyncConfig();
  if (!token) return { skipped: true };

  try {
    let currentGistId = gistId;
    let remoteAttempts = [];

    if (currentGistId) {
      const res = await fetch(`${API}/gists/${currentGistId}`, {
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error(`Gist laden fehlgeschlagen: ${res.status}`);
      const gist = await res.json();
      const content = gist.files?.["stats.json"]?.content;
      if (content) {
        const parsed = JSON.parse(content);
        remoteAttempts = parsed.attempts ?? [];
      }
    }

    const localAttempts = await getAllAttempts();
    await mergeAttempts(remoteAttempts);
    const merged = await getAllAttempts();

    const needsWrite = merged.length !== remoteAttempts.length || localAttempts.some((a) => !remoteAttempts.some((r) => r.id === a.id));

    if (needsWrite || !currentGistId) {
      const body = {
        description: "Ukr-App Statistik",
        public: false,
        files: { "stats.json": { content: JSON.stringify({ v: 1, attempts: merged }, null, 2) } },
      };
      const url = currentGistId ? `${API}/gists/${currentGistId}` : `${API}/gists`;
      const method = currentGistId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: authHeaders(token), body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Gist schreiben fehlgeschlagen: ${res.status}`);
      const saved = await res.json();
      currentGistId = saved.id;
      await setSyncConfig({ gistId: currentGistId });
    }

    await setSetting("lastSync", new Date().toISOString());
    await setSetting("lastSyncError", null);
    return { ok: true };
  } catch (err) {
    await setSetting("lastSyncError", String(err.message ?? err));
    return { ok: false, error: err };
  }
}

export async function resetRemote() {
  const { token, gistId } = await getSyncConfig();
  if (!token || !gistId) return;
  const body = {
    files: { "stats.json": { content: JSON.stringify({ v: 1, attempts: [] }, null, 2) } },
  };
  await fetch(`${API}/gists/${gistId}`, { method: "PATCH", headers: authHeaders(token), body: JSON.stringify(body) });
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}
