// Statistik je Stufe: drei Liniendiagramme (Zeit/100 Wörter, Klicks, korrekte Antworten) als eigenes SVG.
export function renderStats(container, attempts, level) {
  container.innerHTML = "";
  const filtered = attempts
    .filter((a) => a.level === level)
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));

  if (filtered.length === 0) {
    const p = document.createElement("p");
    p.className = "stats-empty";
    p.textContent = "Noch keine Daten für diese Stufe.";
    container.appendChild(p);
    return;
  }

  const secPer100 = filtered.map((a) => (a.sec / Math.max(a.words, 1)) * 100);
  const clicks = filtered.map((a) => a.clicks);
  const correct = filtered.map((a) => a.correct);

  container.appendChild(chart("Zeit (s / 100 Wörter)", secPer100));
  container.appendChild(chart("Klicks", clicks));
  container.appendChild(chart("Richtige Antworten (von 5)", correct, 5));
}

function chart(title, values, fixedMax) {
  const wrap = document.createElement("div");
  wrap.className = "chart";
  const h3 = document.createElement("h3");
  h3.textContent = title;
  wrap.appendChild(h3);

  const width = Math.max(240, values.length * 28);
  const height = 100;
  const pad = 12;
  const max = fixedMax ?? Math.max(...values, 1);
  const min = 0;

  const stepX = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((v - min) / (max - min || 1)) * (height - 2 * pad);
    return [x, y];
  });

  const pointsAttr = points.map(([x, y]) => `${x},${y}`).join(" ");
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", height);
  svg.classList.add("chart-svg");

  const polyline = document.createElementNS(svgNs, "polyline");
  polyline.setAttribute("points", pointsAttr);
  polyline.setAttribute("class", "chart-line");
  svg.appendChild(polyline);

  for (const [x, y] of points) {
    const c = document.createElementNS(svgNs, "circle");
    c.setAttribute("cx", x);
    c.setAttribute("cy", y);
    c.setAttribute("r", 2.5);
    c.setAttribute("class", "chart-dot");
    svg.appendChild(c);
  }

  const scroller = document.createElement("div");
  scroller.className = "chart-scroll";
  scroller.appendChild(svg);
  wrap.appendChild(scroller);
  return wrap;
}
