// Anzeige der Vokabelkarten: Karteikarte (Antippen zum Aufdecken) und Frage-Antwort (vier Möglichkeiten).
// Aufbau und Verhalten wie in der Lernapp (cards.js/quiz.js); die Zusatzinfos zum Wort (Wortart, Genus,
// Formen, Hinweis) stehen unter der Antwort, in der Frage-Antwort-Ansicht klappen sie aus der richtigen Antwort.
import { escapeHtml } from "./tokens.js";
import { prioChip, updatePrioChip } from "./prio.js";
import { nextPrio } from "./vstore.js";
import { POS_LABEL, GEN_LABEL, ASP_LABEL, promptOf, answerOf, ukText, writeSlots, writeTiles } from "./vocab.js";

const KEYS = ["A", "B", "C", "D"];

// Zusatzinfos: Wortart-Marken, weitere deutsche Bedeutungen, Formen (Beugung), Hinweis.
// `skipNote`: Hinweis wurde schon an der Frage gezeigt (doppeldeutiges Wort).
export function infoHtml(word, { skipNote = false } = {}) {
  const tags = [POS_LABEL[word.pos], word.gen && GEN_LABEL[word.gen], word.asp && ASP_LABEL[word.asp]].filter(Boolean);
  const line = (label, value, cls = "") => `<p class="v-line"><span class="v-k">${label}</span><span class="v-v ${cls}">${escapeHtml(value)}</span></p>`;
  return `
    <div class="v-info">
      <div class="v-tags">${tags.map((t) => `<span class="v-tag">${escapeHtml(t)}</span>`).join("")}</div>
      ${word.alt?.length ? line("Auch", word.alt.join(" · ")) : ""}
      ${word.forms ? line("Formen", word.forms, "v-forms") : ""}
      ${word.zusatz && !skipNote ? line("Hinweis", word.zusatz) : ""}
    </div>`;
}

const stufeLabel = (stufe) => (stufe ? `<span class="level-chip">Stufe ${stufe}</span>` : "");
const questionHtml = (card, ambiguous, prio) => `
  <span class="card-meta">${prioChip(prio)}</span>
  <p class="v-word" ${card.dir === "uk-de" ? 'lang="uk"' : ""}>${escapeHtml(promptOf(card))}</p>
  ${ambiguous && card.word.zusatz ? `<p class="v-hint">${escapeHtml(card.word.zusatz)}</p>` : ""}`;

function wirePrio(container, onPrioChange) {
  const btn = container.querySelector(".prio-btn");
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = nextPrio(btn.dataset.prio);
    updatePrioChip(btn, next);
    onPrioChange?.(next);
  });
}

// ---------- Karteikarte ----------

export function renderFlashcard(container, card, { onRevealed, prio = "normal", onPrioChange, stufe, ambiguous = false, revealed = false } = {}) {
  const showNoteOnFront = ambiguous && !!card.word.zusatz;
  const answerFace = `
    <div class="flash-face">
      <div>
        <p class="v-word v-answer" ${card.dir === "de-uk" ? 'lang="uk"' : ""}>${escapeHtml(answerOf(card))}</p>
        ${infoHtml(card.word, { skipNote: showNoteOnFront })}
      </div>
    </div>`;
  container.innerHTML = `
    <div class="flash">
      <div class="flash-face flash-face-question">
        <div class="flash-q">${stufeLabel(stufe)}${questionHtml(card, ambiguous, prio)}</div>
      </div>
      ${revealed ? answerFace : `
      <button type="button" class="flash-face is-waiting" id="reveal">
        <p class="flash-answer-wait">Antippen, um die Antwort zu zeigen</p>
      </button>`}
    </div>`;
  wirePrio(container, onPrioChange);
  if (revealed) return;
  const reveal = container.querySelector("#reveal");
  reveal.addEventListener("click", () => {
    reveal.outerHTML = answerFace;
    onRevealed?.();
  }, { once: true });
}

// ---------- Frage-Antwort ----------

function showInfo(card, buttons, skipNote) {
  const correct = buttons.find((b) => b.dataset.id === card.wordId);
  const box = document.createElement("div");
  box.className = "quiz-explain";
  box.innerHTML = infoHtml(card.word, { skipNote });
  correct.classList.add("has-explain");
  correct.after(box);
}

