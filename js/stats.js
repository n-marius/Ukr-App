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

  const secPer100 = filtered.map((a) => Math.round((a.sec / Math.max(a.words, 1)) * 100));
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

  const width = Math.max(240, values.length * 32);
  const height = 120;
  const padTop = 16;
  const padBottom = 24;
  const padX = 14;
  const max = fixedMax ?? Math.max(...values, 1);
  const min = 0;
  const plotHeight = height - padTop - padBottom;

  const stepX = values.length > 1 ? (width - 2 * padX) / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = values.length > 1 ? padX + i * stepX : width / 2;
    const y = padTop + plotHeight - ((v - min) / (max - min || 1)) * plotHeight;
    return [x, y];
  });

  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", values.length > 1 ? Math.max(width, 240) : "100%");
  svg.setAttribute("height", height);
  svg.classList.add("chart-svg");

  const baseline = document.createElementNS(svgNs, "line");
  baseline.setAttribute("x1", padX);
  baseline.setAttribute("x2", width - padX);
  baseline.setAttribute("y1", padTop + plotHeight);
  baseline.setAttribute("y2", padTop + plotHeight);
  baseline.setAttribute("class", "chart-baseline");
  svg.appendChild(baseline);

  if (points.length > 1) {
    const pointsAttr = points.map(([x, y]) => `${x},${y}`).join(" ");
    const polyline = document.createElementNS(svgNs, "polyline");
    polyline.setAttribute("points", pointsAttr);
    polyline.setAttribute("class", "chart-line");
    svg.appendChild(polyline);
  }

  points.forEach(([x, y], i) => {
    const c = document.createElementNS(svgNs, "circle");
    c.setAttribute("cx", x);
    c.setAttribute("cy", y);
    c.setAttribute("r", 3);
    c.setAttribute("class", "chart-dot");
    svg.appendChild(c);

    const label = document.createElementNS(svgNs, "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y - 8);
    label.setAttribute("class", "chart-value");
    label.setAttribute("text-anchor", i === 0 ? "start" : i === points.length - 1 ? "end" : "middle");
    label.textContent = values[i];
    svg.appendChild(label);
  });

  const scroller = document.createElement("div");
  scroller.className = "chart-scroll";
  scroller.appendChild(svg);
  wrap.appendChild(scroller);
  return wrap;
}
