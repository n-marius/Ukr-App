// Textanzeige: klickbare Tokens, Overlay, Timer, Klickzählung distinkter Wörter/Einheiten.
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
    for (const tok of paragraph) {
      if ("p" in tok) {
        p.appendChild(document.createTextNode(tok.p));
        continue;
      }
      const id = tok.u ?? `w${tokenSeq++}`;
      const span = document.createElement("span");
      span.className = "token";
      span.textContent = tok.t;
      span.dataset.id = id;
      span.addEventListener("click", () => toggleOverlay(span, tok, id, text.units));
      p.appendChild(span);
      p.appendChild(document.createTextNode(" "));
    }
    article.appendChild(p);
  }
  container.appendChild(article);

  function toggleOverlay(span, tok, id, units) {
    const existing = span.querySelector(".token-overlay");
    if (existing) {
      existing.remove();
      span.classList.remove("token-open");
      return;
    }
    if (!openedIds.has(id)) openedIds.add(id);

    const info = tok.u ? { ...units[tok.u], a: tok.a } : tok;
    const overlay = document.createElement("span");
    overlay.className = "token-overlay";
    const morph = formatMorph(info.pos, info.m);
    overlay.innerHTML = `
      <span class="ov-accent">${escapeHtml(info.a ?? tok.t)}</span>
      <span class="ov-gloss">${escapeHtml(info.g ?? "")}</span>
      <span class="ov-morph">${escapeHtml(morph)}</span>
    `;
    span.appendChild(overlay);
    span.classList.add("token-open");
  }

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

function formatMorph(pos, m) {
  const parts = [pos];
  if (!m) return parts.filter(Boolean).join(" · ");
  const order = ["gen", "num", "case", "asp", "tense", "pers", "mood", "deg"];
  for (const key of order) {
    if (m[key] !== undefined) parts.push(String(m[key]));
  }
  if (m.inf) parts.push("Inf");
  return parts.filter(Boolean).join(" · ");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
