import { createReader } from "./reader.js";
import { renderQuiz } from "./quiz.js";
import { renderChat } from "./chat.js";
import { renderStats, renderVocabStats, formatDuration } from "./stats.js";
import { setupVocab } from "./vapp.js";
import { getAllEvents as getAllVocabEvents } from "./vstore.js";
import { addAttempt, getAllAttempts, hasAttempt, detectDevice, exportData, importData, getAllChatStartCounts, bumpChatStartCount } from "./store.js";
import { getSyncConfig, setSyncConfig, sync, resetAllStats, resetVocabStats, resetVocabLevels } from "./sync.js";
import { escapeHtml } from "./tokens.js";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_NAMES = {
  A1: "Anfänger",
  A2: "Grundkenntnisse",
  B1: "Mittelstufe",
  B2: "Gute Mittelstufe",
  C1: "Fortgeschritten",
  C2: "Nahezu muttersprachlich",
};

const svg = (d, extra = "") =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  back: svg(`<path d="M15 5l-7 7 7 7"/>`),
  chevron: svg(`<path d="M9 5l7 7-7 7"/>`, `class="row-chev"`),
  stats: svg(`<path d="M5 20V11M12 20V4M19 20v-6"/>`),
  settings: svg(`<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`),
  pause: svg(`<path d="M9 6v12M15 6v12"/>`, `stroke-width="2.2"`),
  play: svg(`<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>`),
  arrow: svg(`<path d="M5 12h14M13 6l6 6-6 6"/>`, `class="mode-go"`),
  text: svg(`<path d="M5 4.5h9.5L19 9v10.5H5z"/><path d="M14.5 4.5V9H19M8.5 13h7M8.5 16.5h5"/>`),
  dialog: svg(`<path d="M4 5.5h11v8H8.5L5 16.5v-3H4z"/><path d="M15 9h5v8h-1v2.5L16 17h-4.5v-3.5"/>`),
  exit: svg(`<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M14 16l4-4-4-4M18 12H8"/>`),
  cards: svg(`<rect x="6.5" y="7" width="14" height="10" rx="1.5"/><path d="M3.5 5v10a1.5 1.5 0 0 0 1.5 1.5"/><path d="M10.5 12h6M10.5 14.5h4"/>`),
  quiz: svg(`<circle cx="12" cy="12" r="9"/><path d="M9.2 9.5a2.8 2.8 0 1 1 3.6 2.7c-.8.3-1.1.8-1.1 1.5"/><circle cx="12" cy="16.6" r="0.4" fill="currentColor"/>`),
  hand: svg(`<path d="M6 4h6M6 8h9M6 12h7"/><circle cx="18" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="4"/>`),
  auto: svg(`<path d="M12 4v3M12 17v3M4 12h3M17 12h3"/><circle cx="12" cy="12" r="4.5"/>`),
  flag: svg(`<path d="M6 21V4"/><path d="M6 4.5c1.4-1 3-1 4.5 0s3.1 1 4.5 0v9c-1.4 1-3 1-4.5 0s-3.1-1-4.5 0"/>`),
  download: svg(`<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>`),
  up: svg(`<path d="M7 12l5-5 5 5M7 17.5l5-5 5 5"/>`),
  clock: svg(`<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`, `class="row-clock"`),
};

const root = document.getElementById("app");
let index = null;
let chatIndex = null;
let vocab = null; // Vokabelfunktion (js/vapp.js)
let vocabCount = 0;
let current = null; // Name des aktiven Screens

// ---------- Rahmen ----------

function render(name, { left = "", mid = "", right = "", body = "", dock = "" }) {
  current = name;
  root.innerHTML = `
    <header class="bar"><div class="bar-inner">
      <div class="bar-side">${left}</div>
      ${mid ? `<div class="bar-mid">${mid}</div>` : ""}
      <div class="bar-side">${right}</div>
    </div></header>
    <main class="screen${dock ? " has-dock" : ""}">${body}</main>
    ${dock ? `<footer class="dock"><div class="dock-inner">${dock}</div></footer>` : ""}`;
  window.scrollTo(0, 0);
  updateBarBorder();
  return root;
}

