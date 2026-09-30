// Prio-Symbol (Vorbild: Lernapp js/tokens.js): antippbar auf der Karte, als Filter in der Auswahl.

// ---------- Prio-Symbol (antippbar, siehe SPEC.md Abschnitt 12.4) ----------

export const PRIO_LABEL = { hoch: "Hohe Priorität", normal: "Normale Priorität", niedrig: "Niedrige Priorität" };

// Prio-Symbol als ein einziges SVG (Koordinaten 0–100): „Squircle“-Fläche
// (Superellipse, weicher als ein CSS-Radius), feiner Innenring, darauf das
// Zeichen. Die Dreiecke sind über einen runden Strich weich gerundet und
// optisch zur Spitze hin verschoben, damit sie mittig wirken. Abgeschaltet
// (Filter): Zeichen blass, diagonaler Strich mit echter Aussparung.
const SQUIRCLE = (() => {
  const n = 4.6, r = 49, pts = [];
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * 2 * Math.PI, c = Math.cos(t), si = Math.sin(t);
    pts.push(`${(50 + r * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(2)} ${(50 + r * Math.sign(si) * Math.abs(si) ** (2 / n)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
})();

const PRIO_GLYPH = {
  hoch: `<path d="M50 32.5 67.5 62.5H32.5Z" stroke-width="9" stroke-linejoin="round"/>`,
  normal: `<path d="M35 50H65" stroke-width="10" stroke-linecap="round"/>`,
  niedrig: `<path d="M50 67.5 67.5 37.5H32.5Z" stroke-width="9" stroke-linejoin="round"/>`,
};

let prioMaskId = 0;

export function prioIcon(prio, off = false) {
  const glyph = PRIO_GLYPH[prio] ?? PRIO_GLYPH.normal;
  const id = `prio-cut-${++prioMaskId}`;
  const cut = off
    ? `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><path d="M25 25 75 75" stroke="#000" stroke-width="9" stroke-linecap="round"/></mask>`
    : "";
  return `<svg class="prio-icon" viewBox="0 0 100 100" aria-hidden="true">${cut}` +
    `<path class="prio-bg" d="${SQUIRCLE}"/>` +
    `<g class="prio-glyph"${off ? ` mask="url(#${id})"` : ""}>${glyph}</g>` +
    (off ? `<path class="prio-slash" d="M25 25 75 75"/>` : "") +
    `</svg>`;
}

export function prioChip(prio) {
  const label = PRIO_LABEL[prio] ?? PRIO_LABEL.normal;
  return `<button type="button" class="prio-btn" data-prio="${prio}" aria-label="${label} – antippen zum Ändern">${prioIcon(prio)}</button>`;
}

export function updatePrioChip(btn, prio) {
  const label = PRIO_LABEL[prio] ?? PRIO_LABEL.normal;
  btn.dataset.prio = prio;
  btn.setAttribute("aria-label", `${label} – antippen zum Ändern`);
  btn.innerHTML = prioIcon(prio);
}

// Filter-Knopf oberhalb der Rechtsgebietswahl (gleiches Symbol, gleiche Farben).
export function prioToggle(prio, active) {
  const label = PRIO_LABEL[prio] ?? PRIO_LABEL.normal;
  return `<button type="button" class="prio-toggle-btn" data-prio="${prio}" data-active="${active}" aria-pressed="${active}" aria-label="${label}${active ? "" : " (ausgeblendet)"}">${prioIcon(prio, !active)}</button>`;
}
