// Statistik je Stufe: drei kleine Liniendiagramme als eigenes SVG.
// Die x-Achse hat feste Breite; mit wachsender Zahl an Texten rücken die Punkte zusammen.
const NS = "http://www.w3.org/2000/svg";

export function renderStats(container, attempts, level) {
  container.innerHTML = "";
  const list = attempts
    .filter((a) => a.level === level)
    .sort((a, b) => a.ts.localeCompare(b.ts));

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <p class="empty-title">Noch keine Daten</p>
        <p class="empty-sub">Sobald du einen Text der Stufe ${level} bearbeitet hast, erscheint hier dein Verlauf.</p>
      </div>`;
    return;
  }

  const count = document.createElement("p");
  count.className = "stats-count";
  count.textContent = `${list.length} ${list.length === 1 ? "Text" : "Texte"} bearbeitet`;
  container.appendChild(count);

  const pace = list.map((a) => Math.round((a.sec / Math.max(a.words, 1)) * 100));
  const clicks = list.map((a) => a.clicks);
  const correct = list.map((a) => a.correct);
  const last = list[list.length - 1];

  container.append(
    metric({
      name: "Pace",
      value: pace.at(-1),
      unit: "s / 100 Wörter",
      sub: `Tempo ${wpm(last)} Wörter / min · Lesezeit ${formatDuration(last.sec)} · Ø ${avg(pace)} s`,
      values: pace,
    }),
    metric({
      name: "Nachgeschlagen",
      value: clicks.at(-1),
      unit: clicks.at(-1) === 1 ? "Wort" : "Wörter",
      sub: `Ø ${avg(clicks)} pro Text`,
      values: clicks,
    }),
    metric({
      name: "Richtige Antworten",
      value: correct.at(-1),
      unit: "von 5",
      sub: `Ø ${avg(correct, 1)} von 5`,
      values: correct,
      max: 5,
    })
  );

  for (const svg of container.querySelectorAll("svg.chart")) drawChart(svg);
}

function wpm(a) {
  return a.sec > 0 ? Math.round((a.words / a.sec) * 60) : 0;
}

function metric({ name, value, unit, sub, values, max }) {
  const el = document.createElement("section");
  el.className = "metric";
  el.innerHTML = `
    <div class="metric-head">
      <span class="metric-name">${name}</span>
      <span class="metric-value">${value}<span class="metric-unit">${unit}</span></span>
    </div>
    <div class="metric-sub">${sub}</div>`;
  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("chart");
  svg.dataset.values = JSON.stringify(values);
  if (max !== undefined) svg.dataset.max = String(max);
  el.appendChild(svg);
  return el;
}

function drawChart(svg) {
  const values = JSON.parse(svg.dataset.values);
  const width = Math.max(svg.clientWidth, 200);
  const height = svg.clientHeight || 104;
  const padL = 2, padR = 28, padT = 8, padB = 8;
  const max = svg.dataset.max ? Number(svg.dataset.max) : niceMax(Math.max(...values));
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const x = (i) => (values.length === 1 ? padL + plotW / 2 : padL + (i / (values.length - 1)) * plotW);
  const y = (v) => padT + plotH - (v / max) * plotH;

  for (const t of [0, max / 2, max]) {
    add(svg, "line", { x1: padL, x2: padL + plotW, y1: y(t), y2: y(t), class: "grid" });
    const label = add(svg, "text", { x: width, y: y(t) + 3.5, "text-anchor": "end", class: "axis" });
    label.textContent = formatTick(t);
  }

  const pts = values.map((v, i) => [x(i), y(v)]);
  if (pts.length > 1) {
    const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
    add(svg, "path", { d: `${d}L${pts.at(-1)[0].toFixed(1)},${y(0)}L${pts[0][0].toFixed(1)},${y(0)}Z`, class: "area" });
    add(svg, "path", { d, class: "line" });
  }
  const showAll = pts.length <= 16;
  pts.forEach(([px, py], i) => {
    const isLast = i === pts.length - 1;
    if (isLast || showAll) add(svg, "circle", { cx: px, cy: py, r: isLast ? 4 : 2.5, class: isLast ? "dot-last" : "dot" });
  });
}

function add(parent, tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent.appendChild(el);
  return el;
}

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * pow >= v) return step * pow;
  }
  return 10 * pow;
}

function formatTick(t) {
  return Number.isInteger(t) ? String(t) : t.toFixed(1).replace(".", ",");
}

function avg(values, digits = 0) {
  const a = values.reduce((s, v) => s + v, 0) / values.length;
  return a.toFixed(digits).replace(".", ",");
}

export function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")} min` : `${s} s`;
}

