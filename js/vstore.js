// Lokale Daten der Vokabelfunktion (IndexedDB, gleiche Datenbank wie store.js).
// Jede Karte ist ein Wort in einer Richtung: Schlüssel „<wortId>:<richtung>“ (z. B. „v0007:de-uk“).
//  - levels  { key, stufe, ts, best, noRest? } Leitner-Stufe 1–5, pro Karte gewinnt der spätere ts (Sync); noRest: keine 24-h-Sperre
//  - prios   { key, prio, ts }           persönliche Prio; ohne Eintrag gilt „normal“
//  - events  { id, ts, cardId, correct, mode }   bearbeitete Karten (append-only, Tagesstatistik)
//  - flags   { id, wordId, field, note, ts, status }   Meldungen, pro id gewinnt der spätere ts
//  - edits   { wordId, ts, deleted, …Felder }          Korrekturen/Löschungen je Wort, der spätere ts gewinnt
import { tx, V_STORES as S, getSetting } from "./store.js";

export const PRIOS = ["hoch", "normal", "niedrig"];
export const STUFEN = [1, 2, 3, 4, 5];
export const EDIT_FIELDS = ["uk", "a", "de", "alt", "pos", "gen", "asp", "forms", "zusatz"];

const done = (t, value) => new Promise((resolve, reject) => { t.oncomplete = () => resolve(value); t.onerror = () => reject(t.error); });
const request = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

async function getAll(name) {
  const { store } = await tx(name, "readonly");
  return request(store.getAll());
}
async function putAll(name, list) {
  if (list.length === 0) return;
  const { t, store } = await tx(name, "readwrite");
  for (const item of list) store.put(item);
  return done(t);
}
async function deleteKeys(name, keys) {
  if (keys.length === 0) return;
  const { t, store } = await tx(name, "readwrite");
  for (const k of keys) store.delete(k);
  return done(t);
}
// Pro Schlüssel gewinnt der Eintrag mit dem späteren Zeitstempel (kein Konflikt möglich).
async function mergeLww(name, keyProp, remote, skip = () => false) {
  const local = new Map((await getAll(name)).map((e) => [e[keyProp], e]));
  const fresh = [];
  for (const [key, value] of Object.entries(remote ?? {})) {
    if (skip(value)) continue;
    const existing = local.get(key);
    if (!existing || value.ts > existing.ts) fresh.push({ ...value, [keyProp]: key });
  }
  await putAll(name, fresh);
}

// ---------- Stufen ----------
export const getAllLevels = () => getAll(S.levels);
// `best`: höchste je erreichte Stufe dieser Karte (schaltet das Schreiben frei, SPEC.md 12.9); `noRest`: keine 24-h-Sperre.
export function levelEntry(key, stufe, ts, prev, noRest = false) {
  const best = Math.max(stufe, prev?.best ?? prev?.stufe ?? 0);
  return { key, stufe, ts, best, ...(noRest ? { noRest: true } : {}) };
}
export const setLevel = (entry) => putAll(S.levels, [entry]);
export const mergeLevels = (remote, levelsResetAt) => mergeLww(S.levels, "key", remote, (v) => levelsResetAt && v.ts <= levelsResetAt);
export async function deleteLevelsUpTo(resetAt) {
  await deleteKeys(S.levels, (await getAllLevels()).filter((l) => l.ts <= resetAt).map((l) => l.key));
}

// ---------- Prios ----------
export const getAllPrios = () => getAll(S.prios);
export const setPrio = (key, prio, ts) => putAll(S.prios, [{ key, prio, ts }]);
export const mergePrios = (remote) => mergeLww(S.prios, "key", remote);

export function effectivePrio(card, priosByKey) {
  return priosByKey?.get(card.key)?.prio ?? "normal";
}
export function nextPrio(prio) {
  return prio === "hoch" ? "normal" : prio === "normal" ? "niedrig" : "hoch";
}

// ---------- Ereignisse (Tagesstatistik) ----------
export const addEvent = (event) => putAll(S.events, [event]);
export const getAllEvents = () => getAll(S.events);
export const mergeEvents = (remote, resetAt) => putAll(S.events, (remote ?? []).filter((e) => !resetAt || e.ts > resetAt));
export async function deleteEventsUpTo(resetAt) {
  await deleteKeys(S.events, (await getAllEvents()).filter((e) => e.ts <= resetAt).map((e) => e.id));
}

// ---------- Meldungen ----------
export const addFlag = (flag) => putAll(S.flags, [flag]);
export const getAllFlags = () => getAll(S.flags);
export const getOpenFlags = async () => (await getAllFlags()).filter((f) => f.status === "open");
export const mergeFlags = (remote) => mergeLww(S.flags, "id", remote);
export async function resolveOpenFlagsForWord(wordId, ts) {
  const open = (await getOpenFlags()).filter((f) => f.wordId === wordId);
  await putAll(S.flags, open.map((f) => ({ ...f, status: "resolved", ts })));
}

// ---------- Korrekturen / Löschungen ----------
export const getAllEdits = () => getAll(S.edits);
export const setEdit = (edit) => putAll(S.edits, [edit]);
export const mergeEdits = (remote) => mergeLww(S.edits, "wordId", remote);

function applyEdit(word, edit) {
  if (!edit) return word;
  // Wurde das Wort im Repo nach der In-App-Korrektur überarbeitet, gilt die Repo-Fassung.
  if (word.korrigiert && edit.ts < word.korrigiert) return word;
  const out = { ...word };
  for (const f of EDIT_FIELDS) {
    if (!(f in edit)) continue;
    if (edit[f] === null || edit[f] === "" || (Array.isArray(edit[f]) && edit[f].length === 0)) delete out[f];
    else out[f] = edit[f];
  }
  return out;
}

// Zentrale Stelle für JEDE Wortliste (Warteschlangen, Zählungen, Falschantworten):
// wendet Korrekturen an und blendet gelöschte sowie offen gemeldete Wörter aus.
export async function applyOverridesAndFilter(words) {
  const edits = new Map((await getAllEdits()).map((e) => [e.wordId, e]));
  const flagged = new Set((await getOpenFlags()).map((f) => f.wordId));
  const out = [];
  for (const w of words) {
    const edit = edits.get(w.id);
    if (edit?.deleted || flagged.has(w.id)) continue;
    out.push(applyEdit(w, edit));
  }
  return out;
}

// Für die Meldungsübersicht: ein Wort mit Korrektur, auch wenn es gerade gemeldet ist.
export async function overlayWordById(words, wordId) {
  const base = words.find((w) => w.id === wordId);
  if (!base) return null;
  const edit = (await getAllEdits()).find((e) => e.wordId === wordId);
  return applyEdit(base, edit);
}

export { getSetting };
