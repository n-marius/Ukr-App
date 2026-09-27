// Textanzeige mit Popovers, Timer (pausierbar) und Zählung unterschiedlicher nachgeschlagener Wörter/Einheiten.
import { renderTokenStream, togglePopover } from "./tokens.js";

export function createReader(container, text, { onAutoPause } = {}) {
  const opened = new Set();
  let elapsedMs = 0;
  let startedAt = performance.now();
  let running = true;

  const unitForms = {};
  for (const paragraph of text.paragraphs) {
    for (const tok of paragraph) {
      if (tok.u) (unitForms[tok.u] ??= []).push(tok.a ?? tok.t);
    }
  }

  const article = document.createElement("article");
  article.className = "reader-text";
  article.lang = "uk";

  let seq = 0;
  for (const paragraph of text.paragraphs) {
    const p = document.createElement("p");
    renderTokenStream(p, paragraph, (span, tok) => {
      if (!span.dataset.id) span.dataset.id = tok.u ?? `w${seq++}`;
      opened.add(span.dataset.id);
      if (tok.u) {
        const info = { ...text.units[tok.u], a: unitForms[tok.u].join(" ") };
        togglePopover(span, info, [...article.querySelectorAll(`[data-unit="${tok.u}"]`)]);
      } else {
        togglePopover(span, tok);
      }
    });
    article.appendChild(p);
  }
  container.appendChild(article);

  function pause() {
    if (!running) return;
    elapsedMs += performance.now() - startedAt;
    running = false;
  }
  function resume() {
    if (running) return;
    startedAt = performance.now();
    running = true;
  }
  function onVisibility() {
    if (document.hidden && running) {
      pause();
      onAutoPause?.();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  return {
    article,
    pause,
    resume,
    get paused() { return !running; },
    elapsedSec() {
      return Math.round((running ? elapsedMs + performance.now() - startedAt : elapsedMs) / 1000);
    },
    clickCount() { return opened.size; },
    wordCount() {
      return text.paragraphs.reduce((sum, p) => sum + p.filter((t) => !("p" in t)).length, 0);
    },
    stop() {
      pause();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
