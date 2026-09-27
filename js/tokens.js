// Gemeinsame Token-Darstellung für Text und Fragen.
// Satzzeichen hängen am vorigen Wort; danach setzt die App ein Leerzeichen,
// sofern das Satzzeichen nicht selbst mit Leerraum endet.

export function renderTokenStream(parent, tokens, onWordClick) {
  let prev = null;
  tokens.forEach((tok) => {
    const isPunct = "p" in tok;
    if (!isPunct && prev && (!("p" in prev) || !/\s$/.test(prev.p))) {
      parent.appendChild(document.createTextNode(" "));
    }
    if (isPunct) {
      // Satzzeichen dürfen keine Zeile beginnen (z. B. Gedankenstrich)
      parent.appendChild(document.createTextNode(tok.p.replace(/^\s+/, " ")));
    } else {
      const span = document.createElement("span");
      span.className = "token";
      span.textContent = tok.t;
      if (tok.u) span.dataset.unit = tok.u;
      if (onWordClick) span.addEventListener("click", (e) => {
        if (e.target !== span) return; // Tipp ins Fenster selbst: schließt über den Dokument-Handler
        onWordClick(span, tok);
      });
      parent.appendChild(span);
    }
    prev = tok;
  });
}

// Es ist immer höchstens ein Wortfenster offen.
let open = null; // { pop, group }

export function closePopover() {
  if (!open) return;
  open.pop.remove();
  open.group.forEach((s) => {
    s.classList.remove("is-open");
    s.classList.add("is-seen");
  });
  open = null;
}

document.addEventListener("click", (e) => {
  if (open && !open.group.some((s) => s === e.target)) closePopover();
}, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePopover(); });

// Öffnet das Fenster eines Wortes (oder einer Mehrwort-Einheit); erneuter Tipp schließt es.
export function togglePopover(span, info, group = [span]) {
  const wasThis = open && open.group.includes(span);
  closePopover();
  if (wasThis) return;

  const pop = document.createElement("span");
  pop.className = "pop";
  pop.setAttribute("role", "tooltip");
  pop.innerHTML = `
    <span class="pop-form" lang="uk">${escapeHtml(info.a ?? info.t ?? "")}</span>
    <span class="pop-gloss">${escapeHtml(info.g ?? "")}</span>
    <span class="pop-gram">${escapeHtml(formatMorph(info.pos, info.m))}</span>
    <svg class="pop-tip" viewBox="0 0 44 14" aria-hidden="true">
      <path class="pop-tip-fill" d="M0 -1H44V0C32 0 26 1.5 22 14C18 1.5 12 0 0 0Z"/>
      <path class="pop-tip-line" d="M0 0.5C12 0.5 18 2 22 13.5C26 2 32 0.5 44 0.5"/>
    </svg>`;
  span.appendChild(pop);
  group.forEach((s) => s.classList.add("is-open"));
  open = { pop, group };
  place(span, pop);
}

function place(span, pop) {
  const EDGE = 12;
  const GAP = 17;
  const s = span.getBoundingClientRect();
  const p = pop.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const bar = document.querySelector(".bar");
  const topLimit = (bar ? bar.getBoundingClientRect().bottom : 0) + 6;

  const center = s.left + s.width / 2;
  const left = Math.min(Math.max(center - p.width / 2, EDGE), vw - EDGE - p.width);
  const above = s.top - GAP - p.height >= topLimit;

  pop.style.left = `${left - s.left}px`;
  pop.style.top = above ? `${-p.height - GAP}px` : `${s.height + GAP}px`;
  pop.classList.add(above ? "is-above" : "is-below");
  pop.style.setProperty("--tip-x", `${Math.min(Math.max(center - left, 30), p.width - 30)}px`);
}

export function formatMorph(pos, m) {
  const parts = [pos];
  if (m) {
    for (const key of ["gen", "num", "case", "asp", "tense", "pers", "mood", "deg"]) {
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
