// Vokabelfunktion: Auswahl (Art → Richtung/Prio → manuell oder automatisch), Lernablauf, Meldungen.
// Vorbild: Lernapp js/app.js (Dock, „Zurück“-Rückschau, Automatikmodus), ohne Nutzerwahl und Rechtsgebiete.
// Die Rahmenfunktionen (render, Dialoge, Hinweis) kommen aus js/app.js über `ctx`.
import { escapeHtml } from "./tokens.js";
import { prioToggle } from "./prio.js";
import { renderFlashcard, renderQuizCard, renderQuizCardReview, renderWriteCard, renderWriteReview, infoHtml } from "./vcards.js";
import {
  DIRS, reverseDir, makeCards, buildQueue, countByStufe, countDueStufe5, filterByPrio, pickWeightedCard,
  pickDistractors, shuffle, isAmbiguous, trailingWrong, ukText, stripAccent, POS_LABEL,
} from "./vocab.js";
import {
  PRIOS, STUFEN, EDIT_FIELDS, getAllLevels, setLevel, levelEntry, getAllPrios, setPrio, effectivePrio,
  getAllEvents, addEvent, addFlag, getOpenFlags, resolveOpenFlagsForWord, setEdit, applyOverridesAndFilter, overlayWordById,
} from "./vstore.js";
import { getSetting, setSetting } from "./store.js";
import { countToday } from "./stats.js";
import { sync } from "./sync.js";

const FAST_BTN = (icon) => `<button type="button" class="btn btn-fasttrack" id="fasttrack" disabled aria-label="Direkt in Stufe 4 (schon sicher gekonnt)" title="Direkt in Stufe 4">${icon}</button>`;
const REVIEW_ROW = `<div class="dock-row" id="dock-review" hidden><button type="button" class="btn btn-primary btn-fill" id="review-next">Weiter</button></div>`;
const dockCards = (icon) => `
  <div class="dock-col">
    <div class="dock-row dock-row-split" id="dock-normal">
      <button type="button" class="btn btn-wrong" id="wrong" disabled>Falsch</button>
      <div class="dock-pair">
        <button type="button" class="btn btn-correct btn-fill" id="richtig" disabled>Richtig</button>
        ${FAST_BTN(icon)}
      </div>
    </div>
    ${REVIEW_ROW}
    <span class="dock-progress" id="progress"></span>
  </div>`;
const dockQuiz = (icon) => `
  <div class="dock-col">
    <div class="dock-row" id="dock-normal">
      <button type="button" class="btn btn-primary btn-fill" id="next" disabled>Weiter</button>
      ${FAST_BTN(icon)}
    </div>
    ${REVIEW_ROW}
    <span class="dock-progress" id="progress"></span>
  </div>`;

const WRITE_AUTO_NEXT_MS = 250; // Schreiben: + 250 ms Rundenende (vcards.js) = 0,5 s nach dem letzten Buchstaben bis zum nächsten Wort
const TYPE_LABEL = { cards: "Karteikarten", quiz: "Frage-Antwort", write: "Schreiben" };
const dirLabel = (dir) => (dir === "write" ? "DE → UKR" : DIRS[dir]);
const FLAG_FIELDS = { uk: "Ukrainisch", de: "Deutsch", info: "Zusatzinfo" };