function updateBarBorder() {
  root.querySelector(".bar")?.classList.toggle("is-scrolled", window.scrollY > 4);
}
window.addEventListener("scroll", updateBarBorder, { passive: true });

const $ = (sel) => root.querySelector(sel);
const on = (sel, ev, fn) => $(sel)?.addEventListener(ev, fn);
const backButtonFor = (label = "Zurück") => `<button class="icon-btn" id="back" aria-label="${label}">${ICON.back}</button>`;
const backButton = backButtonFor();
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- Start: Funktionswahl ----------

async function showHome() {
  vocabCount = await vocab.count();
  const done = new Set((await getAllAttempts()).map((a) => a.textId));
  const total = index.texts.length;
  const open = index.texts.filter((t) => !done.has(t.id)).length;
  const totalChats = chatIndex.chats.length;

  render("home", {
    right: `
      <button class="icon-btn" id="to-stats" aria-label="Statistik">${ICON.stats}</button>
      <button class="icon-btn" id="to-settings" aria-label="Einstellungen">${ICON.settings}</button>`,
    body: `
      <header class="page-head">
        <p class="kicker">Lesetraining</p>
        <h1 class="page-title" lang="uk">Українська</h1>
      </header>
      <div class="modes">
        <button class="mode" id="mode-text" ${total ? "" : "disabled"}>
          <span class="mode-icon">${ICON.text}</span>
          ${total ? ICON.arrow : `<span class="badge">Noch keine Texte</span>`}
          <span class="mode-title">Text</span>
          <span class="mode-text">${total ? `${plural(total, "Text", "Texte")} · ${open} offen` : "Lesen mit Wortinfos und Kontrolle"}</span>
        </button>
        <button class="mode" id="mode-chat" ${totalChats ? "" : "disabled"}>
          <span class="mode-icon">${ICON.dialog}</span>
          ${totalChats ? ICON.arrow : `<span class="badge">Noch keine Chats</span>`}
          <span class="mode-title">Frage-Antwort</span>
          <span class="mode-text">${totalChats ? plural(totalChats, "Gespräch", "Gespräche") : "Gespräche führen und verstehen"}</span>
        </button>
        <button class="mode" id="mode-vocab" ${vocabCount ? "" : "disabled"}>
          <span class="mode-icon">${ICON.cards}</span>
          ${vocabCount ? ICON.arrow : `<span class="badge">Noch keine Vokabeln</span>`}
          <span class="mode-title">Vokabeln</span>
          <span class="mode-text">${vocabCount ? plural(vocabCount, "Vokabel", "Vokabeln") : "Wortschatz gezielt üben"}</span>
        </button>
      </div>`,
  });

  on("#to-stats", "click", () => showStats());
  on("#to-settings", "click", showSettings);
  on("#mode-text", "click", showLevels);
  on("#mode-chat", "click", showChatLevels);
  on("#mode-vocab", "click", () => vocab.showTypes());
}

// ---------- Stufe ----------

async function showLevels() {
  await sync();
  const done = new Set((await getAllAttempts()).map((a) => a.textId));

  const rows = LEVELS.map((level) => {
    const texts = index.texts.filter((t) => t.level === level);
    const open = texts.filter((t) => !done.has(t.id)).length;
    const available = texts.length > 0;
    return `
      <button class="row" data-level="${level}" ${available ? "" : "disabled"}>
        <span class="row-lead">${level}</span>
        <span class="row-main">
          <span class="row-title">${LEVEL_NAMES[level]}</span>
          <span class="row-sub">${available ? `${plural(texts.length, "Text", "Texte")} · ${open ? `${open} offen` : "alle bearbeitet"}` : "Noch keine Texte"}</span>
        </span>
        ${available ? ICON.chevron : ""}
      </button>`;
  }).join("");

  render("levels", {
    left: backButton,
    body: `
      <header class="page-head">
        <p class="kicker">Text</p>
        <h1 class="page-title">Stufe wählen</h1>
      </header>
      <div class="group">${rows}</div>`,
  });

  on("#back", "click", showHome);
  root.querySelectorAll("[data-level]:not(:disabled)").forEach((b) => b.addEventListener("click", () => showTopics(b.dataset.level)));
}

