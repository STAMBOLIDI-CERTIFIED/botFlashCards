import { api } from "../api.js";
import { esc, fmtDayShort, fmtDuration, fmtMonthTitle, fmtTime, qs } from "../ui.js";

const page = document.getElementById("calendarPage");
const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const HOUR_START = 6;
const HOUR_END = 24;
const HOUR_H = 42;

let month = new Date();
month = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
let selected = null;
let data = null;

function levelClass(reviews) {
  if (!reviews) return "";
  if (reviews < 12) return "cal-day--lvl1";
  if (reviews < 22) return "cal-day--lvl2";
  if (reviews < 32) return "cal-day--lvl3";
  return "cal-day--lvl4";
}

function monthTitle() {
  return fmtMonthTitle(month);
}

function shiftMonth(delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  selected = null;
  load();
}

function selectDay(iso) {
  selected = iso;
  paintGrid();
  paintDayPanel();
}

function paintGrid() {
  const host = qs("[data-cal-grid]", page);
  if (!host || !data) return;
  const [y, m] = data.month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const todayISO = new Date().toDateString();
  const byDate = Object.fromEntries(data.days.map((d) => [d.date, d]));

  let html = "";
  for (let i = 0; i < offset; i++) html += `<span class="cal-day cal-day--empty"></span>`;
  data.days.forEach((d) => {
    const dt = new Date(d.date + "T00:00:00");
    const isToday = dt.toDateString() === todayISO;
    const isSelected = d.date === selected;
    html += `
      <button class="cal-day ${levelClass(d.reviews)} ${isToday ? "cal-day--today" : ""} ${isSelected ? "cal-day--selected" : ""}"
              data-date="${d.date}" role="gridcell" aria-label="${fmtDayShort(d.date)}: ${d.reviews} повторений">
        <span>${dt.getDate()}</span>
        ${d.reviews ? `<span class="cal-day__count">${d.reviews}</span>` : "<span></span>"}
        ${isToday ? `<span class="cal-day__today-dot"></span>` : ""}
      </button>`;
  });
  host.innerHTML = html;
  host.querySelectorAll("[data-date]").forEach((cell) => {
    cell.addEventListener("click", () => selectDay(cell.dataset.date));
  });
  void byDate;
}

function paintDayPanel() {
  const host = qs("[data-day-panel]", page);
  if (!host || !data) return;
  const day = data.days.find((d) => d.date === selected) || data.days[0];
  if (!day) return;
  const dt = new Date(day.date + "T00:00:00");
  const accuracy = day.reviews ? Math.round((day.correct / day.reviews) * 100) : null;
  const isToday = dt.toDateString() === new Date().toDateString();

  const hours = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) hours.push(h);
  const contentH = (HOUR_END - HOUR_START) * HOUR_H;

  const blocks = day.sessions
    .map((s, i) => {
      const startH = s.hour;
      const durH = Math.max(0.55, s.minutes / 60);
      const top = (startH - HOUR_START) * HOUR_H;
      const height = Math.max(38, durH * HOUR_H - 6);
      return `
        <div class="timeline__block" style="top:${top}px; height:${height}px; border-left-color:${esc(s.color || "var(--accent)")}; animation-delay:${i * 60}ms">
          <div class="timeline__block-title">
            <span>${esc(s.deck || "Тренировка")}</span>
          </div>
          <div class="timeline__block-meta">${fmtTime(s.started_at)} · ${s.reviews} карт. · ${fmtDuration(s.minutes)}</div>
        </div>`;
    })
    .join("");

  const nowLine =
    isToday && new Date().getHours() >= HOUR_START
      ? `<div class="timeline__now" style="top:${((new Date().getHours() + new Date().getMinutes() / 60) - HOUR_START) * HOUR_H}px"></div>`
      : "";

  host.innerHTML = `
    <div class="cal-day-panel__head">
      <div class="row row--between">
        <div class="cal-day-panel__date">${dt.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</div>
        ${isToday ? `<span class="badge badge--accent">сегодня</span>` : ""}
      </div>
      <div class="cal-day-panel__stats">
        <div><b>${day.reviews}</b><span>повторений</span></div>
        <div><b>${Math.round(day.minutes)}</b><span>минут</span></div>
        <div><b>${accuracy != null ? `${accuracy}%` : "—"}</b><span>точность</span></div>
        <div><b>${day.sessions.length}</b><span>сессий</span></div>
      </div>
    </div>
    ${
      day.sessions.length
        ? `<div class="timeline">
            <div class="timeline__axis">
              ${hours
                .filter((h) => h % 2 === 0)
                .map((h) => `<span class="timeline__hour" style="top:${(h - HOUR_START) * HOUR_H}px">${String(h % 24).padStart(2, "0")}:00</span>`)
                .join("")}
            </div>
            <div class="timeline__grid">
              ${hours.map((h) => `<div class="timeline__line" style="top:${(h - HOUR_START) * HOUR_H}px"></div>`).join("")}
            </div>
            <div class="timeline__content" style="height:${contentH}px">
              ${nowLine}
              ${blocks}
            </div>
          </div>`
        : `<div class="empty" style="padding: var(--sp-7) var(--sp-4)">
            <div class="empty__art"><svg class="icon"><use href="#i-calendar" /></svg></div>
            <div class="empty__title">Занятий не было</div>
            <p class="empty__text">В этот день карточки не повторялись. Начните тренировку — она появится здесь на таймлайне.</p>
            <div class="empty__actions"><a class="btn btn--primary btn--sm" href="/study">Начать тренировку</a></div>
          </div>`
    }`;

  const timeline = qs(".timeline", host);
  if (timeline) {
    const firstSession = day.sessions[0];
    const top = firstSession ? Math.max(0, (firstSession.hour - HOUR_START) * HOUR_H - 40) : 0;
    timeline.scrollTop = top;
  }
}