export function setupVocab(ctx) {
  const { render, root, ICON, backButton, plural, toast, confirmDialog, showHome, allWords } = ctx;
  const $ = (sel) => root.querySelector(sel);
  const on = (sel, ev, fn) => $(sel)?.addEventListener(ev, fn);

  // ---------- Daten ----------

  // Wörter nach Korrekturen/Löschungen/Meldungen. Nur hierüber, nie `allWords` direkt, weiterverwenden.
  const liveWords = () => applyOverridesAndFilter(allWords);
  const byKey = (list) => new Map(list.map((e) => [e.key, e]));
  const loadMaps = async () => ({ levels: byKey(await getAllLevels()), prios: byKey(await getAllPrios()) });
  // Schreiben: nur Wörter, deren Karteikarte/Frage-Antwort-Karte (eine Richtung genügt) schon einmal Stufe 5 erreicht hat.
  const reached5 = (levels, id) => ["de-uk", "uk-de"].some((d) => { const l = levels.get(`${id}:${d}`); return Math.max(l?.best ?? 0, l?.stufe ?? 0) >= 5; });
  const wordsFor = async (type, levels) => {
    const words = await liveWords();
    if (type !== "write") return words;
    const lv = levels ?? (await loadMaps()).levels;
    return words.filter((w) => reached5(lv, w.id));
  };
  const getDir = async () => { const d = await getSetting("vocabDir", "de-uk"); return d in DIRS ? d : "de-uk"; };

  // ---------- Art: Karteikarten oder Frage-Antwort ----------

  async function showTypes() {
    const words = await liveWords();
    const n = words.length;
    const open = await openFlags();
    const quizOk = n >= 4;
    const writeNew = await hasNewWriteWords();

    render("vocab-types", {
      left: backButton(),
      body: `
        <header class="page-head">
          <p class="kicker">Vokabeln</p>
          <h1 class="page-title">Was möchtest du üben?</h1>
          <p class="page-sub">${plural(n, "Vokabel", "Vokabeln")} · je Richtung eine eigene Karte</p>
        </header>
        <div class="modes">
          <button class="mode" id="mode-cards" ${n ? "" : "disabled"}>
            <span class="mode-icon">${ICON.cards}</span>
            ${ICON.arrow}
            <span class="mode-title">Karteikarten</span>
            <span class="mode-text">Wort, aufdecken, bewerten</span>
          </button>
          <button class="mode" id="mode-quiz" ${quizOk ? "" : "disabled"}>
            <span class="mode-icon">${ICON.quiz}</span>
            ${quizOk ? ICON.arrow : `<span class="badge">Mindestens 4 Vokabeln</span>`}
            <span class="mode-title">Frage-Antwort</span>
            <span class="mode-text">Vier Möglichkeiten, eine richtig</span>
          </button>
          <button class="mode" id="mode-write" ${n ? "" : "disabled"}>
            ${writeNew ? NEW_BADGE : ""}
            <span class="mode-icon">${ICON.pen}</span>
            ${ICON.arrow}
            <span class="mode-title">Schreiben</span>
            <span class="mode-text">Wörter und Sätze Buchstabe für Buchstabe</span>
          </button>
        </div>
        ${open.length ? `
        <h2 class="label">Meldungen</h2>
        <div class="group">
          <button class="row" id="to-flags">
            <span class="row-main"><span class="row-title">Gemeldete Vokabeln prüfen</span><span class="row-sub">${plural(open.length, "offene Meldung", "offene Meldungen")}</span></span>
            ${ICON.chevron}
          </button>
        </div>` : ""}`,
    });
    on("#back", "click", showHome);
    on("#mode-cards", "click", () => showPick("cards"));
    on("#mode-quiz", "click", () => showPick("quiz"));
    on("#mode-write", "click", showWriteMenu);
    // Stand anderer Geräte nachladen und „Neu“ ggf. anpassen, ohne die Seite neu aufzubauen.
    sync().then(async () => {
      const tile = $("#mode-write");
      if (!tile || tile.disabled) return;
      const isNew = await hasNewWriteWords();
      const badge = tile.querySelector(".badge-new");
      if (isNew && !badge) tile.insertAdjacentHTML("afterbegin", NEW_BADGE);
      else if (!isNew) badge?.remove();
    });
    on("#to-flags", "click", showFlagReview);
  }

  // ---------- Stufenbalken (wie die Speicheranzeige unter iOS, in Graustufen) ----------

  function levelBar(cards, levels) {
    const counts = countByStufe(cards, levels);
    const total = cards.length;
    if (!total) return `<div class="lvbar is-empty" aria-label="Keine Karten in dieser Auswahl"></div>`;
    const parts = STUFEN.filter((st) => counts[st] > 0).map((st) =>
      `<span class="lvbar-seg" data-stufe="${st}" style="flex-grow:${counts[st]}" title="Stufe ${st}: ${plural(counts[st], "Karte", "Karten")}"><span class="lvbar-n">${counts[st]}</span></span>`).join("");
    return `<div class="lvbar" role="img" aria-label="${STUFEN.map((st) => `Stufe ${st}: ${counts[st]}`).join(", ")}">${parts}</div>`;
  }
  // Zahl nur zeigen, wenn sie in die Fläche passt.
  function fitLevelBar() {
    requestAnimationFrame(() => root.querySelectorAll(".lvbar-seg").forEach((seg) => {
      const n = seg.querySelector(".lvbar-n");
      n.hidden = n.scrollWidth + 8 > seg.clientWidth;
    }));
  }

  // ---------- Schreiben: „Neu“-Hinweis ----------
  // Lokal gemerkt: welche freigeschalteten Wörter beim letzten Öffnen von „Schreiben“ schon da waren.
  const WRITE_SEEN = "vocabWriteSeen";
  async function hasNewWriteWords() {
    const seen = new Set(await getSetting(WRITE_SEEN, []));
    return (await wordsFor("write")).some((w) => !seen.has(w.id));
  }
  // Vereinigung mit dem bisherigen Stand; wird synchronisiert (sync.js mergeWriteSeen), damit „Neu“ auf allen Geräten gilt.
  const markWriteSeen = async () => {
    const seen = new Set(await getSetting(WRITE_SEEN, []));
    for (const w of await wordsFor("write")) seen.add(w.id);
    await setSetting(WRITE_SEEN, [...seen].sort());
    sync();
  };
  const NEW_BADGE = `<span class="badge badge-new">Neu</span>`;

  // ---------- Schreiben: Vokabeln oder Sätze ----------

  async function showWriteMenu() {
    const n = (await wordsFor("write")).length;
    const isNew = await hasNewWriteWords();
    await markWriteSeen();
    render("vocab-write", {
      left: backButton(),
      body: `
        <header class="page-head">
          <p class="kicker">Vokabeln · Schreiben</p>
          <h1 class="page-title">Was möchtest du schreiben?</h1>
        </header>
        <div class="modes">
          <button class="mode" id="write-words" ${n ? "" : "disabled"}>
            ${isNew ? NEW_BADGE : ""}
            <span class="mode-icon">${ICON.cards}</span>
            ${ICON.arrow}
            <span class="mode-title">Vokabeln</span>
            <span class="mode-text">${n ? `${plural(n, "Vokabel", "Vokabeln")} freigeschaltet` : "Freigeschaltet ab Stufe 5 in Karteikarten oder Frage-Antwort"}</span>
          </button>
          <button class="mode" disabled>
            <span class="mode-icon">${ICON.text}</span>
            <span class="badge">In Vorbereitung</span>
            <span class="mode-title">Sätze</span>
            <span class="mode-text">Ganze Sätze schreiben</span>
          </button>
        </div>`,
    });
    on("#back", "click", showTypes);
    on("#write-words", "click", () => showPick("write"));
  }

  // ---------- Richtung, Prioritäten, manuell oder automatisch ----------

  async function showPick(type, allowed = new Set(PRIOS)) {
    const dir = type === "write" ? "write" : await getDir();
    const { prios, levels } = await loadMaps();
    const cards = filterByPrio(makeCards(await wordsFor(type), dir), prios, allowed);
    const n = cards.length;

    render("vocab-pick", {
      left: backButton(),
      body: `
        <header class="page-head">
          <p class="kicker">Vokabeln · ${TYPE_LABEL[type]}</p>
          <h1 class="page-title">Wie möchtest du üben?</h1>
        </header>
        ${type === "write" ? `<p class="page-sub w-sub">Deutsch → Ukrainisch. Eigener Lernstand, unabhängig von Karteikarten und Frage-Antwort.</p>` : `
        <div class="seg" id="dir-seg" role="tablist" aria-label="Richtung">
          ${Object.entries(DIRS).map(([d, label]) => `<button role="tab" data-dir="${d}" class="${d === dir ? "is-active" : ""}">${label}</button>`).join("")}
        </div>`}
        ${type !== "write" ? levelBar(cards, levels) : ""}
        <div class="prio-row">
          <div class="prio-toggle" role="group" aria-label="Prioritäten">${PRIOS.map((p) => prioToggle(p, allowed.has(p))).join("")}</div>
          <span class="prio-count">${plural(n, "Karte", "Karten")}</span>
        </div>
        <div class="modes">
          <button class="mode" id="pick-manuell" ${n ? "" : "disabled"}>
            <span class="mode-icon">${ICON.hand}</span>
            ${ICON.arrow}
            <span class="mode-title">Manuell</span>
            <span class="mode-text">Stufe selbst wählen</span>
          </button>
          <button class="mode" id="pick-auto" ${n ? "" : "disabled"}>
            <span class="mode-icon">${ICON.auto}</span>
            ${ICON.arrow}
            <span class="mode-title">Automatisch</span>
            <span class="mode-text">Karten in sinnvoller Reihenfolge</span>
          </button>
        </div>`,
    });

    fitLevelBar();
    on("#back", "click", type === "write" ? showWriteMenu : showTypes);
    root.querySelectorAll("#dir-seg [data-dir]").forEach((b) =>
      b.addEventListener("click", async () => { await setSetting("vocabDir", b.dataset.dir); showPick(type, allowed); })
    );
    root.querySelectorAll(".prio-toggle-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const next = new Set(allowed);
        if (next.has(b.dataset.prio)) { if (next.size > 1) next.delete(b.dataset.prio); } else next.add(b.dataset.prio);
        showPick(type, next);
      })
    );
    on("#pick-manuell", "click", () => showStufen(type, dir, allowed));
    on("#pick-auto", "click", () => runSession({ type, dir, allowed, stufe: null }));
  }

  // ---------- Stufe (manuell) ----------

  async function showStufen(type, dir, allowed) {
    const { levels, prios } = await loadMaps();
    const cards = filterByPrio(makeCards(await wordsFor(type, levels), dir), prios, allowed);
    const counts = countByStufe(cards, levels);
    const due5 = countDueStufe5(cards, levels);

    const rows = STUFEN.map((stufe) => {
      const n = counts[stufe] ?? 0;
      return `
        <button class="row" data-stufe="${stufe}" ${n ? "" : "disabled"}>
          <span class="row-lead">${stufe}</span>
          <span class="row-main">
            <span class="row-title">Stufe ${stufe}</span>
            <span class="row-sub">${n ? plural(n, "Karte", "Karten") : "Noch keine Karten"}${stufe === 5 && due5 > 0 ? `<span class="row-due" title="Seit über 2 Monaten nicht bearbeitet">(<span class="row-due-in">${ICON.clock}${plural(due5, "Karte", "Karten")}</span>)</span>` : ""}</span>
          </span>
          ${n ? ICON.chevron : ""}
        </button>`;
    }).join("");

    render("vocab-stufe", {
      left: backButton(),
      body: `
        <header class="page-head">
          <p class="kicker">Vokabeln · ${TYPE_LABEL[type]} · ${dirLabel(dir)}</p>
          <h1 class="page-title">Stufe wählen</h1>
          <p class="page-sub">Neue Karten stehen in Stufe 1. Richtig beantwortet wandern sie eine Stufe höher, falsch beantwortet zurück auf Stufe 1.</p>
        </header>
        <div class="group">${rows}</div>`,
    });
    on("#back", "click", () => showPick(type, allowed));
    root.querySelectorAll("[data-stufe]:not(:disabled)").forEach((b) =>
      b.addEventListener("click", () => runSession({ type, dir, allowed, stufe: Number(b.dataset.stufe) }))
    );
  }

  // ---------- Lernablauf (Karteikarten/Frage-Antwort, manuell/automatisch) ----------
  //
  // Die Klick-Handler der Dock-Knöpfe sitzen einmal pro Aufruf und lösen das gemeinsame `resolveStep`
  // auf, das `step()` bei jedem Durchlauf neu setzt – so lässt sich die Bühne für die Rückschau
  // (Dock-Zeile #dock-review) austauschen und zurücktauschen, ohne die wartende Promise zu stören.

  async function runSession({ type, dir, allowed, stufe }) {
    const auto = stufe == null;
    await sync();

    const words = await liveWords(); // auch Quelle der Falschantworten (unabhängig vom Prio-Filter)
    let maps = await loadMaps();
    const cardsAll = filterByPrio(makeCards(type === "write" ? await wordsFor(type, maps.levels) : words, dir), maps.prios, allowed);
    const queue = auto ? null : buildQueue(cardsAll, stufe, maps.levels);
    const pool = auto ? [...cardsAll] : null;

    render(`vocab-${type}${auto ? "-auto" : ""}`, {
      left: backButton("Modus verlassen"),
      mid: `<button class="pill-btn" id="prev-btn" disabled>Zurück</button>`,
      right: `<button class="icon-btn" id="flag-btn" aria-label="Vokabel melden">${ICON.flag}</button><span class="bar-crumb"><b>${auto ? "Automatisch" : `Stufe ${stufe}`}</b> · ${type === "write" ? "Schreiben" : DIRS[dir]}</span>`,
      body: `<div id="stage" class="vocab"></div>`,
      dock: type === "cards" ? dockCards(ICON.up) : dockQuiz(ICON.up),
    });

    on("#back", "click", async () => { await sync(); if (auto) showPick(type, allowed); else showStufen(type, dir, allowed); });

    const pendingKey = `vocabAutoPending_${type}_${dir}`;
    const stage = $("#stage");
    const progress = $("#progress");
    const dockNormal = $("#dock-normal");
    const dockReview = $("#dock-review");
    const prevBtn = $("#prev-btn");
    const fastBtn = $("#fasttrack");
    const wrongBtn = type === "cards" ? $("#wrong") : null;
    const richtigBtn = type === "cards" ? $("#richtig") : null;
    const nextBtn = type !== "cards" ? $("#next") : null;

    let i = 0;
    let lastWordId = null;
    let currentCard = null;
    let lastAnswered = null; // { card, stufe, result } – für „Zurück“
    let reviewing = false;
    let skipCurrent = null;
    let resolveStep = null;
    let outcome = null;
    let quizController = null;

    const stufeOf = (card) => maps.levels.get(card.key)?.stufe ?? 1;
    const prioOf = (card) => effectivePrio(card, maps.prios);
    const common = (card) => ({
      prio: prioOf(card),
      onPrioChange: (prio) => changePrio(card.key, prio),
      stufe: auto ? stufeOf(card) : undefined,
      ambiguous: isAmbiguous(card, words),
    });

    async function changePrio(key, prio) {
      const ts = new Date().toISOString();
      await setPrio(key, prio, ts);
      maps.prios.set(key, { key, prio, ts });
      sync();
    }

    function armCard(card) {
      // Schreiben hat keinen blauen Knopf; sonst nur bei der ersten Bearbeitung einer Karte.
      fastBtn.style.display = type === "write" || maps.levels.has(card.key) ? "none" : "";
      fastBtn.disabled = true;
      if (type === "cards") {
        wrongBtn.disabled = true;
        richtigBtn.disabled = true;
        renderFlashcard(stage, card, {
          ...common(card),
          onRevealed: () => { wrongBtn.disabled = false; richtigBtn.disabled = false; fastBtn.disabled = false; },
        });
      } else if (type === "write") {
        outcome = null;
        nextBtn.disabled = false;
        nextBtn.textContent = "Auflösen";
        quizController = renderWriteCard(stage, card, {
          ...common(card),
          // Ein Fehler gilt als bestanden, der blaue Knopf aber nur ganz ohne Fehler.
          onAnswered: (result) => {
            outcome = result;
            nextBtn.textContent = "Weiter";
            const perfect = result.correct && result.mistakes === 0;
            // Fehlerfrei geschrieben: nach kurzem Moment automatisch weiter (flüssiges Schreiben).
            if (perfect) setTimeout(() => { if (outcome === result && !reviewing && resolveStep) resolveStep(outcome); }, WRITE_AUTO_NEXT_MS);
          },
        });
      } else {
        outcome = null;
        nextBtn.disabled = false;
        nextBtn.textContent = "Auflösen";
        const options = shuffle([card.word, ...pickDistractors(card, words)]);
        quizController = renderQuizCard(stage, card, {
          ...common(card),
          options,
          onAnswered: (result) => { outcome = result; nextBtn.textContent = "Weiter"; fastBtn.disabled = !result.correct; },
        });
      }
    }

    function showEmptyState() {
      const hasCards = cardsAll.length > 0;
      stage.innerHTML = auto
        ? `<div class="empty"><p class="empty-title">${hasCards ? "Für heute durch" : "Keine Karten verfügbar"}</p><p class="empty-sub">${hasCards ? "Alle Karten wurden in den letzten 24 Stunden bearbeitet. Später gibt es wieder neue." : "In dieser Auswahl gibt es aktuell keine Karten."}</p></div>`
        : `<div class="empty"><p class="empty-title">Stufe abgeschlossen</p><p class="empty-sub">Alle Karten dieser Stufe sind für diesen Durchgang bearbeitet.</p></div>`;
      dockNormal.hidden = true;
    }

    // Bewertung: Stufe, Ereignis (Statistik) und die automatischen Prio-Regeln.
    async function answerCard(card, correct, fastTrack) {
      const now = new Date().toISOString();
      const first = !maps.levels.has(card.key);
      const newStufe = fastTrack ? 4 : correct ? Math.min(5, stufeOf(card) + 1) : 1;
      const entry = levelEntry(card.key, newStufe, now, maps.levels.get(card.key));
      await setLevel(entry);
      maps.levels.set(card.key, entry);
      await addEvent({ id: crypto.randomUUID(), ts: now, cardId: card.key, correct, mode: type });

      // Schreiben hat keine Gegenrichtung (eigener Lernstand) – dort wirken die Regeln nur auf die Karte selbst.
      const reverseKey = card.track === "write" ? null : `${card.wordId}:${reverseDir(card.dir)}`;
      const assign = async (key, prio) => {
        await setPrio(key, prio, now);
        maps.prios.set(key, { key, prio, ts: now });
      };
      if (fastTrack) {
        // Blauer Knopf: Die Gegenrichtung wandert ebenfalls in Stufe 4 (ohne eigenes Statistik-Ereignis) …
        if (reverseKey && (maps.levels.get(reverseKey)?.stufe ?? 1) < 4) {
          // `noRest`: Die Gegenrichtung darf auch innerhalb von 24 Stunden in der Automatik erscheinen.
          const rev = levelEntry(reverseKey, 4, now, maps.levels.get(reverseKey), true);
          await setLevel(rev);
          maps.levels.set(reverseKey, rev);
        }
        // … und beide Karten bekommen Prio niedrig (die Gegenrichtung nur, sofern sie noch keine Zuweisung hat).
        await assign(card.key, "niedrig");
        if (reverseKey && !maps.prios.has(reverseKey)) await assign(reverseKey, "niedrig");
      } else if (!correct && trailingWrong(await getAllEvents(), card.key) === 3) {
        // Dreimal in Folge falsch: Prio hoch, auch für die Gegenrichtung.
        await assign(card.key, "hoch");
        if (reverseKey) await assign(reverseKey, "hoch");
      }
      sync();
    }

    // Meldung: Karte aus dem laufenden Durchgang nehmen (beide Richtungen des Wortes).
    function dropWord(wordId) {
      const strip = (list) => { for (let k = list.length - 1; k >= 0; k--) if (list[k].wordId === wordId) list.splice(k, 1); };
      if (queue) { for (let k = queue.length - 1; k >= 0; k--) if (queue[k].wordId === wordId) { queue.splice(k, 1); if (k < i) i--; } }
      if (pool) strip(pool);
      const at = words.findIndex((w) => w.id === wordId);
      if (at >= 0) words.splice(at, 1);
    }

    on("#flag-btn", "click", () => {
      const target = reviewing ? lastAnswered?.card : currentCard;
      if (!target) return;
      flagDialog(target.word).then((flagged) => {
        if (!flagged) return;
        const wasCurrent = !reviewing && target === currentCard;
        dropWord(target.wordId);
        if (wasCurrent) skipCurrent?.();
      });
    });

    prevBtn.addEventListener("click", () => {
      if (!lastAnswered || reviewing) return;
      reviewing = true;
      dockNormal.hidden = true;
      dockReview.hidden = false;
      const { card, result } = lastAnswered;
      const base = { ...common(card), stufe: auto ? lastAnswered.stufe : undefined };
      if (type === "cards") renderFlashcard(stage, card, { ...base, revealed: true });
      else if (type === "write") renderWriteReview(stage, card, { ...base, states: result.states });
      else renderQuizCardReview(stage, card, { ...base, options: result.options, chosenId: result.chosenId });
    });

    on("#review-next", "click", () => {
      reviewing = false;
      dockReview.hidden = true;
      if (currentCard) { dockNormal.hidden = false; armCard(currentCard); }
      else showEmptyState();
    });

    if (type === "cards") {
      wrongBtn.onclick = () => { if (!wrongBtn.disabled && resolveStep) resolveStep({ correct: false }); };
      richtigBtn.onclick = () => { if (!richtigBtn.disabled && resolveStep) resolveStep({ correct: true }); };
    } else {
      nextBtn.onclick = () => {
        if (!outcome) { quizController?.giveUp(); return; }
        if (resolveStep) resolveStep(outcome);
      };
    }
    fastBtn.onclick = () => { if (!fastBtn.disabled && resolveStep) resolveStep({ ...outcome, fastTrack: true }); };

    const updateProgress = async () => { progress.textContent = `${countToday(await getAllEvents())} heute bearbeitet`; };

    async function nextCard() {
      if (auto) {
        if (pool.length === 0) return null;
        const pendingKeyId = await getSetting(pendingKey, null);
        return (pendingKeyId && pool.find((c) => c.key === pendingKeyId)) || pickWeightedCard(pool, maps.levels, maps.prios, lastWordId);
      }
      return i < queue.length ? queue[i] : null;
    }

    async function step() {
      await updateProgress();
      maps = await loadMaps();
      const card = await nextCard();
      if (!card) {
        currentCard = null;
        showEmptyState();
        if (!auto) await sync();
        return;
      }
      dockNormal.hidden = false;
      currentCard = card;
      lastWordId = card.wordId;
      if (auto) await setSetting(pendingKey, card.key); // gezogen, aber noch nicht bearbeitet: bleibt beim Verlassen gemerkt
      const stufeNow = stufeOf(card);
      armCard(card);

      const result = await new Promise((resolve) => {
        skipCurrent = () => resolve({ flagged: true });
        resolveStep = resolve;
      });
      resolveStep = null;
      if (auto) await setSetting(pendingKey, null);
      if (!auto && !result.flagged) i++;
      if (result.flagged) { step(); return; }
      lastAnswered = { card, stufe: stufeNow, result };
      prevBtn.disabled = false;
      await answerCard(card, result.fastTrack ? true : result.correct, !!result.fastTrack);
      step();
    }
    step();
  }

  // ---------- Melden ----------

  // Löst mit true, wenn gemeldet wurde (Wort verschwindet aus dem Durchgang), sonst false.
  function flagDialog(word) {
    return new Promise((resolve) => {
      let field = "uk";
      const el = document.createElement("div");
      el.className = "backdrop";
      el.innerHTML = `
        <div class="dialog" role="alertdialog" aria-modal="true">
          <h3>Vokabel melden</h3>
          <p>Was stimmt bei „${escapeHtml(word.de)}“ / „${escapeHtml(ukText(word))}“ nicht?</p>
          <div class="seg" id="flag-seg">
            ${Object.entries(FLAG_FIELDS).map(([f, label]) => `<button type="button" data-field="${f}" class="${f === field ? "is-active" : ""}">${label}</button>`).join("")}
          </div>
          <label class="field-box" style="margin-top:14px">
            <span class="field-box-label">Kurze Beschreibung</span>
            <textarea id="flag-note" rows="3" placeholder="Was genau ist falsch oder unklar?"></textarea>
          </label>
          <div class="dialog-actions" style="margin-top:18px">
            <button class="btn btn-secondary" data-answer="cancel">Abbrechen</button>
            <button class="btn btn-primary" id="flag-submit" disabled>Absenden</button>
          </div>
        </div>`;
      document.body.appendChild(el);
      const segButtons = [...el.querySelectorAll("#flag-seg button")];
      segButtons.forEach((b) => b.addEventListener("click", () => {
        field = b.dataset.field;
        segButtons.forEach((x) => x.classList.toggle("is-active", x === b));
      }));
      const note = el.querySelector("#flag-note");
      const submit = el.querySelector("#flag-submit");
      note.addEventListener("input", () => { submit.disabled = note.value.trim().length === 0; });
      const close = (result) => { el.remove(); resolve(result); };
      el.addEventListener("click", (e) => { if (e.target === el) close(false); });
      el.querySelector('[data-answer="cancel"]').addEventListener("click", () => close(false));
      submit.addEventListener("click", async () => {
        if (submit.disabled) return;
        submit.disabled = true;
        await addFlag({ id: crypto.randomUUID(), wordId: word.id, field, note: note.value.trim(), ts: new Date().toISOString(), status: "open" });
        sync();
        toast("Danke, gemeldet.");
        close(true);
      });
      note.focus();
    });
  }

  // ---------- Gemeldete Vokabeln prüfen ----------

  const wordSummary = (w) => `${ukText(w)} = ${w.de}${w.alt?.length ? ` (auch: ${w.alt.join(", ")})` : ""} [${POS_LABEL[w.pos]}${w.gen ? `, ${w.gen}` : ""}]${w.forms ? ` | Formen: ${w.forms}` : ""}${w.zusatz ? ` | Hinweis: ${w.zusatz}` : ""}`;

  const openFlags = async () => (await getOpenFlags()).filter((f) => allWords.some((w) => w.id === f.wordId)).sort((a, b) => (a.ts < b.ts ? -1 : 1));

  async function flagsAsText() {
    const flags = await openFlags();
    const blocks = [];
    for (const f of flags) {
      const w = await overlayWordById(allWords, f.wordId);
      if (!w) continue;
      blocks.push([`Datei: content/vokabeln (${w.id})`, `Vokabel: ${wordSummary(w)}`, `Meldung (${FLAG_FIELDS[f.field] ?? f.field}, ${f.ts.slice(0, 10)}): ${f.note}`].join("\n"));
    }
    return blocks.join("\n\n----------------------------------------\n\n") + (blocks.length ? "\n" : "");
  }
  async function showFlagReview() {
    await sync();
    let flags = await openFlags();
    let idx = 0;

    render("vocab-flags", {
      left: backButton(),
      right: `<button class="icon-btn" id="export-flags" aria-label="Offene Meldungen als Textdatei exportieren" title="Als Textdatei exportieren">${ICON.download}</button>`,
      body: `<div id="stage"></div>`,
    });
    on("#back", "click", async () => { await sync(); showTypes(); });
    on("#export-flags", "click", async () => {
      const text = await flagsAsText();
      if (!text) { toast("Keine offenen Meldungen"); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      a.download = `vokabel-meldungen-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });

    const stage = $("#stage");
    const dropWord = (wordId) => { flags = flags.filter((f) => f.wordId !== wordId); if (idx >= flags.length) idx = 0; };

    async function renderCurrent() {
      if (flags.length === 0) {
        stage.innerHTML = `
          <header class="page-head"><p class="kicker">Vokabeln</p><h1 class="page-title">Meldungen</h1></header>
          <div class="empty"><p class="empty-title">Keine offenen Meldungen</p><p class="empty-sub">Alle gemeldeten Vokabeln sind bearbeitet.</p></div>`;
        return;
      }
      if (idx >= flags.length) idx = 0;
      const flag = flags[idx];
      const word = await overlayWordById(allWords, flag.wordId);
      if (!word) { dropWord(flag.wordId); renderCurrent(); return; }
      renderView(flag, word);
    }

    function renderView(flag, word) {
      stage.innerHTML = `
        <header class="page-head"><p class="kicker">Meldung <b>${idx + 1}</b> von ${flags.length}</p><h1 class="page-title">Meldungen</h1></header>
        <div class="flash-face flash-face-question" style="margin-bottom:14px">
          <p class="v-word" lang="uk">${escapeHtml(ukText(word))}</p>
          <p class="v-word v-answer">${escapeHtml(word.de)}</p>
          ${infoHtml(word)}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px"><span class="v-tag">${escapeHtml(FLAG_FIELDS[flag.field] ?? flag.field)} gemeldet</span></div>
        <p class="page-sub" style="margin-bottom:24px">${escapeHtml(flag.note)}</p>
        <div style="display:flex; flex-direction:column; gap:10px">
          <button class="btn btn-primary" id="edit-btn">Bearbeiten</button>
          <button class="btn btn-secondary" id="ok-btn">Doch korrekt – wieder freigeben</button>
          <button class="btn btn-secondary" id="skip-btn">Überspringen</button>
          <button class="btn btn-danger" id="delete-btn">Löschen</button>
        </div>`;

      on("#skip-btn", "click", () => { const [f] = flags.splice(idx, 1); flags.push(f); if (idx >= flags.length) idx = 0; renderCurrent(); });
      on("#ok-btn", "click", async () => {
        await resolveOpenFlagsForWord(word.id, new Date().toISOString());
        sync();
        toast("Wieder freigegeben");
        dropWord(word.id);
        renderCurrent();
      });
      on("#delete-btn", "click", () => confirmDialog({
        title: "Vokabel löschen?",
        text: "Die Vokabel wird in beiden Richtungen überall ausgeblendet. Das lässt sich in der App nicht rückgängig machen.",
        onYes: async () => {
          const now = new Date().toISOString();
          await setEdit({ wordId: word.id, ts: now, deleted: true });
          await resolveOpenFlagsForWord(word.id, now);
          sync();
          toast("Vokabel gelöscht");
          dropWord(word.id);
          renderCurrent();
        },
      }));
      on("#edit-btn", "click", () => renderEdit(flag, word));
    }

    function renderEdit(flag, word) {
      const text = (id, label, value, extra = "") => `<label class="field-box"><span class="field-box-label">${label}</span><input id="e-${id}" type="text" value="${escapeHtml(value ?? "")}" ${extra}></label>`;
      const select = (id, label, options, value) => `<label class="field-box"><span class="field-box-label">${label}</span><select id="e-${id}">${options.map(([v, l]) => `<option value="${v}" ${v === (value ?? "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
      stage.innerHTML = `
        <header class="page-head"><p class="kicker">Meldung <b>${idx + 1}</b> von ${flags.length}</p><h1 class="page-title">Vokabel bearbeiten</h1></header>
        <div class="form-group">
          ${text("uk", "Ukrainisch (ohne Betonungszeichen)", word.uk, 'lang="uk"')}
          ${text("a", "Mit Betonungszeichen", word.a, 'lang="uk"')}
          ${text("de", "Deutsch", word.de)}
          ${text("alt", "Weitere deutsche Bedeutungen (mit Semikolon trennen)", (word.alt ?? []).join("; "))}
          ${select("pos", "Wortart", Object.entries(POS_LABEL), word.pos)}
          ${select("gen", "Genus (nur Substantive)", [["", "–"], ["m", "maskulin"], ["f", "feminin"], ["n", "neutrum"], ["pl", "nur Plural"]], word.gen)}
          ${select("asp", "Aspekt (nur Verben)", [["", "–"], ["ipf", "unvollendet"], ["pf", "vollendet"]], word.asp)}
          ${text("forms", "Formen (Beugung)", word.forms)}
          ${text("zusatz", "Hinweis", word.zusatz)}
          <button class="btn btn-primary" id="save-edit">Speichern</button>
          <button class="btn btn-secondary" id="cancel-edit">Abbrechen</button>
        </div>`;
      on("#cancel-edit", "click", () => renderView(flag, word));
      on("#save-edit", "click", async () => {
        const v = (id) => $(`#e-${id}`).value.trim();
        const uk = v("uk").normalize("NFC");
        const a = (v("a") || uk).normalize("NFC");
        if (!uk || !/[Ѐ-ӿ]/.test(uk) || !v("de")) { toast("Bitte Ukrainisch (kyrillisch) und Deutsch eintragen"); return; }
        if (stripAccent(a).toLowerCase() !== uk.toLowerCase()) { toast("„Mit Betonungszeichen“ muss dieselben Buchstaben wie „Ukrainisch“ haben"); return; }
        const alt = v("alt").split(";").map((x) => x.trim()).filter(Boolean);
        const now = new Date().toISOString();
        const values = { uk, a, de: v("de"), alt, pos: v("pos"), gen: v("gen"), asp: v("asp"), forms: v("forms"), zusatz: v("zusatz") };
        await setEdit({ wordId: word.id, ts: now, deleted: false, ...Object.fromEntries(EDIT_FIELDS.map((f) => [f, values[f] === "" ? null : values[f]])) });
        await resolveOpenFlagsForWord(word.id, now);
        sync();
        toast("Vokabel gespeichert");
        dropWord(word.id);
        renderCurrent();
      });
    }

    renderCurrent();
  }

  return { showTypes, count: async () => (await liveWords()).length };
}