// ---------- Thema ----------

async function showTopics(level, showDone = false) {
  const done = new Set((await getAllAttempts()).map((a) => a.textId));
  const texts = index.texts.filter((t) => t.level === level);
  const doneCount = texts.filter((t) => done.has(t.id)).length;
  const pool = texts.filter((t) => done.has(t.id) === showDone);

  const tagCounts = new Map();
  for (const t of pool) for (const tag of t.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

  const chips = [...tagCounts]
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([tag, n]) => `<button class="chip" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}<span class="chip-count">${n}</span></button>`)
    .join("");

  const empty = showDone
    ? `<div class="empty"><p class="empty-title">Noch nichts bearbeitet</p><p class="empty-sub">Bearbeitete Texte erscheinen hier und können wiederholt werden.</p></div>`
    : `<div class="empty"><p class="empty-title">Alles gelesen</p><p class="empty-sub">Alle Texte dieser Stufe sind bearbeitet. Neue Texte folgen.</p></div>`;

  render("topics", {
    left: backButton,
    body: `
      <header class="page-head">
        <p class="kicker">Text · <b>${level}</b> ${LEVEL_NAMES[level]}</p>
        <h1 class="page-title">Thema wählen</h1>
        <p class="page-sub">${plural(texts.length, "Text", "Texte")} · ${doneCount} bearbeitet</p>
      </header>
      <div class="seg" role="tablist">
        <button role="tab" data-done="0" class="${showDone ? "" : "is-active"}">Offen</button>
        <button role="tab" data-done="1" class="${showDone ? "is-active" : ""}">Bereits bearbeitet</button>
      </div>
      <h2 class="label">Themen</h2>
      ${chips ? `<div class="chips">${chips}</div>` : empty}`,
  });

  on("#back", "click", showLevels);
  root.querySelectorAll("[data-done]").forEach((b) =>
    b.addEventListener("click", () => showTopics(level, b.dataset.done === "1"))
  );
  root.querySelectorAll(".chip").forEach((b) =>
    b.addEventListener("click", () => {
      const next = pool.filter((t) => t.tags.includes(b.dataset.tag)).sort((a, c) => a.id.localeCompare(c.id))[0];
      if (next) showReader(next, b.dataset.tag);
    })
  );
}

// ---------- Frage-Antwort: Stufe ----------

async function showChatLevels() {
  await sync();
  const rows = LEVELS.map((level) => {
    const chats = chatIndex.chats.filter((c) => c.level === level);
    const available = chats.length > 0;
    return `
      <button class="row" data-level="${level}" ${available ? "" : "disabled"}>
        <span class="row-lead">${level}</span>
        <span class="row-main">
          <span class="row-title">${LEVEL_NAMES[level]}</span>
          <span class="row-sub">${available ? plural(chats.length, "Gespräch", "Gespräche") : "Noch keine Chats"}</span>
        </span>
        ${available ? ICON.chevron : ""}
      </button>`;
  }).join("");

  render("chat-levels", {
    left: backButton,
    body: `
      <header class="page-head">
        <p class="kicker">Frage-Antwort</p>
        <h1 class="page-title">Stufe wählen</h1>
      </header>
      <div class="group">${rows}</div>`,
  });

  on("#back", "click", showHome);
  root.querySelectorAll("[data-level]:not(:disabled)").forEach((b) => b.addEventListener("click", () => showChatTopics(b.dataset.level)));
}

// ---------- Frage-Antwort: Thema ----------

async function showChatTopics(level) {
  const chats = chatIndex.chats.filter((c) => c.level === level);

  const tagCounts = new Map();
  for (const c of chats) for (const tag of c.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

  const chips = [...tagCounts]
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([tag, n]) => `<button class="chip" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}<span class="chip-count">${n}</span></button>`)
    .join("");

  render("chat-topics", {
    left: backButton,
    body: `
      <header class="page-head">
        <p class="kicker">Frage-Antwort · <b>${level}</b> ${LEVEL_NAMES[level]}</p>
        <h1 class="page-title">Thema wählen</h1>
        <p class="page-sub">${plural(chats.length, "Gespräch", "Gespräche")}</p>
      </header>
      <h2 class="label">Themen</h2>
      <div class="chips">${chips}</div>`,
  });

  on("#back", "click", showChatLevels);
  root.querySelectorAll(".chip").forEach((b) =>
    b.addEventListener("click", () => showChatList(level, b.dataset.tag))
  );
}

