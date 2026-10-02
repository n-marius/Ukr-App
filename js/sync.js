// Gist-Sync: privates Gist mit stats.json = { v, resetAt, attempts, chatStarts, vocab }.
// Vereinigung jeweils nach id (append-only). resetAt ist eine gemeinsame Grenze:
// Datensätze/Ereignisse mit ts <= resetAt werden auf allen Geräten verworfen.
// `vocab` (Vokabelfunktion, SPEC.md Abschnitt 12.7): { resetAt, levelsResetAt, levels, prios, events, flags, edits } –
// Stufen, Prios, Meldungen und Korrekturen: je Schlüssel gewinnt der spätere ts; Ereignisse: Vereinigung nach id.
import {
  getAllAttempts, mergeAttempts, deleteAttemptsUpTo, clearAttempts,
  getAllChatStarts, mergeChatStarts, deleteChatStartsUpTo,
  getSetting, setSetting,
} from "./store.js";
import * as V from "./vstore.js";

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

export async function resetVocabStats() {
  const now = new Date().toISOString();
  await setSetting("vocabResetAt", now);
  await V.deleteEventsUpTo(now);
  await sync();
}

export async function resetVocabLevels() {
  const now = new Date().toISOString();
  await setSetting("vocabLevelsResetAt", now);
  await V.deleteLevelsUpTo(now);
  await sync();
}

const pick = (list, fields) => Object.fromEntries(list.map((e) => [e[fields.key], Object.fromEntries(fields.keep.map((k) => [k, e[k]]))]));

// Mischt den Vokabelteil des Gists mit den lokalen Daten und gibt den zu speichernden Stand zurück.
async function mergeVocab(remote) {
  const localReset = await getSetting("vocabResetAt", null);
  const resetAt = [localReset, remote.resetAt].filter(Boolean).sort().at(-1) ?? null;
  if (resetAt && resetAt !== localReset) await setSetting("vocabResetAt", resetAt);
  if (resetAt) await V.deleteEventsUpTo(resetAt);

  const localLevelsReset = await getSetting("vocabLevelsResetAt", null);
  const levelsResetAt = [localLevelsReset, remote.levelsResetAt].filter(Boolean).sort().at(-1) ?? null;
  if (levelsResetAt && levelsResetAt !== localLevelsReset) await setSetting("vocabLevelsResetAt", levelsResetAt);
  if (levelsResetAt) await V.deleteLevelsUpTo(levelsResetAt);

  await V.mergeEvents(remote.events, resetAt);
  await V.mergeLevels(remote.levels, levelsResetAt);
  await V.mergePrios(remote.prios);
  await V.mergeFlags(remote.flags);
  await V.mergeEdits(remote.edits);

  return {
    resetAt,
    levelsResetAt,
    levels: pick(await V.getAllLevels(), { key: "key", keep: ["stufe", "ts", "best", "noRest"] }),
    prios: pick(await V.getAllPrios(), { key: "key", keep: ["prio", "ts"] }),
    events: (await V.getAllEvents()).filter((e) => !resetAt || e.ts > resetAt),
    flags: Object.fromEntries((await V.getAllFlags()).map((f) => [f.id, f])),
    edits: Object.fromEntries((await V.getAllEdits()).map((e) => [e.wordId, e])),
  };
}

// Gleicher Inhalt? (Reihenfolge der Schlüssel egal; Einträge gelten über ihren Zeitstempel als gleich.)
function sameVocab(a, b) {
  const stamp = (m) => Object.entries(m ?? {}).map(([k, v]) => `${k}@${v.ts}`).sort().join("|");
  const ids = (l) => (l ?? []).map((e) => e.id).sort().join("|");
  return (a.resetAt ?? null) === (b.resetAt ?? null) && (a.levelsResetAt ?? null) === (b.levelsResetAt ?? null) &&
    ["levels", "prios", "flags", "edits"].every((k) => stamp(a[k]) === stamp(b[k])) && ids(a.events) === ids(b.events);
}

async function run() {
  const { token, gistId } = await getSyncConfig();
  if (!token) return { skipped: true };
  if (!navigator.onLine) return { offline: true };

  try {
    let id = gistId;
    let remote = { attempts: [], chatStarts: [], resetAt: null, vocab: {} };

    if (id) {
      const res = await fetch(`${API}/gists/${encodeURIComponent(id)}`, { headers: headers(token), cache: "no-store" });
      if (!res.ok) throw new Error(describe(res.status, "Laden"));
      const gist = await res.json();
      const content = gist.files?.[FILE]?.content;
      if (content) {
        const parsed = JSON.parse(content);
        remote = { attempts: parsed.attempts ?? [], chatStarts: parsed.chatStarts ?? [], resetAt: parsed.resetAt ?? null, vocab: parsed.vocab ?? {} };
      }
    }

    const localReset = await getSetting("resetAt", null);
    const resetAt = [localReset, remote.resetAt].filter(Boolean).sort().at(-1) ?? null;
    if (resetAt) {
      await setSetting("resetAt", resetAt);
      await deleteAttemptsUpTo(resetAt);
      await deleteChatStartsUpTo(resetAt);
    }

    const before = await getAllAttempts();
    await mergeAttempts(remote.attempts.filter((a) => !resetAt || a.ts > resetAt));
    const merged = await getAllAttempts();

    await mergeChatStarts(remote.chatStarts.filter((e) => !resetAt || e.ts > resetAt));
    const mergedChatStarts = await getAllChatStarts();

    const vocab = await mergeVocab(remote.vocab);

    const remoteIds = new Set(remote.attempts.map((a) => a.id));
    const remoteChatStartIds = new Set(remote.chatStarts.map((e) => e.id));
    const needsWrite =
      !id ||
      resetAt !== remote.resetAt ||
      merged.length !== remote.attempts.length ||
      merged.some((a) => !remoteIds.has(a.id)) ||
      mergedChatStarts.length !== remote.chatStarts.length ||
      mergedChatStarts.some((e) => !remoteChatStartIds.has(e.id)) ||
      !sameVocab(vocab, remote.vocab);

    if (needsWrite) {
      const body = {
        description: "Ukrainisch-Lese-App · Statistik",
        public: false,
        files: { [FILE]: { content: JSON.stringify({ v: 1, resetAt, attempts: merged, chatStarts: mergedChatStarts, vocab }, null, 2) } },
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