function paintShell() {
  page.innerHTML = `
    <div class="stack rise">
      <div class="card card--pad row row--between row--wrap" style="gap: var(--sp-3)">
        <div class="row" style="gap: var(--sp-2)">
          <button class="btn btn--secondary btn--icon" data-prev aria-label="Предыдущий месяц">
            <svg class="icon icon--sm"><use href="#i-chevron-left" /></svg>
          </button>
          <h2 data-cal-title style="text-transform: capitalize; min-width: 170px; text-align: center">${monthTitle()}</h2>
          <button class="btn btn--secondary btn--icon" data-next aria-label="Следующий месяц">
            <svg class="icon icon--sm"><use href="#i-chevron-right" /></svg>
          </button>
          <button class="btn btn--ghost btn--sm" data-today>Сегодня</button>
        </div>
        <div class="row" style="gap: var(--sp-2); flex-wrap: wrap">
          <span class="badge badge--warning">
            <svg class="icon icon--sm" style="width:12px;height:12px"><use href="#i-flame" /></svg>
            <span data-streak>0</span> дн.
          </span>
          <span class="badge"><span data-total-reviews>0</span> повторений</span>
          <span class="badge"><span data-total-min>0</span> мин</span>
        </div>
      </div>

      <div class="cal-layout">
        <section class="card card--pad rise rise-1">
          <div class="cal-month__head">
            <div class="card__title" data-cal-title-2>${monthTitle()}</div>
          </div>
          <div class="cal-dow">${DOW.map((d) => `<span>${d}</span>`).join("")}</div>
          <div class="cal-grid" data-cal-grid role="grid" aria-label="Сетка месяца"></div>
          <div class="cal-legend">
            <span>меньше</span>
            <i style="background: var(--heat-0)"></i>
            <i style="background: var(--heat-1)"></i>
            <i style="background: var(--heat-2)"></i>
            <i style="background: var(--heat-3)"></i>
            <i style="background: var(--heat-4)"></i>
            <span>больше</span>
          </div>
        </section>

        <section class="card card--pad cal-day-panel rise rise-2" data-day-panel></section>
      </div>
    </div>`;

  qs("[data-prev]", page).addEventListener("click", () => shiftMonth(-1));
  qs("[data-next]", page).addEventListener("click", () => shiftMonth(1));
  qs("[data-today]", page).addEventListener("click", () => {
    const now = new Date();
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    selected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    load();
  });

  page.addEventListener("keydown", (e) => {
    if (!selected) return;
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const d = new Date(selected + "T00:00:00");
    d.setDate(d.getDate() + map[e.key]);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    selectDay(iso);
  });
}

async function load() {
  if (!qs("[data-cal-grid]", page)) paintShell();
  try {
    data = await api.get(`/api/calendar?month=${month}`);
    if (!selected) {
      const now = new Date();
      const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const today = data.days.find((d) => d.date === todayISO);
      const withReviews = data.days.filter((d) => d.reviews > 0);
      const latestActive = withReviews.length ? withReviews[withReviews.length - 1].date : null;
      // Default to today only if it has real activity; otherwise the most recent active day.
      selected = today?.reviews > 0 ? todayISO : (latestActive || data.days[Math.floor(data.days.length / 2)].date);
    }
    qs("[data-cal-title]", page).textContent = monthTitle();
    qs("[data-cal-title-2]", page).textContent = monthTitle();
    qs("[data-streak]", page).textContent = data.streak;
    qs("[data-total-reviews]", page).textContent = data.total_reviews;
    qs("[data-total-min]", page).textContent = data.total_minutes;
    paintGrid();
    paintDayPanel();
  } catch (e) {
    page.innerHTML = `<div class="card card--pad"><b>Не удалось загрузить календарь</b><p class="muted">${esc(e.message)}</p></div>`;
  }
}

load();
