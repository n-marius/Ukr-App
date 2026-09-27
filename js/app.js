import { createReader } from "./reader.js";
import { renderQuiz } from "./quiz.js";
import { renderStats, formatDuration } from "./stats.js";
import { addAttempt, getAllAttempts, hasAttempt, detectDevice, exportData, importData } from "./store.js";
import { getSyncConfig, setSyncConfig, sync, resetAllStats } from "./sync.js";
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
};

const root = document.getElementById("app");
let index = null;
let current = null; // Name des aktiven Screens

// ---------- Rahmen ----------

function render(name, { left = "", right = "", body = "", dock = "" }) {
  current = name;
  root.innerHTML = `
    <header class="bar"><div class="bar-inner">
      <div class="bar-side">${left}</div>
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
const backButton = `<button class="icon-btn" id="back" aria-label="Zurück">${ICON.back}</button>`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- Start ----------

async function showHome() {
  const done = new Set((await getAllAttempts()).map((a) => a.textId));

  const levelRows = LEVELS.map((level) => {
    const texts = index.texts.filter((t) => t.level === level);
    const open = texts.filter((t) => !done.has(t.id)).length;
    if (texts.length === 0) {
      return `
        <button class="row" disabled>
          <span class="row-lead">${level}</span>
          <span class="row-main"><span class="row-title">${LEVEL_NAMES[level]}</span><span class="row-sub">Noch keine Texte</span></span>
        </button>`;
    }
    return `
      <button class="row" data-level="${level}">
        <span class="row-lead">${level}</span>
        <span class="row-main"><span class="row-title">${LEVEL_NAMES[level]}</span><span class="row-sub">${plural(texts.length, "Text", "Texte")}</span></span>
        <span class="row-trail${open ? " is-strong" : ""}">${open ? `${open} offen` : "Alle gelesen"}</span>
        ${ICON.chevron}
      </button>`;
  }).join("");

  render("home", {
    right: `
      <button class="icon-btn" id="to-stats" aria-label="Statistik">${ICON.stats}</button>
      <button class="icon-btn" id="to-settings" aria-label="Einstellungen">${ICON.settings}</button>`,
    body: `
      <header class="page-head">
        <p class="eyebrow">Lesetraining</p>
        <h1 class="page-title" lang="uk">Українська</h1>
      </header>
      <h2 class="label">Stufe</h2>
      <div class="group">${levelRows}</div>
      <h2 class="label">Weitere Übungen</h2>
      <div class="group">
        <button class="row" disabled>
          <span class="row-main"><span class="row-title">Frage-Antwort</span><span class="row-sub">In Vorbereitung</span></span>
        </button>
      </div>`,
  });

  on("#to-stats", "click", () => showStats());
  on("#to-settings", "click", showSettings);
  root.querySelectorAll("[data-level]").forEach((b) => b.addEventListener("click", () => showTopics(b.dataset.level)));
}

// ---------- Themen ----------

async function showTopics(level, showDone = false) {
  const done = new Set((await getAllAttempts()).map((a) => a.textId));
  const texts = index.texts.filter((t) => t.level === level);
  const pool = texts.filter((t) => done.has(t.id) === showDone);

  const tagCounts = new Map();
  for (const t of pool) for (const tag of t.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

  const chips = [...tagCounts]
    .map(([tag, n]) => `<button class="chip" data-tag="${escapeHtml(tag)}"><span lang="uk">${escapeHtml(tag)}</span><span class="chip-count">${n}</span></button>`)
    .join("");

  const empty = showDone
    ? `<div class="empty"><p class="empty-title">Noch nichts bearbeitet</p><p class="empty-sub">Bearbeitete Texte erscheinen hier und können wiederholt werden.</p></div>`
    : `<div class="empty"><p class="empty-title">Alles gelesen</p><p class="empty-sub">Alle Texte dieser Stufe sind bearbeitet. Neue Texte folgen.</p></div>`;

  render("topics", {
    left: backButton,
    body: `
      <header class="page-head">
        <p class="eyebrow">Stufe ${level}</p>
        <h1 class="page-title">${LEVEL_NAMES[level]}</h1>
        <p class="page-sub">${plural(texts.length, "Text", "Texte")} · ${texts.filter((t) => done.has(t.id)).length} bearbeitet</p>
      </header>
      <div class="seg" role="tablist">
        <button role="tab" data-done="0" class="${showDone ? "" : "is-active"}">Offen</button>
        <button role="tab" data-done="1" class="${showDone ? "is-active" : ""}">Bereits bearbeitet</button>
      </div>
      <h2 class="label" style="margin-top:32px">Themen</h2>
      ${chips ? `<div class="chips">${chips}</div>` : empty}`,
  });

  on("#back", "click", showHome);
  root.querySelectorAll("[data-done]").forEach((b) =>
    b.addEventListener("click", () => showTopics(level, b.dataset.done === "1"))
  );
  root.querySelectorAll(".chip").forEach((b) =>
    b.addEventListener("click", () => {
      const next = pool.filter((t) => t.tags.includes(b.dataset.tag)).sort((a, c) => a.id.localeCompare(c.id))[0];
      if (next) showReader(next);
    })
  );
}

// ---------- Lesen ----------

async function showReader(entry) {
  const text = await (await fetch(`content/${entry.file}`)).json();
  const firstTime = (await getAllAttempts()).length === 0;
  const words = text.paragraphs.reduce((n, p) => n + p.filter((t) => !("p" in t)).length, 0);

  render("reader", {
    left: `<span class="bar-eyebrow">${entry.level} · <span lang="uk">${escapeHtml(entry.tags[0] ?? "")}</span></span>`,
    right: `<button class="pill-btn" id="pause">${ICON.pause}<span>Pause</span></button>`,
    body: `
      <div id="reading">
        <header class="reader-head">
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
    showQuiz(entry, text, meta);
  });
}