// ---------- Frage-Antwort: Chat wählen ----------

async function showChatList(level, tag) {
  const chats = chatIndex.chats
    .filter((c) => c.level === level && c.tags.includes(tag))
    .sort((a, b) => a.id.localeCompare(b.id));
  const counts = await getAllChatStartCounts();

  const rows = chats.map((c) => {
    const n = counts[c.id] ?? 0;
    return `
      <button class="row" data-id="${c.id}">
        <span class="row-main">
          <span class="row-title" lang="uk">${escapeHtml(c.title)}</span>
          <span class="row-sub">${escapeHtml(c.titleDe)}</span>
        </span>
        <span class="row-trail">${n > 0 ? `${n}×` : ""}</span>
        ${ICON.chevron}
      </button>`;
  }).join("");

  render("chat-list", {
    left: backButton,
    body: `
      <header class="page-head">
        <p class="kicker">Frage-Antwort · <b>${level}</b> · ${escapeHtml(tag)}</p>
        <h1 class="page-title">Gespräch wählen</h1>
      </header>
      <div class="group">${rows}</div>`,
  });

  on("#back", "click", () => showChatTopics(level));
  root.querySelectorAll("[data-id]").forEach((b) =>
    b.addEventListener("click", () => showChatRoom(chats.find((c) => c.id === b.dataset.id), level, tag))
  );
}

// ---------- Frage-Antwort: Gespräch ----------

async function showChatRoom(entry, level, tag) {
  const chat = await (await fetch(`content/chat/${entry.file}`)).json();
  bumpChatStartCount(entry.id);

  render("chat-room", {
    left: `<button class="pill-btn" id="leave">${ICON.exit}<span>Verlassen</span></button>`,
    right: `<span class="bar-crumb"><b>${level}</b> · ${escapeHtml(tag)}</span>`,
    body: `
      <header class="page-head">
        <p class="kicker" lang="uk">${escapeHtml(chat.title)}</p>
        <h1 class="page-title">${escapeHtml(chat.titleDe)}</h1>
      </header>
      <div id="chat"></div>`,
  });

  on("#leave", "click", () => showChatList(level, tag));
  renderChat($("#chat"), chat, { onEnd: () => sync() });
}

// ---------- Lesen ----------

const crumb = (entry, tag) =>
  `<span class="bar-crumb"><b>${entry.level}</b> · ${escapeHtml(tag ?? entry.tags[0] ?? "")}</span>`;

async function showReader(entry, tag) {
  const text = await (await fetch(`content/${entry.file}`)).json();
  const firstTime = (await getAllAttempts()).length === 0;
  const words = text.paragraphs.reduce((n, p) => n + p.filter((t) => !("p" in t)).length, 0);

  render("reader", {
    left: crumb(entry, tag),
    right: `<button class="pill-btn" id="pause">${ICON.pause}<span>Pause</span></button>`,
    body: `
      <div id="reading">
        <header class="reader-head">
          <p class="kicker">${escapeHtml(entry.titleDe)}</p>
          <h1 class="reader-title" lang="uk">${escapeHtml(text.title)}</h1>
          <p class="reader-meta">${words} Wörter${firstTime ? " · Wort antippen für Bedeutung und Grammatik" : ""}</p>
        </header>
        <div id="text"></div>
      </div>
      <div id="paused" class="paused" hidden>
        <div class="paused-mark"><span></span><span></span></div>
        <p class="paused-title">Pausiert</p>
        <p class="paused-sub">Der Text ist ausgeblendet, die Zeit steht.</p>
        <button class="btn btn-primary btn-auto" id="resume">${ICON.play}Weiterlesen</button>
      </div>`,
    dock: `<button class="btn btn-primary" id="to-quiz">Zur Kontrolle</button>`,
  });

  const reader = createReader($("#text"), text, { onAutoPause: () => setPaused(true) });

  function setPaused(paused) {
    if (paused) reader.pause();
    else reader.resume();
    $("#reading").hidden = paused;
    $("#paused").hidden = !paused;
    $(".dock").hidden = paused;
    $("#pause").hidden = paused;
    window.scrollTo(0, 0);
  }

  on("#pause", "click", () => setPaused(!reader.paused));
  on("#resume", "click", () => setPaused(false));
  on("#to-quiz", "click", async () => {
    const meta = { sec: reader.elapsedSec(), clicks: reader.clickCount(), words: reader.wordCount() };
    reader.stop();
    meta.isFirstAttempt = !(await hasAttempt(entry.id));
    showQuiz(entry, text, meta, tag);
  });
}