function answersHtml(card, options, extra = (w) => "") {
  return options.map((w, pos) => `
    <button type="button" class="answer${extra(w)}" data-id="${w.id}">
      <span class="answer-key">${KEYS[pos]}</span>
      <span class="v-opt" ${card.dir === "de-uk" ? 'lang="uk"' : ""}>${escapeHtml(card.dir === "de-uk" ? ukText(w) : w.de)}</span>
    </button>`).join("");
}

// `options`: die Wörter in angezeigter Reihenfolge (richtiges + Falschantworten). Meldet genau einmal
// onAnswered({ correct, chosenId, options, gaveUp }); Rückgabe { giveUp() } für den „Auflösen“-Knopf.
export function renderQuizCard(container, card, { options, onAnswered, prio = "normal", onPrioChange, stufe, ambiguous = false } = {}) {
  const skipNote = ambiguous && !!card.word.zusatz;
  container.innerHTML = `
    <div class="q">
      <div class="q-text v-q">${stufeLabel(stufe)}${questionHtml(card, ambiguous, prio)}</div>
      <div class="answers" id="answers">${answersHtml(card, options)}</div>
    </div>`;
  wirePrio(container, onPrioChange);

  const answersEl = container.querySelector("#answers");
  const buttons = [...answersEl.querySelectorAll(".answer")];
  let done = false;

  const finish = (chosenId, gaveUp) => {
    if (done) return;
    done = true;
    answersEl.classList.add("is-done");
    for (const b of buttons) {
      if (b.dataset.id === card.wordId) b.classList.add("is-correct");
      else if (b.dataset.id === chosenId) b.classList.add("is-wrong");
      b.disabled = true;
    }
    showInfo(card, buttons, skipNote);
    onAnswered?.({ correct: chosenId === card.wordId, chosenId, options, gaveUp });
  };
  for (const b of buttons) b.addEventListener("click", () => finish(b.dataset.id, false));
  return { giveUp: () => finish(null, true) };
}

// Schreibgeschützte Rückschau („Zurück“) im Endzustand der Karte; nur die Prio bleibt änderbar.
export function renderQuizCardReview(container, card, { options, chosenId, prio = "normal", onPrioChange, stufe, ambiguous = false } = {}) {
  container.innerHTML = `
    <div class="q">
      <div class="q-text v-q">${stufeLabel(stufe)}${questionHtml(card, ambiguous, prio)}</div>
      <div class="answers is-done" id="answers">${answersHtml(card, options, (w) => (w.id === card.wordId ? " is-correct" : w.id === chosenId ? " is-wrong" : ""))}</div>
    </div>`;
  wirePrio(container, onPrioChange);
  const buttons = [...container.querySelectorAll(".answer")];
  buttons.forEach((b) => { b.disabled = true; });
  showInfo(card, buttons, ambiguous && !!card.word.zusatz);
}

// ---------- Schreiben (nur DE → UKR) ----------
//
// Unter der Frage stehen leere Kästchen je Buchstabe (Wortlücken bei mehreren Wörtern, Satzzeichen schon
// ausgefüllt), darunter die Buchstabenkacheln. Richtig → Kästchen grün, Kachel blass. Erster Fehler → der
// richtige Buchstabe erscheint gelb (seine Kachel wird blass), die falsche Kachel blinkt kurz rot. Zweiter
// Fehler → Rest rot, Runde verloren. Ein Fehler gilt noch als bestanden (aber ohne blauen Knopf).
// Meldet onAnswered({ correct, mistakes, gaveUp, states }); Rückgabe { giveUp() }.

function solutionHtml(slots, states) {
  const words = [[]];
  slots.forEach((slot, i) => (slot.kind === "gap" ? words.push([]) : words.at(-1).push([slot, i])));
  return words.filter((w) => w.length).map((w) => `<span class="w-word">${w.map(([slot, i]) => {
    if (slot.kind === "fixed") return `<span class="w-box is-fixed">${escapeHtml(slot.show)}</span>`;
    const st = states[i];
    return `<span class="w-box${st ? ` is-${st}` : ""}" data-i="${i}">${st ? escapeHtml(slot.show) : ""}</span>`;
  }).join("")}</span>`).join("");
}

