import { renderReader } from "./reader.js";
import { renderQuiz } from "./quiz.js";
import { renderStats } from "./stats.js";
import { addAttempt, getAllAttempts, hasAttempt, getSetting, setSetting, detectDevice, exportData, importData, clearAttempts } from "./store.js";
import { getSyncConfig, setSyncConfig, sync, resetRemote } from "./sync.js";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const root = document.getElementById("app");
let index = null;
let currentReader = null;

async function loadIndex() {
  const res = await fetch("content/index.json");
  index = await res.json();
}

function screen(html) {
  root.innerHTML = html;
}

async function showHome() {
  currentReader?.stop();
  screen(`
    <header class="topbar">
      <h1>Українська</h1>
      <button id="btn-stats" class="icon-btn" aria-label="Statistik">📊</button>
      <button id="btn-settings" class="icon-btn" aria-label="Einstellungen">⚙️</button>
    </header>
    <main>
      <h2>Stufe wählen</h2>
      <div class="level-grid">
        ${LEVELS.map((l) => `<button class="level-btn" data-level="${l}">${l}</button>`).join("")}
      </div>
      <button class="menu-btn" disabled title="Noch nicht umgesetzt">Frage-Antwort</button>
    </main>
  `);
  document.getElementById("btn-stats").addEventListener("click", showStats);
  document.getElementById("btn-settings").addEventListener("click", showSettings);
  root.querySelectorAll(".level-btn").forEach((btn) =>
    btn.addEventListener("click", () => showTopics(btn.dataset.level))
  );
}

