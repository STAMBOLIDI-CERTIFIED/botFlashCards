import { esc } from "./ui.js";

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function tooltipEl() {
  return document.getElementById("chartTooltip");
}

export function showTooltip(html, x, y) {
  const t = tooltipEl();
  if (!t) return;
  t.innerHTML = html;
  const left = Math.min(window.innerWidth - 200, Math.max(8, x + 14));
  const top = Math.max(8, y - 46);
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
  t.classList.add("is-visible");
}

export function hideTooltip() {
  tooltipEl()?.classList.remove("is-visible");
}

function niceMax(v) {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / pow;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * pow;
}

/* ——— Area + line combo chart ——— */
export function areaChart(container, data, { height = 220, valueKey = "reviews", lineKey = "accuracy" } = {}) {
  if (!container) return;
  let ro;

  function render() {
    const width = Math.max(280, container.clientWidth || container.parentElement?.clientWidth || 600);
    const pad = { t: 14, r: 10, b: 24, l: 34 };
    const iw = width - pad.l - pad.r;
    const ih = height - pad.t - pad.b;
    const n = data.length;
    const values = data.map((d) => d[valueKey] || 0);
    const maxV = niceMax(Math.max(1, ...values));
    const x = (i) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => pad.t + ih - (v / maxV) * ih;

    const pts = values.map((v, i) => [x(i), y(v)]);
    const linePath = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${x(n - 1).toFixed(1)} ${(pad.t + ih).toFixed(1)} L${x(0).toFixed(1)} ${(pad.t + ih).toFixed(1)} Z`;

    const hasLine = data.some((d) => d[lineKey] != null);
    const linePts = data
      .map((d, i) => (d[lineKey] == null ? null : [x(i), pad.t + ih - (d[lineKey] / 100) * ih]))
      .filter(Boolean);
    const line2Path = linePts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

    const gridVals = [0, maxV / 2, maxV];
    const grid = gridVals
      .map(
        (v) =>
          `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" stroke-dasharray="3 5" />
           <text x="${pad.l - 8}" y="${y(v) + 3.5}" text-anchor="end" font-size="10" fill="var(--text-3)" font-weight="500">${v}</text>`
      )
      .join("");

    const tickCount = Math.min(6, n);
    const tickIdx = [...new Set(Array.from({ length: tickCount }, (_, i) => Math.round((i * (n - 1)) / Math.max(1, tickCount - 1))))];
    const xLabels = tickIdx
      .map((i) => {
        const d = new Date(data[i].date + "T00:00:00");
        return `<text x="${x(i)}" y="${height - 6}" text-anchor="middle" font-size="10" fill="var(--text-3)" font-weight="500">${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}</text>`;
      })
      .join("");

    container.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" height="${height}" role="img">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}
        <path d="${areaPath}" fill="url(#areaGrad)" opacity="0" class="ch-area"/>
        <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ch-line"/>
        ${hasLine && line2Path ? `<path d="${line2Path}" fill="none" stroke="var(--success)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.75" class="ch-line2"/>` : ""}
        ${xLabels}
        <line class="ch-guide" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + ih}" stroke="var(--border-strong)" stroke-width="1" opacity="0"/>
        <circle class="ch-dot" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2" opacity="0"/>
        <rect class="ch-hit" x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent"/>
      </svg>`;

    const svg = container.querySelector("svg");
    const area = svg.querySelector(".ch-area");
    const guide = svg.querySelector(".ch-guide");
    const dot = svg.querySelector(".ch-dot");
    const hit = svg.querySelector(".ch-hit");

    requestAnimationFrame(() => {
      area.style.transition = "opacity 700ms cubic-bezier(.22,1,.36,1)";
      area.style.opacity = "1";
    });

    function move(clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      const relX = ((clientX - rect.left) / rect.width) * width;
      const idx = n <= 1 ? 0 : Math.round(((relX - pad.l) / iw) * (n - 1));
      const i = Math.max(0, Math.min(n - 1, idx));
      const px = x(i);
      const py = y(values[i]);
      guide.setAttribute("x1", px);
      guide.setAttribute("x2", px);
      guide.setAttribute("opacity", "0.7");
      dot.setAttribute("cx", px);
      dot.setAttribute("cy", py);
      dot.setAttribute("opacity", "1");
      const d = data[i];
      const date = new Date(d.date + "T00:00:00");
      const acc = d[lineKey] != null ? ` · <b>${d[lineKey]}%</b> точность` : "";
      showTooltip(
        `<b>${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}</b> · ${d[valueKey] || 0} повторений${acc}`,
        clientX,
        clientY
      );
    }
    hit.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
    hit.addEventListener("mouseleave", () => {
      guide.setAttribute("opacity", "0");
      dot.setAttribute("opacity", "0");
      hideTooltip();
    });
    hit.addEventListener(
      "touchmove",
      (e) => {
        const t = e.touches[0];
        move(t.clientX, t.clientY);
      },
      { passive: true }
    );
  }

  render();
  if (ro) ro.disconnect();
  ro = new ResizeObserver(() => render());
  ro.observe(container);
}

/* ——— Sparkline ——— */
export function sparkline(container, values, { color = "var(--accent)", width = 110, height = 40 } = {}) {
  if (!container || !values.length) return;
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - 4 - ((v - min) / span) * (height - 10);
    return [x, y];
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${id})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

