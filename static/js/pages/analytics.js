import { api } from "../api.js";
import { areaChart, hbars, heatmap, stackBars, weekdayBars } from "../charts.js";
import { esc, nodeFrom, qs, qsa } from "../ui.js";

const page = document.getElementById("analyticsPage");
let days = 90;

function statCard(label, value, sub, icon, tone = "") {
  return `
    <section class="card stat">
      <div class="stat__label"><svg class="icon icon--sm"><use href="#${icon}" /></svg> ${label}</div>
      <div class="stat__value">${value}</div>
      <div class="stat__foot"><span class="badge ${tone}">${sub}</span></div>
    </section>`;
}

function renderEmpty() {
  const host = qs("#anStats", page);
  if (host) host.innerHTML = "";
  const main = qs("#anMainChart", page);
  if (main) {
    main.innerHTML = `
      <div class="empty" style="padding: var(--sp-7) var(--sp-4)">
        <div class="empty__art"><svg class="icon"><use href="#i-chart" /></svg></div>
        <div class="empty__title">Пока нет данных</div>
        <p class="empty__text">Как только вы повторите первые карточки, здесь появятся графики прогресса.</p>
        <div class="empty__actions"><a class="btn btn--primary btn--sm" href="/study">Начать тренировку</a></div>
      </div>`;
  }
}

async function load() {
  if (!qs("#anRange", page)) {
    page.innerHTML = "";
    page.appendChild(nodeFrom("tplAnalytics"));
    qsa("#anRange [data-days]", page).forEach((btn) => {
      btn.addEventListener("click", () => {
        days = Number(btn.dataset.days);
        qsa("#anRange [data-days]", page).forEach((b) => b.classList.toggle("is-active", b === btn));
        load();
      });
    });
  }

  try {
    const d = await api.get(`/api/analytics?days=${days}`);
    const t = d.totals;

    qs("#anSummary", page).innerHTML = `
      <span class="badge badge--accent">${t.cards} карточек</span>
      <span class="badge badge--success">${t.mature} выучено</span>`;

    qs("#anStats", page).innerHTML = [
      statCard("Повторений", t.reviews, `за ${days === 365 ? "год" : days + " дн."}`, "i-zap", "badge--accent"),
      statCard("Время обучения", `${t.minutes}`, "минут", "i-clock", ""),
      statCard("Точность", `${t.accuracy}%`, "ответов «вспомнил»", "i-check-circle", "badge--success"),
      statCard("Активных дней", t.active_days, "из выбранного периода", "i-calendar", ""),
    ].join("");

    if (!t.reviews) {
      renderEmpty();
      return;
    }

    areaChart(qs("#anMainChart", page), d.series, { height: 260 });

    const gradesTotal = Math.max(1, d.grades.reduce((s, g) => s + g.count, 0));
    const gradeColors = { 0: "var(--danger)", 1: "var(--warning)", 2: "var(--success)", 3: "var(--info)" };
    hbars(
      qs("#anGrades", page),
      d.grades.map((g) => ({
        label: g.label,
        value: g.count,
        display: `${g.count} · ${Math.round((g.count / gradesTotal) * 100)}%`,
        color: gradeColors[g.grade],
      }))
    );

    weekdayBars(qs("#anWeekday", page), d.weekday_minutes);
    stackBars(qs("#anMastery", page), d.decks);
    heatmap(qs("#anHeatmap", page), d.heatmap);
  } catch (e) {
    page.innerHTML = `<div class="card card--pad"><b>Ошибка загрузки</b><p class="muted">${esc(e.message)}</p></div>`;
  }
}

load();