const doneInfo = (card, skipNote) => `<div class="flash-face w-info">${infoHtml(card.word, { skipNote })}</div>`;

export function renderWriteCard(container, card, { onAnswered, prio = "normal", onPrioChange, stufe, ambiguous = false } = {}) {
  const skipNote = ambiguous && !!card.word.zusatz;
  const slots = writeSlots(card.word);
  const tiles = writeTiles(slots);
  const states = slots.map(() => "");
  const order = slots.map((s, i) => (s.kind === "letter" ? i : -1)).filter((i) => i >= 0);
  let pos = 0;
  let mistakes = 0;
  let done = false;

  container.innerHTML = `
    <div class="q">
      <div class="q-text v-q">${stufeLabel(stufe)}${questionHtml(card, ambiguous, prio)}</div>
      <div class="w-sol" lang="uk" aria-live="polite">${solutionHtml(slots, states)}</div>
      <div class="w-pool" id="pool" lang="uk">${tiles.map((t, k) => `<button type="button" class="w-tile" data-k="${k}">${escapeHtml(t.letter)}</button>`).join("")}</div>
    </div>`;
  wirePrio(container, onPrioChange);

  const sol = container.querySelector(".w-sol");
  const pool = container.querySelector("#pool");
  const buttons = [...pool.querySelectorAll(".w-tile")];
  const used = new Set();

  const paint = () => { sol.innerHTML = solutionHtml(slots, states); };
  // Kachel mit diesem Buchstaben verbrauchen (blass), bevorzugt eine noch freie richtige.
  const consume = (letter) => {
    const k = tiles.findIndex((t, j) => !used.has(j) && t.ok && t.letter === letter);
    if (k < 0) return;
    used.add(k);
    buttons[k].disabled = true;
    buttons[k].classList.add("is-used");
  };
  const flash = (btn) => { btn.classList.remove("is-flash"); void btn.offsetWidth; btn.classList.add("is-flash"); };

  function finish(gaveUp = false) {
    if (done) return;
    done = true;
    document.removeEventListener("keydown", onKey);
    const correct = !gaveUp && mistakes < 2;
    pool.outerHTML = doneInfo(card, skipNote);
    onAnswered?.({ correct, mistakes, gaveUp, states: [...states] });
  }
  function lose() {
    for (const i of order.slice(pos)) states[i] = "lost";
    pos = order.length;
    paint();
  }

  function choose(k) {
    if (done || used.has(k) || pos >= order.length) return;
    const i = order[pos];
    const want = slots[i].letter;
    const btn = buttons[k];
    if (tiles[k].letter === want) {
      states[i] = "ok";
      consume(want);
      pos++;
      paint();
    } else {
      mistakes++;
      flash(btn);
      if (mistakes === 1) {
        states[i] = "help";
        consume(want);
        pos++;
        paint();
      } else {
        lose();
        setTimeout(() => finish(), 450);
        return;
      }
    }
    if (pos >= order.length) setTimeout(() => finish(), 250);
  }
  buttons.forEach((b, k) => b.addEventListener("click", () => choose(k)));

  // Laptop: Tippen auf der (ukrainischen) Tastatur wählt eine passende Kachel.
  function onKey(e) {
    if (!pool.isConnected) { document.removeEventListener("keydown", onKey); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    const letter = e.key.toLowerCase();
    const k = tiles.findIndex((t, j) => !used.has(j) && t.letter === letter);
    if (k >= 0) { e.preventDefault(); choose(k); }
  }
  document.addEventListener("keydown", onKey);

  return { giveUp() { if (done || pos >= order.length) return; mistakes = 2; lose(); finish(true); } };
}

// Schreibgeschützte Rückschau im Endzustand.
export function renderWriteReview(container, card, { states, prio = "normal", onPrioChange, stufe, ambiguous = false } = {}) {
  const slots = writeSlots(card.word);
  container.innerHTML = `
    <div class="q">
      <div class="q-text v-q">${stufeLabel(stufe)}${questionHtml(card, ambiguous, prio)}</div>
      <div class="w-sol" lang="uk">${solutionHtml(slots, states ?? slots.map(() => "lost"))}</div>
      ${doneInfo(card, ambiguous && !!card.word.zusatz)}
    </div>`;
  wirePrio(container, onPrioChange);
}