/* ——— Weekday bars ——— */
export function weekdayBars(container, values, { height = 150 } = {}) {
  if (!container) return;
  const labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const width = Math.max(260, container.clientWidth || 320);
  const pad = { t: 10, b: 24, l: 4, r: 4 };
  const ih = height - pad.t - pad.b;
  const max = Math.max(1, ...values);
  const gap = 10;
  const bw = (width - pad.l - pad.r - gap * 6) / 7;
  const bars = values
    .map((v, i) => {
      const h = (v / max) * ih;
      const x = pad.l + i * (bw + gap);
      const y = pad.t + ih - h;
      const today = (new Date().getDay() + 6) % 7 === i;
      return `
        <rect x="${x}" y="${y}" width="${bw}" height="${Math.max(v > 0 ? 4 : 2, h)}" rx="6"
              fill="${today ? "var(--accent)" : "var(--accent-soft)"}" data-wd="${i}" data-val="${v}"
              style="cursor: default"/>
        <text x="${x + bw / 2}" y="${height - 7}" text-anchor="middle" font-size="10.5" font-weight="600"
              fill="${today ? "var(--accent)" : "var(--text-3)"}">${labels[i]}</text>`;
    })
    .join("");
  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" height="${height}">
      ${bars}
    </svg>`;
  container.querySelectorAll("rect[data-wd]").forEach((rect) => {
    rect.addEventListener("mouseenter", (e) => {
      showTooltip(`<b>${labels[+rect.dataset.wd]}</b> · ${rect.dataset.val} мин`, e.clientX, e.clientY);
      rect.style.opacity = "0.85";
    });
    rect.addEventListener("mousemove", (e) => showTooltip(`<b>${labels[+rect.dataset.wd]}</b> · ${rect.dataset.val} мин`, e.clientX, e.clientY));
    rect.addEventListener("mouseleave", () => {
      hideTooltip();
      rect.style.opacity = "1";
    });
  });
}

/* ——— Heatmap (12 weeks) ——— */
export function heatmap(container, days) {
  if (!container) return;
  const first = new Date(days[0].date + "T00:00:00");
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  days.forEach((d) => cells.push(d));
  while (cells.length % 7) cells.push(null);

  const html = cells
    .map((d) => {
      if (!d) return `<span class="heatmap__cell" style="visibility:hidden"></span>`;
      const lvl = d.reviews === 0 ? 0 : d.reviews < 12 ? 1 : d.reviews < 22 ? 2 : d.reviews < 32 ? 3 : 4;
      const date = new Date(d.date + "T00:00:00");
      return `<span class="heatmap__cell ${lvl ? `heatmap__cell--${lvl}` : ""}" data-date="${esc(d.date)}" data-reviews="${d.reviews}" title="${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}: ${d.reviews}"></span>`;
    })
    .join("");
  container.innerHTML = `<div class="heatmap">${html}</div>`;
  container.querySelectorAll("[data-reviews]").forEach((cell) => {
    cell.addEventListener("mouseenter", (e) => {
      const date = new Date(cell.dataset.date + "T00:00:00");
      showTooltip(`<b>${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}</b> · ${cell.dataset.reviews} повторений`, e.clientX, e.clientY);
    });
    cell.addEventListener("mouseleave", hideTooltip);
  });
}

/* ——— Horizontal bars (pure DOM) ——— */
export function hbars(container, rows, { colors = ["var(--accent)"] } = {}) {
  if (!container) return;
  const max = Math.max(1, ...rows.map((r) => r.value));
  container.innerHTML = rows
    .map(
      (r, i) => `
      <div class="hbar-row">
        <span class="hbar-row__label">${esc(r.label)}</span>
        <span class="hbar-row__track"><span class="hbar-row__fill" data-w="${Math.round((r.value / max) * 100)}%" style="background: ${r.color || colors[i % colors.length]}"></span></span>
        <span class="hbar-row__value">${r.display ?? r.value}</span>
      </div>`
    )
    .join("");
  requestAnimationFrame(() => {
    container.querySelectorAll(".hbar-row__fill").forEach((f) => {
      f.style.width = f.dataset.w;
    });
  });
}

/* ——— Stacked bars for deck mastery ——— */
export function stackBars(container, decks) {
  if (!container) return;
  if (!decks.length) {
    container.innerHTML = `<p class="muted" style="font-size: var(--fs-sm)">Пока нет колод</p>`;
    return;
  }
  container.innerHTML = decks
    .map((d) => {
      const total = Math.max(1, d.new + d.learning + d.mature);
      return `
        <div style="margin-bottom: 14px">
          <div class="row row--between" style="margin-bottom: 6px; font-size: var(--fs-sm)">
            <span class="row" style="gap: 7px; min-width: 0">
              <i style="width: 8px; height: 8px; border-radius: 50%; background: ${esc(d.color)}; flex-shrink: 0"></i>
              <span class="truncate" style="font-weight: 600">${esc(d.name)}</span>
            </span>
            <span class="faint num">${d.cards}</span>
          </div>
          <div class="stack-bar">
            <span style="width: ${(d.new / total) * 100}%; background: var(--surface-3)"></span>
            <span style="width: ${(d.learning / total) * 100}%; background: var(--warning)"></span>
            <span style="width: ${(d.mature / total) * 100}%; background: var(--success)"></span>
          </div>
        </div>`;
    })
    .join("");
}