// ---------- Vokabeln: Karten pro Tag ----------

const dayKey = (iso) => iso.slice(0, 10); // UTC-Datum wie in der Lernapp

// Zahl der heute bearbeiteten Karten (alle Modi, beide Richtungen).
export function countToday(events) {
  const today = dayKey(new Date().toISOString());
  return events.filter((e) => dayKey(e.ts) === today).length;
}

const DAYS_AVG = 14;

export function renderVocabStats(container, events) {
  container.innerHTML = "";
  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <p class="empty-title">Noch keine Daten</p>
        <p class="empty-sub">Sobald Vokabeln bearbeitet werden, erscheint hier der Verlauf.</p>
      </div>`;
    return;
  }
  const todayKey = dayKey(new Date().toISOString());
  const first = events.map((e) => dayKey(e.ts)).reduce((m, k) => (k < m ? k : m), todayKey);
  const days = [];
  for (let t = Date.parse(first); t <= Date.parse(todayKey); t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  const counts = new Map();
  for (const e of events) counts.set(dayKey(e.ts), (counts.get(dayKey(e.ts)) ?? 0) + 1);
  const values = days.map((d) => counts.get(d) ?? 0);
  const recent = values.slice(-DAYS_AVG);
  const a = recent.reduce((s, v) => s + v, 0) / recent.length;

  const el = document.createElement("section");
  el.className = "metric";
  el.innerHTML = `
    <div class="metric-head">
      <span class="metric-name">Karten pro Tag</span>
      <span class="metric-value">${values.at(-1)}<span class="metric-unit">heute</span></span>
    </div>
    <div class="metric-sub">Ø ${a.toFixed(1).replace(".", ",")} pro Tag · ${recent.length === 1 ? "heute" : `letzte ${recent.length} Tage`} · ${events.length} ${events.length === 1 ? "Karte" : "Karten"} insgesamt</div>`;
  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("chart");
  el.appendChild(svg);
  container.appendChild(el);
  drawDayChart(svg, values, days.map((d) => d.slice(8, 10)));
}

function drawDayChart(svg, values, labels) {
  const width = Math.max(svg.clientWidth, 200);
  const height = svg.clientHeight || 104;
  const padL = 2, padR = 28, padT = 8, padB = 16;
  const max = niceMax(Math.max(...values, 1));
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const x = (i) => (values.length === 1 ? padL + plotW / 2 : padL + (i / (values.length - 1)) * plotW);
  const y = (v) => padT + plotH - (v / max) * plotH;

  for (const t of [0, max / 2, max]) {
    add(svg, "line", { x1: padL, x2: padL + plotW, y1: y(t), y2: y(t), class: "grid" });
    add(svg, "text", { x: width, y: y(t) + 3.5, "text-anchor": "end", class: "axis" }).textContent = formatTick(t);
  }
  const pts = values.map((v, i) => [x(i), y(v)]);
  if (pts.length > 1) {
    const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
    add(svg, "path", { d: `${d}L${pts.at(-1)[0].toFixed(1)},${y(0)}L${pts[0][0].toFixed(1)},${y(0)}Z`, class: "area" });
    add(svg, "path", { d, class: "line" });
  }
  pts.forEach(([px, py], i) => {
    const isLast = i === pts.length - 1;
    add(svg, "circle", { cx: px, cy: py, r: isLast ? 4 : 2.5, class: isLast ? "dot-last" : "dot" });
    if (i % Math.ceil(labels.length / 7 || 1) === 0 || isLast) add(svg, "text", { x: px, y: height - 2, "text-anchor": "middle", class: "axis" }).textContent = labels[i] ?? "";
  });
}
