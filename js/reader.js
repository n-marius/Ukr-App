// Textanzeige: klickbare Tokens, Overlay, Timer, Klickzählung distinkter Wörter/Einheiten.
import { renderTokenStream, showTokenOverlay } from "./tokens.js";

export function renderReader(container, text) {
  container.innerHTML = "";
  const openedIds = new Set();
  let startTs = performance.now();
  let elapsedMs = 0;
  let running = true;

  function pause() {
    if (running) {
      elapsedMs += performance.now() - startTs;
      running = false;
    }
  }
  function resume() {
    if (!running) {
      startTs = performance.now();
      running = true;
    }
  }
  function onVisibility() {
    if (document.hidden) pause();
    else resume();
  }
  document.addEventListener("visibilitychange", onVisibility);

  const article = document.createElement("article");
  article.className = "reader-text";

  let tokenSeq = 0;
  for (const paragraph of text.paragraphs) {
    const p = document.createElement("p");
    renderTokenStream(p, paragraph, (span, tok) => {
      const id = tok.u ?? `w${tokenSeq++}`;
      openedIds.add(id);
      const info = tok.u ? { ...text.units[tok.u], a: tok.a, t: tok.t } : tok;
      const group = tok.u
        ? [...article.querySelectorAll(`[data-unit="${tok.u}"]`)]
        : [span];
      showTokenOverlay(span, info, group);
    });
    article.appendChild(p);
  }
  container.appendChild(article);

  return {
    getElapsedSec() {
      const current = running ? elapsedMs + (performance.now() - startTs) : elapsedMs;
      return Math.round(current / 1000);
    },
    getClickCount() {
      return openedIds.size;
    },
    getWordCount() {
      return text.paragraphs.reduce(
        (sum, p) => sum + p.filter((t) => !("p" in t)).length,
        0
      );
    },
    stop() {
      pause();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