// ---------- Kontrolle ----------

function showQuiz(entry, text, meta) {
  const total = text.questions.length;
  render("quiz", {
    left: `<span class="bar-eyebrow">${entry.level} · <span lang="uk">${escapeHtml(entry.tags[0] ?? "")}</span></span>`,
    body: `
      <header class="page-head">
        <p class="eyebrow" lang="uk">${escapeHtml(text.title)}</p>
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
  render("result", {
    body: `
      <div class="result">
        <p class="eyebrow" lang="uk">${escapeHtml(entry.title)}</p>
        <p class="score">${m.correct}<small>/ ${m.total}</small></p>
        <p class="score-caption">${m.correct === m.total ? "Alles richtig." : "richtig beantwortet"}</p>
        <div class="group">
          <div class="row kv"><span class="row-main"><span class="row-title">Lesezeit</span></span><span class="row-trail">${formatDuration(m.sec)}</span></div>
          <div class="row kv"><span class="row-main"><span class="row-title">Tempo</span></span><span class="row-trail">${pace} s / 100 Wörter</span></div>
          <div class="row kv"><span class="row-main"><span class="row-title">Nachgeschlagen</span></span><span class="row-trail">${plural(m.clicks, "Wort", "Wörter")}</span></div>
        </div>
        ${m.isFirstAttempt ? "" : `<p class="note">Wiederholung – fließt nicht in die Statistik ein.</p>`}
        <button class="btn btn-primary" id="done">Fertig</button>
      </div>`,
  });
  on("#done", "click", showHome);
}

// ---------- Statistik ----------

async function showStats(level) {
  const attempts = await getAllAttempts();
  level ??= LEVELS.find((l) => attempts.some((a) => a.level === l)) ?? "A1";

  render("stats", {
    left: backButton,
    body: `
      <header class="page-head"><h1 class="page-title">Statistik</h1></header>
      <div class="seg levels">${LEVELS.map((l) => `<button data-level="${l}" class="${l === level ? "is-active" : ""}">${l}</button>`).join("")}</div>
      <div id="stats"></div>`,
  });
  on("#back", "click", showHome);
  root.querySelectorAll(".levels [data-level]").forEach((b) => b.addEventListener("click", () => showStats(b.dataset.level)));
  renderStats($("#stats"), attempts, level);
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
  el.className = "toast";
  el.setAttribute("role", "status");
  el.innerHTML = `<span>${escapeHtml(message)}</span>${action ? `<button>${escapeHtml(action.label)}</button>` : ""}`;
  document.body.appendChild(el);
  if (action) el.querySelector("button").addEventListener("click", action.run);
  else setTimeout(() => el.remove(), 2600);
}

// ---------- Start ----------

async function init() {
  index = await (await fetch("content/index.json")).json();
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
