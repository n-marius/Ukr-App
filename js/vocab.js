// Vokabel-Logik ohne Oberfläche: Karten je Richtung, Falschantworten (rein per Skript),
// Warteschlange, gewichtete Auswahl (Automatik), automatische Prio-Regeln.
import { effectivePrio } from "./vstore.js";

export const DIRS = { "de-uk": "DE → UKR", "uk-de": "UKR → DE", mixed: "Gemischt" };
export const reverseDir = (dir) => (dir === "de-uk" ? "uk-de" : "de-uk");
export const POS_LABEL = {
  Subst: "Substantiv", Verb: "Verb", Adj: "Adjektiv", Adv: "Adverb", Pron: "Pronomen", Num: "Zahlwort",
  Präp: "Präposition", Konj: "Konjunktion", Part: "Partikel", Interj: "Interjektion", Wendung: "Wendung",
};
export const GEN_LABEL = { m: "maskulin", f: "feminin", n: "neutrum", pl: "nur Plural" };
export const ASP_LABEL = { ipf: "unvollendet", pf: "vollendet" };

const ACUTE = /́/g;
export const stripAccent = (s) => String(s ?? "").normalize("NFC").replace(ACUTE, "");
// Vergleichsform (identisch zu tools/vocab-lib.mjs norm): ohne Betonung, klein, ohne Artikel/„sich“/Klammern.
export function norm(s) {
  return stripAccent(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/^(sich|der|die|das|ein|eine|einen)\s+/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const cardKey = (wordId, dir) => `${wordId}:${dir}`;

// Jedes Wort ergibt zwei Karten (eine je Richtung). „mixed“ liefert beide Richtungen; die Reihenfolge
// wechselt zwischen den Richtungen und trennt die beiden Karten desselben Wortes weit voneinander.
// „write“ (Schreiben, nur DE → UKR) hat eigene Schlüssel `<id>:write` – Stufe/Prio unabhängig von den übrigen Karten.
export function makeCards(words, dir) {
  if (dir === "write") return words.map((word) => ({ key: cardKey(word.id, "write"), wordId: word.id, dir: "de-uk", track: "write", word }));
  const one = (d) => words.map((word) => ({ key: cardKey(word.id, d), wordId: word.id, dir: d, word }));
  if (dir !== "mixed") return one(dir);
  const a = one("de-uk");
  const b = one("uk-de");
  const shift = Math.floor(b.length / 2);
  const rot = [...b.slice(shift), ...b.slice(0, shift)];
  return a.flatMap((c, i) => [c, rot[i]]);
}

// Anzeigetexte: `question` = was gefragt wird, `answer` = richtige Antwort (Betonung bleibt sichtbar).
export const ukText = (w) => w.a || w.uk;
export const promptOf = (card) => (card.dir === "de-uk" ? card.word.de : ukText(card.word));
export const answerOf = (card) => (card.dir === "de-uk" ? ukText(card.word) : card.word.de);

// Gleicher Fragetext bei einem anderen Wort (Homonym): dann zeigt die Frage schon die Zusatzinfo,
// damit klar ist, welches Wort gemeint ist (z. B. „Schloss“ – Gebäude / Türschloss).
export function isAmbiguous(card, words) {
  const p = norm(promptOf(card));
  return words.some((w) => w.id !== card.wordId && norm(card.dir === "de-uk" ? w.de : w.uk) === p);
}

// ---------- Falsche Antworten (drei Wörter gleicher Wortart, ohne Doppeldeutigkeit) ----------

const germanSet = (w) => new Set([norm(w.de), ...(w.alt ?? []).map(norm)].filter(Boolean));

// Kandidat Y darf nicht zur Frage X passen: gleiches ukrainisches Wort (anderes Bedeutungs-Wort)
// oder eine gemeinsame deutsche Bedeutung (inkl. Synonyme in `alt`) wäre ebenfalls „richtig“.
function conflicts(x, y, xGerman) {
  if (x.id === y.id) return true;
  if (norm(x.uk) === norm(y.uk)) return true;
  for (const g of germanSet(y)) if (xGerman.has(g)) return true;
  return false;
}

export function pickDistractors(card, words, count = 3) {
  const x = card.word;
  const xGerman = germanSet(x);
  const show = (w) => norm(card.dir === "de-uk" ? w.uk : w.de);
  const used = new Set([show(x)]);
  const pool = words.filter((y) => !conflicts(x, y, xGerman) && !used.has(show(y)));

  const tiers = [
    pool.filter((y) => y.pos === x.pos && (y.gen ?? "") === (x.gen ?? "") && (y.asp ?? "") === (x.asp ?? "")),
    pool.filter((y) => y.pos === x.pos),
    pool,
  ];
  const out = [];
  for (const tier of tiers) {
    for (const y of shuffle(tier)) {
      if (out.length >= count) return out;
      const s = show(y);
      if (used.has(s)) continue; // auch untereinander keine gleichen Antwortfelder
      used.add(s);
      out.push(y);
    }
  }
  return out;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Warteschlange (manuell) ----------

export function buildQueue(cards, stufe, levelsByKey) {
  return cards
    .map((c) => ({ card: c, stufe: levelsByKey.get(c.key)?.stufe ?? 1, ts: levelsByKey.get(c.key)?.ts ?? "" }))
    .filter((e) => e.stufe === stufe)
    // Nie bearbeitete Karten (ts leer) zuerst, in Listenreihenfolge (Sortierung stabil); danach nach letztem Stufenwechsel.
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
    .map((e) => e.card);
}

export function countByStufe(cards, levelsByKey) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const c of cards) counts[levelsByKey.get(c.key)?.stufe ?? 1]++;
  return counts;
}

export function filterByPrio(cards, priosByKey, allowed) {
  if (!allowed || allowed.size >= 3) return cards;
  return cards.filter((c) => allowed.has(effectivePrio(c, priosByKey)));
}

// ---------- Automatik: gewichtete Wiederholung (Faktoren wie in der Lernapp, SPEC.md 12.4) ----------

const STUFE_WEIGHT = { 1: 81, 2: 27, 3: 9, 4: 3, 5: 0.6 };
const REST_HOURS = 24; // frisch bearbeitete Karten erscheinen nicht
export const STUFE5_DUE_DAYS = 60;
const NEVER_SEEN_BONUS = 3;
const PRIO_WEIGHT = { hoch: 1.5, normal: 1, niedrig: 0.6 };
const RECENCY_FLOOR = 0.02;
const RECENCY_TAU_HOURS = 260;
const RECENCY_SHAPE = 1.25;

function recencyWeight(hours) {
  const raw = 1 - Math.exp(-Math.pow(Math.max(hours, 0) / RECENCY_TAU_HOURS, RECENCY_SHAPE));
  return RECENCY_FLOOR + (1 - RECENCY_FLOOR) * raw;
}
const isStufe5Due = (level, now) => level?.stufe === 5 && !!level.ts && now - new Date(level.ts).getTime() >= STUFE5_DUE_DAYS * 86_400_000;

export function countDueStufe5(cards, levelsByKey) {
  const now = Date.now();
  return cards.filter((c) => isStufe5Due(levelsByKey.get(c.key), now)).length;
}

function cardWeight(card, levelsByKey, priosByKey, now) {
  const level = levelsByKey.get(card.key);
  const stufe = level?.stufe ?? 1;
  const prio = effectivePrio(card, priosByKey);
  const prioWeight = PRIO_WEIGHT[prio] ?? 1;
  if (!level?.ts) return (STUFE_WEIGHT[stufe] ?? 1) * NEVER_SEEN_BONUS * prioWeight;
  const hours = (now - new Date(level.ts).getTime()) / 3_600_000;
  // Hohe Prio in Stufe 1 ignoriert die 24-Stunden-Sperre (sonst käme ein dreimal verfehltes Wort tagelang nicht).
  // Ebenso Karten, die per blauem Knopf der Gegenrichtung nach Stufe 4 gerückt sind (`noRest`).
  if (hours < REST_HOURS && !(prio === "hoch" && stufe === 1) && !level.noRest) return 0;
  return (STUFE_WEIGHT[isStufe5Due(level, now) ? 2 : stufe] ?? 1) * recencyWeight(hours) * prioWeight;
}

// `excludeWordId`: das zuletzt gezogene Wort (gemischt: auch nicht in der Gegenrichtung direkt danach).
export function pickWeightedCard(pool, levelsByKey, priosByKey, excludeWordId) {
  const rest = pool.filter((c) => c.wordId !== excludeWordId);
  const candidates = rest.length > 0 ? rest : pool;
  const now = Date.now();
  const weights = candidates.map((c) => cardWeight(c, levelsByKey, priosByKey, now));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ---------- Automatische Prio-Regeln ----------

// Drei Fehler in Folge (dieselbe Karte, dieselbe Richtung) → Prio hoch, auch für die umgekehrte Karte.
export function trailingWrong(events, key) {
  const own = events.filter((e) => e.cardId === key).sort((a, b) => (a.ts < b.ts ? -1 : 1));
  let n = 0;
  for (let i = own.length - 1; i >= 0 && !own[i].correct; i--) n++;
  return n;
}

// ---------- Schreiben: Buchstaben ----------

// Leicht verwechselbare Buchstaben – bevorzugte Falschbuchstaben.
const CONFUSABLE = {
  и: "іїй", і: "иїй", ї: "іиє", й: "иі", е: "єи", є: "еї", г: "ґх", ґ: "г", ш: "щж", щ: "шч", ч: "щц", ц: "чс",
  ю: "уя", я: "аю", у: "юо", о: "ау", а: "оя", в: "фб", ф: "в", б: "пв", п: "бт", д: "т", т: "дп",
  з: "сж", с: "зц", ж: "шз", к: "гх", х: "кг", л: "м", м: "лн", н: "м", р: "л",
};

// iPhone-Tastatur Ukrainisch (Grundbelegung); ї liegt auf der і-Taste, ґ auf der г-Taste.
export const KB_ROWS = ["йцукенгшщзх", "фівапролджє", "ячсмитьбю"];
const KB_KEYS = new Set(KB_ROWS.join(""));
export const keyOf = (letter) => (letter === "ї" ? "і" : letter === "ґ" ? "г" : letter);

// Zerlegt die Form mit Betonung in Felder: Buchstaben (zum Antippen; Anzeige mit Betonungszeichen),
// feste Zeichen (Satzzeichen, Apostroph, Bindestrich, Zeichen ohne Taste – schon ausgefüllt) und Wortlücken.
export function writeSlots(word) {
  const a = (word.a || word.uk).normalize("NFC");
  const slots = [];
  for (const ch of a) {
    if (ch === "\u0301") { if (slots.length) slots[slots.length - 1].show += ch; continue; }
    if (ch === " ") slots.push({ kind: "gap" });
    else if (/\p{L}/u.test(ch) && KB_KEYS.has(keyOf(ch.toLowerCase()))) slots.push({ kind: "letter", letter: ch.toLowerCase(), show: ch });
    else slots.push({ kind: "fixed", show: ch });
  }
  return slots;
}

// Falsche Tasten (3–6), bevorzugt leicht verwechselbare; nie eine Taste, deren Buchstabe (oder Variante) im Wort vorkommt.
export function writeWrongKeys(slots) {
  const letters = slots.filter((s) => s.kind === "letter").map((s) => s.letter);
  const used = new Set(letters.map(keyOf));
  const want = Math.min(6, Math.max(3, Math.round(letters.length / 3)));
  const wrong = new Set();
  const ok = (x) => KB_KEYS.has(keyOf(x)) && !used.has(keyOf(x));
  for (const c of shuffle([...new Set(letters)])) for (const x of CONFUSABLE[c] ?? "") if (ok(x) && wrong.size < Math.ceil(want / 2)) wrong.add(keyOf(x));
  for (const x of shuffle([...KB_KEYS])) { if (wrong.size >= want) break; if (ok(x)) wrong.add(x); }
  return wrong;
}