// ---------- Kontrolle ----------

function showQuiz(entry, text, meta, tag) {
  const total = text.questions.length;
  render("quiz", {
    left: crumb(entry, tag),
    body: `
      <header class="page-head">
        <p class="kicker">${escapeHtml(entry.titleDe)}</p>
        <h1 class="page-title">Kontrolle</h1>
        <p class="page-sub">${total} Fragen zum Text. Die erste Auswahl zählt.</p>
      </header>
      <div id="questions"></div>`,
    dock: `
      <div class="dock-status">
        <span class="dock-text" id="progress">0 von ${total} beantwortet</span>
        <span class="dots">${"<i></i>".repeat(total)}</span>
      </div>
      <button class="btn btn-primary btn-auto" id="finish" disabled>Auswertung</button>`,
  });

  const quiz = renderQuiz($("#questions"), text, {
    onProgress(answered) {
      $("#progress").textContent = `${answered} von ${total} beantwortet`;
      root.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("is-on", i < answered));
      $("#finish").disabled = answered < total;
    },
  });

  on("#finish", "click", async () => {
    const { correct } = quiz.result();
    if (meta.isFirstAttempt) {
      await addAttempt({
        id: crypto.randomUUID(),
        textId: entry.id,
        level: entry.level,
        ts: new Date().toISOString(),
        sec: meta.sec,
        words: meta.words,
        clicks: meta.clicks,
        correct,
        device: detectDevice(),
      });
      sync();
    }
    showResult(entry, { ...meta, correct, total });
  });
}

// ---------- Auswertung ----------

function showResult(entry, m) {
  const pace = Math.round((m.sec / Math.max(m.words, 1)) * 100);
  const wpm = m.sec > 0 ? Math.round((m.words / m.sec) * 60) : 0;
  render("result", {
    body: `
      <div class="result">
        <p class="kicker">${escapeHtml(entry.titleDe)}</p>
        <p class="score">${m.correct}<small>/ ${m.total}</small></p>
        <p class="score-caption">${m.correct === m.total ? "Alles richtig." : "richtig beantwortet"}</p>
        <div class="group">
          <div class="row kv"><span class="row-main"><span class="row-title">Lesezeit</span></span><span class="row-trail">${formatDuration(m.sec)}</span></div>
          <div class="row kv"><span class="row-main"><span class="row-title">Tempo</span></span><span class="row-trail">${wpm} Wörter / min</span></div>
          <div class="row kv"><span class="row-main"><span class="row-title">Pace</span></span><span class="row-trail">${pace} s / 100 Wörter</span></div>
          <div class="row kv"><span class="row-main"><span class="row-title">Nachgeschlagen</span></span><span class="row-trail">${plural(m.clicks, "Wort", "Wörter")}</span></div>
        </div>
        ${m.isFirstAttempt ? "" : `<p class="note">Wiederholung – fließt nicht in die Statistik ein.</p>`}
        <button class="btn btn-primary" id="done">Fertig</button>
      </div>`,
  });
  on("#done", "click", showHome);
}

// ---------- Statistik ----------