async function showTopics(level) {
  const attempts = await getAllAttempts();
  const doneIds = new Set(attempts.filter((a) => a.level === level).map((a) => a.textId));
  const texts = index.texts.filter((t) => t.level === level);

  let showDone = false;

  function topicsForCurrentToggle() {
    return texts.filter((t) => (showDone ? doneIds.has(t.id) : !doneIds.has(t.id)));
  }

  function render() {
    const relevant = topicsForCurrentToggle();
    const tags = [...new Set(relevant.flatMap((t) => t.tags))];
    screen(`
      <header class="topbar">
        <button id="btn-back" class="icon-btn" aria-label="Zurück">←</button>
        <h1>${level}</h1>
      </header>
      <main>
        <label class="toggle">
          <input type="checkbox" id="toggle-done" ${showDone ? "checked" : ""} />
          Bereits bearbeitete
        </label>
        <div class="chip-grid">
          ${tags.length
            ? tags.map((tag) => `<button class="chip" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")
            : `<p class="empty">Keine Texte in dieser Ansicht.</p>`}
        </div>
      </main>
    `);
    document.getElementById("btn-back").addEventListener("click", showHome);
    document.getElementById("toggle-done").addEventListener("change", (e) => {
      showDone = e.target.checked;
      render();
    });
    root.querySelectorAll(".chip").forEach((btn) =>
      btn.addEventListener("click", () => startNextText(level, btn.dataset.tag, relevant))
    );
  }
  render();
}

function startNextText(level, tag, candidates) {
  const next = candidates
    .filter((t) => t.tags.includes(tag))
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (next) showReader(next);
}

async function showReader(entry) {
  const res = await fetch(`content/${entry.file}`);
  const text = await res.json();

  screen(`
    <header class="topbar">
      <button id="btn-back" class="icon-btn" aria-label="Zurück">←</button>
      <h1>${escapeHtml(entry.title)}</h1>
    </header>
    <main id="reader-main"></main>
    <footer class="reader-footer">
      <button id="btn-control" class="primary-btn">Kontrolle</button>
    </footer>
  `);
  document.getElementById("btn-back").addEventListener("click", () => {
    currentReader?.stop();
    showHome();
  });

  const main = document.getElementById("reader-main");
  currentReader = renderReader(main, text);

  document.getElementById("btn-control").addEventListener("click", async () => {
    const sec = currentReader.getElapsedSec();
    const clicks = currentReader.getClickCount();
    const words = currentReader.getWordCount();
    currentReader.stop();
    const isFirstAttempt = !(await hasAttempt(entry.id));
    showQuizScreen(text, entry, { sec, clicks, words, isFirstAttempt });
  });
}

function showQuizScreen(text, entry, meta) {
  screen(`
    <header class="topbar">
      <h1>${escapeHtml(entry.title)} – Kontrolle</h1>
    </header>
    <main id="quiz-main"></main>
  `);
  const main = document.getElementById("quiz-main");
  renderQuiz(main, text, async ({ correct }) => {
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
    showResult(entry, { ...meta, correct });
  });
}

function showResult(entry, meta) {
  screen(`
    <header class="topbar"><h1>Ergebnis</h1></header>
    <main class="result">
      <p>Zeit: <strong>${meta.sec}s</strong></p>
      <p>Klicks: <strong>${meta.clicks}</strong></p>
      <p>Richtige Antworten: <strong>${meta.correct} / 5</strong></p>
      ${!meta.isFirstAttempt ? `<p class="hint">Wiederholung – nicht in Statistik gespeichert.</p>` : ""}
      <button id="btn-home" class="primary-btn">Zur Startseite</button>
    </main>
  `);
  document.getElementById("btn-home").addEventListener("click", showHome);
}

async function showStats() {
  const attempts = await getAllAttempts();
  let level = "A1";
  function render() {
    screen(`
      <header class="topbar">
        <button id="btn-back" class="icon-btn" aria-label="Zurück">←</button>
        <h1>Statistik</h1>
      </header>
      <main>
        <div class="level-tabs">
          ${LEVELS.map((l) => `<button class="tab ${l === level ? "active" : ""}" data-level="${l}">${l}</button>`).join("")}
        </div>
        <div id="stats-charts"></div>
      </main>
    `);
    document.getElementById("btn-back").addEventListener("click", showHome);
    root.querySelectorAll(".tab").forEach((btn) =>
      btn.addEventListener("click", () => {
        level = btn.dataset.level;
        render();
      })
    );
    renderStats(document.getElementById("stats-charts"), attempts, level);
  }
  render();
}

async function showSettings() {
  const cfg = await getSyncConfig();
  screen(`
    <header class="topbar">
      <button id="btn-back" class="icon-btn" aria-label="Zurück">←</button>
      <h1>Einstellungen</h1>
    </header>
    <main class="settings">
      <h2>Gist-Sync</h2>
      <label>GitHub-Token (Scope <code>gist</code>)
        <input id="input-token" type="password" value="${escapeHtml(cfg.token)}" />
      </label>
      <label>Gist-ID
        <input id="input-gist" type="text" value="${escapeHtml(cfg.gistId)}" />
      </label>
      <button id="btn-save-sync" class="primary-btn">Speichern & synchronisieren</button>
      <p class="hint">Letzter Sync: ${cfg.lastSync ? new Date(cfg.lastSync).toLocaleString("de-DE") : "nie"}</p>
      ${cfg.lastError ? `<p class="error">Fehler: ${escapeHtml(cfg.lastError)}</p>` : ""}

      <h2>Daten</h2>
      <button id="btn-export" class="secondary-btn">Export als JSON</button>
      <label class="file-label">Import als JSON
        <input id="input-import" type="file" accept="application/json" />
      </label>
      <button id="btn-reset" class="danger-btn">Statistik zurücksetzen</button>
    </main>
  `);
  document.getElementById("btn-back").addEventListener("click", showHome);
  document.getElementById("btn-save-sync").addEventListener("click", async () => {
    const token = document.getElementById("input-token").value.trim();
    const gistId = document.getElementById("input-gist").value.trim();
    await setSyncConfig({ token, gistId });
    await sync();
    showSettings();
  });
  document.getElementById("btn-export").addEventListener("click", async () => {
    const json = await exportData();
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ukr-app-stats.json";
    a.click();
  });
  document.getElementById("input-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await importData(await file.text());
    showSettings();
  });
  document.getElementById("btn-reset").addEventListener("click", () => {
    showConfirm(
      "Statistik zurücksetzen?",
      "Alle gespeicherten Ergebnisse werden unwiderruflich gelöscht. Das kann nicht rückgängig gemacht werden.",
      async () => {
        await clearAttempts();
        await resetRemote();
        showSettings();
      }
    );
  });
}

function showConfirm(title, message, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button id="modal-cancel" class="secondary-btn">Abbrechen</button>
        <button id="modal-confirm" class="danger-btn">Löschen</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#modal-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#modal-confirm").addEventListener("click", async () => {
    overlay.remove();
    await onConfirm();
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

async function init() {
  await loadIndex();
  await showHome();
  await setSetting("lastSeen", new Date().toISOString());
  sync();

  if ("serviceWorker" in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register("sw.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return; // Erstinstallation, kein Update
      const banner = document.createElement("div");
      banner.className = "update-banner";
      banner.textContent = "Neue Version – neu laden";
      banner.addEventListener("click", () => location.reload());
      document.body.appendChild(banner);
    });
  }
}

init();
