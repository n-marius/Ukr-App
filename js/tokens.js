// Gemeinsame Token-Darstellung für Reader und Quiz: korrekte Zeichensetzung
// (Satzzeichen hängen am Wort davor, Leerzeichen kommt automatisch danach)
// und ein Overlay, das nie über den sichtbaren Bereich hinausragt.

export function renderTokenStream(parent, tokens, onWordClick) {
  let prevType = null;
  tokens.forEach((tok, i) => {
    const isPunct = "p" in tok;

    if (!isPunct && prevType === "word") {
      parent.appendChild(document.createTextNode(" "));
    }
    if (!isPunct && prevType === "punct" && !/\s$/.test(tokens[i - 1].p)) {
      parent.appendChild(document.createTextNode(" "));
    }

    if (isPunct) {
      parent.appendChild(document.createTextNode(tok.p));
    } else {
      const span = document.createElement("span");
      span.className = "token";
      span.textContent = tok.t;
      if (tok.u) span.dataset.unit = tok.u;
      if (onWordClick) span.addEventListener("click", () => onWordClick(span, tok));
      parent.appendChild(span);
    }
    prevType = isPunct ? "punct" : "word";
  });
}

export function showTokenOverlay(span, info, groupSpans = [span]) {
  const existing = groupSpans.map((s) => s.querySelector(".token-overlay")).find(Boolean);
  if (existing) {
    existing.remove();
    groupSpans.forEach((s) => s.classList.remove("token-open"));
    return;
  }

  const morph = formatMorph(info.pos, info.m);
  const overlay = document.createElement("span");
  overlay.className = "token-overlay";
  overlay.innerHTML = `
    <span class="ov-accent">${escapeHtml(info.a ?? info.t ?? "")}</span>
    <span class="ov-gloss">${escapeHtml(info.g ?? "")}</span>
    <span class="ov-morph">${escapeHtml(morph)}</span>
  `;
  span.appendChild(overlay);
  groupSpans.forEach((s) => s.classList.add("token-open"));

  const HEADER_SAFE = 64;
  const EDGE_MARGIN = 10;
  const rect = overlay.getBoundingClientRect();

  if (rect.top < HEADER_SAFE) overlay.classList.add("below");
  if (rect.right > window.innerWidth - EDGE_MARGIN) overlay.classList.add("align-right");
  const after = overlay.getBoundingClientRect();
  if (after.left < EDGE_MARGIN) overlay.classList.remove("align-right");
}

export function formatMorph(pos, m) {
  const parts = [pos];
  if (m) {
    const order = ["gen", "num", "case", "asp", "tense", "pers", "mood", "deg"];
    for (const key of order) {
      if (m[key] !== undefined) parts.push(String(m[key]));
    }
    if (m.inf) parts.push("Inf");
  }
  return parts.filter(Boolean).join(" · ");
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