async function showStats(tab = "texte", level) {
  const tabs = `<div class="seg stats-tabs">
      <button data-tab="texte" class="${tab === "texte" ? "is-active" : ""}">Texte</button>
      <button data-tab="vokabeln" class="${tab === "vokabeln" ? "is-active" : ""}">Vokabeln</button>
    </div>`;

  if (tab === "vokabeln") {
    render("stats", {
      left: backButton,
      body: `<header class="page-head"><h1 class="page-title">Statistik</h1></header>${tabs}<div id="stats"></div>`,
    });
    renderVocabStats($("#stats"), await getAllVocabEvents());
  } else {
    const attempts = await getAllAttempts();
    level ??= LEVELS.find((l) => attempts.some((a) => a.level === l)) ?? "A1";
    render("stats", {
      left: backButton,
      body: `
        <header class="page-head"><h1 class="page-title">Statistik</h1></header>
        ${tabs}
        <div class="seg levels">${LEVELS.map((l) => `<button data-level="${l}" class="${l === level ? "is-active" : ""}">${l}</button>`).join("")}</div>
        <div id="stats"></div>`,
    });
    root.querySelectorAll(".levels [data-level]").forEach((b) => b.addEventListener("click", () => showStats("texte", b.dataset.level)));
    renderStats($("#stats"), attempts, level);
  }
  on("#back", "click", showHome);
  root.querySelectorAll(".stats-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => showStats(b.dataset.tab)));
}

// ---------- Einstellungen ----------

async function showSettings() {
  const cfg = await getSyncConfig();
  const status = !cfg.token
    ? `<span class="status-dot"></span><span class="status-text">Nicht eingerichtet</span>`
    : cfg.lastError
      ? `<span class="status-dot is-error"></span><span class="status-text error-text">${escapeHtml(cfg.lastError)}</span>`
      : cfg.lastSync
        ? `<span class="status-dot is-ok"></span><span class="status-text">Synchronisiert <strong>${formatWhen(cfg.lastSync)}</strong></span>`
        : `<span class="status-dot"></span><span class="status-text">Noch nicht synchronisiert</span>`;

  render("settings", {
    left: backButton,
    body: `
      <header class="page-head"><h1 class="page-title">Einstellungen</h1></header>

      <h2 class="label">Synchronisierung</h2>
      <div class="group">
        <div class="status">${status}</div>
        <label class="field">
          <span class="field-label">GitHub-Token</span>
          <input id="token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…" value="${escapeHtml(cfg.token)}">
        </label>
        <label class="field">
          <span class="field-label">Gist-ID</span>
          <input id="gist" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Wird beim ersten Sync angelegt" value="${escapeHtml(cfg.gistId)}">
        </label>
      </div>
      <p class="help">Auf dem ersten Gerät nur den Token eintragen – die Gist-ID entsteht automatisch. Auf jedem weiteren Gerät denselben Token und diese Gist-ID eintragen.</p>
      <div class="settings-actions"><button class="btn btn-secondary" id="save">Speichern und synchronisieren</button></div>

      <h2 class="label">Daten</h2>
      <div class="group">
        <button class="row" id="export"><span class="row-main"><span class="row-title">Exportieren</span><span class="row-sub">Alle Ergebnisse als JSON-Datei</span></span>${ICON.chevron}</button>
        <label class="row file-row"><span class="row-main"><span class="row-title">Importieren</span><span class="row-sub">JSON-Datei hinzufügen</span></span>${ICON.chevron}<input id="import" type="file" accept="application/json,.json"></label>
        <button class="row row-danger" id="reset"><span class="row-main"><span class="row-title">Statistik zurücksetzen</span></span></button>
      </div>

      <h2 class="label">Vokabeln</h2>
      <div class="group">
        <button class="row row-danger" id="reset-vocab-levels"><span class="row-main"><span class="row-title">Alle Vokabeln auf Stufe 1 zurücksetzen</span><span class="row-sub">Prioritäten bleiben erhalten</span></span></button>
        <button class="row row-danger" id="reset-vocab-stats"><span class="row-main"><span class="row-title">Vokabel-Statistik löschen</span></span></button>
      </div>`,
  });

  on("#back", "click", showHome);
  on("#save", "click", async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = "Synchronisiere …";
    await setSyncConfig({ token: $("#token").value.trim(), gistId: $("#gist").value.trim() });
    await sync();
    showSettings();
  });
  on("#export", "click", exportStats);
  on("#import", "change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const n = await importData(await file.text());
      await sync();
      toast(`${plural(n, "Ergebnis", "Ergebnisse")} importiert`);
    } catch {
      toast("Datei konnte nicht gelesen werden");
    }
    showSettings();
  });
  on("#reset-vocab-levels", "click", () =>
    confirmDialog({
      title: "Vokabeln zurücksetzen?",
      text: "Alle Vokabeln in beiden Richtungen stehen danach wieder in Stufe 1 – auch auf synchronisierten Geräten. Prioritäten bleiben erhalten.",
      onYes: async () => { await resetVocabLevels(); toast("Vokabeln zurückgesetzt"); },
    })
  );
  on("#reset-vocab-stats", "click", () =>
    confirmDialog({
      title: "Vokabel-Statistik löschen?",
      text: "Die Tagesstatistik der Vokabeln wird gelöscht – auch auf synchronisierten Geräten. Die Stufen bleiben erhalten.",
      onYes: async () => { await resetVocabStats(); toast("Vokabel-Statistik gelöscht"); },
    })
  );
  on("#reset", "click", () =>
    confirmDialog({
      title: "Statistik zurücksetzen?",
      text: "Alle Ergebnisse werden gelöscht – auch auf synchronisierten Geräten. Alle Texte gelten danach wieder als unbearbeitet.",
      onYes: async () => {
        await resetAllStats();
        toast("Statistik zurückgesetzt");
        showSettings();
      },
    })
  );
}

async function exportStats() {
  const json = await exportData();
  const name = `ukr-app-statistik-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch { /* vom Nutzer abgebrochen */ }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function formatWhen(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const today = new Date().toDateString() === d.toDateString();
  return today ? `heute, ${time}` : `${d.toLocaleDateString("de-DE", { day: "numeric", month: "long" })}, ${time}`;
}

// ---------- Dialog & Hinweis ----------

function confirmDialog({ title, text, onYes }) {
  const el = document.createElement("div");
  el.className = "backdrop";
  el.innerHTML = `
    <div class="dialog" role="alertdialog" aria-modal="true">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      <div class="dialog-actions">
        <button class="btn btn-secondary" data-answer="no">Nein</button>
        <button class="btn btn-danger" data-answer="yes">Ja</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('[data-answer="no"]').focus();
  const close = () => el.remove();
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  el.querySelector('[data-answer="no"]').addEventListener("click", close);
  el.querySelector('[data-answer="yes"]').addEventListener("click", async () => {
    close();
    await onYes();
  });
}

function toast(message, action) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = action ? "toast has-action" : "toast";
  el.setAttribute("role", "status");
  el.innerHTML = `<span>${escapeHtml(message)}</span>${action ? `<button>${escapeHtml(action.label)}</button>` : ""}`;
  document.body.appendChild(el);
  if (action) el.querySelector("button").addEventListener("click", action.run);
  else setTimeout(() => el.remove(), 2600);
}

// ---------- Start ----------

async function init() {
  let vocabIndex;
  [index, chatIndex, vocabIndex] = await Promise.all([
    fetch("content/index.json").then((r) => r.json()),
    fetch("content/chat/index.json").then((r) => r.json()),
    fetch("content/vokabeln/index.json").then((r) => r.json()).catch(() => ({ words: [] })),
  ]);
  vocab = setupVocab({ render, root, ICON, backButton: backButtonFor, plural, toast, confirmDialog, showHome, allWords: vocabIndex.words });
  vocabCount = await vocab.count();
  await showHome();

  const refreshHome = (res) => { if (res?.changed && current === "home") showHome(); };
  sync().then(refreshHome);
  window.addEventListener("online", () => sync().then(refreshHome));

  if ("serviceWorker" in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register("sw.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      toast("Neue Version verfügbar", { label: "Neu laden", run: () => location.reload() });
    });
  }
}

init();
