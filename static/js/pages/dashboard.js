import { api } from "../api.js";
import { areaChart, sparkline } from "../charts.js";
import { countUp, esc, fmtDuration, fmtTime, qs, relDayLabel } from "../ui.js";

const page = document.getElementById("dashboardPage");
const DOW = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

function ring(pct, size = 64, stroke = 6) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, pct));
  return `
    <svg class="ring" width="${size}" height="${size}">
      <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="ring__value" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-ring-offset="${offset.toFixed(1)}"/>
    </svg>`;
}

function emptyState() {
  return `
    <div class="card">
      <div class="empty">
        <div class="empty__art"><svg class="icon"><use href="#i-cards" /></svg></div>
        <div class="empty__title">Начните с первой колоды</div>
        <p class="empty__text">Создайте колоду карточек — Lingua Flow сам построит расписание повторений и покажет прогресс.</p>
        <div class="empty__actions">
          <a class="btn btn--primary" href="/decks">Создать колоду</a>
        </div>
      </div>
    </div>`;
}

function deckCardHTML(deck) {
  return `
    <a class="card card--hover deck-card" href="/decks/${deck.id}">
      <span class="deck-card__arrow"><svg class="icon icon--sm"><use href="#i-arrow-right" /></svg></span>
      <div class="deck-card__top">
        <span class="deck-card__dot" style="background:${esc(deck.color)}"></span>
        <span class="deck-card__name truncate">${esc(deck.name)}</span>
      </div>
      <div class="deck-card__desc clamp-2">${esc(deck.description || "Колода карточек")}</div>
      <div class="deck-card__stats">
        <span><b>${deck.cards}</b> карт.</span>
        <span><b>${deck.new}</b> новых</span>
        <span><b>${deck.mature}</b> выучено</span>
      </div>
      <div class="deck-card__mastery">
        <div class="progress"><span class="progress__fill" data-fill="${deck.mastery}"></span></div>
        <span class="badge ${deck.due ? "badge--accent" : ""}">${deck.due ? `${deck.due} к повт.` : "свободно"}</span>
      </div>
    </a>`;
}

function render(d) {
  const user = d.user;
  if (!d.decks.length) {
    page.innerHTML = `
      <div class="dash-hero rise">
        <div>
          <h1>${greeting()}, ${esc(user.name)}</h1>
          <div class="dash-hero__date">${new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
      </div>
      ${emptyState()}`;
    return;
  }

  const goalPct = Math.min(1, d.today.done / Math.max(1, d.today.goal));
  const weekValues = d.week_strip.map((w) => w.reviews);
  const streakClass = d.streak >= 7 ? "badge--warning" : "badge--accent";
  const dueDecks = d.decks.filter((x) => x.due > 0).sort((a, b) => b.due - a.due);
  const delta = d.week.delta;

  page.innerHTML = `
    <section class="dash-hero rise">
      <div>
        <h1>${greeting()}, ${esc(user.name)}</h1>
        <div class="dash-hero__date">${new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}</div>
      </div>
      <div class="dash-goal" style="min-width: min(100%, 340px)">
        <div class="dash-goal__ring">
          ${ring(goalPct)}
          <span class="ring-value num" data-count="${Math.round(goalPct * 100)}" data-suffix="%">0%</span>
        </div>
        <div class="dash-goal__body" style="flex:1">
          <div class="dash-goal__title">${d.today.done} из ${d.today.goal} карточек</div>
          <div class="dash-goal__sub">${d.today.done >= d.today.goal ? "Цель на сегодня достигнута" : `Осталось ${d.today.goal - d.today.done} — цель дня`}</div>
          <a class="btn btn--primary btn--sm" href="/study" style="margin-top:10px">
            <svg class="icon icon--sm"><use href="#i-play" /></svg> ${d.today.done ? "Продолжить" : "Начать"}
          </a>
        </div>
      </div>
    </section>

    <div class="grid grid--stats rise rise-1">
      <section class="card stat">
        <div class="stat__label"><svg class="icon icon--sm"><use href="#i-target" /></svg> Сегодня</div>
        <div class="stat__value"><span data-count="${d.today.done}">0</span><small>/${d.today.goal}</small></div>
        <div class="stat__foot">
          <span class="badge ${d.today.done >= d.today.goal ? "badge--success" : ""}">${d.today.accuracy != null ? `${d.today.accuracy}% точность` : "нет ответов"}</span>
        </div>
      </section>

      <section class="card stat">
        <div class="stat__label"><svg class="icon icon--sm"><use href="#i-flame" /></svg> Серия</div>
        <div class="stat__value"><span data-count="${d.streak}">0</span><small>дн.</small></div>
        <div class="stat__foot">
          <span class="badge ${streakClass}">лучшая: ${d.best_streak}</span>
        </div>
      </section>

      <section class="card stat">
        <div class="stat__label"><svg class="icon icon--sm"><use href="#i-check-circle" /></svg> Точность, 7 дней</div>
        <div class="stat__value"><span data-count="${d.week.accuracy ?? 0}">0</span><small>%</small></div>
        <div class="stat__foot">
          <span class="badge badge--success"><svg class="icon icon--sm" style="width:12px;height:12px"><use href="#i-trending" /></svg> ${d.week.reviews} повторений</span>
        </div>
        <div class="stat__spark" id="weekSpark"></div>
      </section>

      <section class="card stat">
        <div class="stat__label"><svg class="icon icon--sm"><use href="#i-zap" /></svg> За неделю</div>
        <div class="stat__value"><span data-count="${d.week.reviews}">0</span></div>
        <div class="stat__foot">
          ${
            delta != null
              ? `<span class="badge ${delta >= 0 ? "badge--success" : "badge--danger"}">
                   <svg class="icon icon--sm" style="width:12px;height:12px"><use href="#i-arrow-${delta >= 0 ? "up" : "down"}" /></svg>
                   ${Math.abs(delta)}%
                 </span>`
              : `<span class="badge">стабильно</span>`
          }
          <span class="faint" style="font-size: var(--fs-xs)">${d.week.minutes} мин</span>
        </div>
      </section>
    </div>

    <div class="grid grid--2 rise rise-2">
      <section class="card chart-card dash-activity">
        <div class="card__head">
          <div>
            <div class="card__title">Активность</div>
            <div class="card__sub">Последние 30 дней</div>
          </div>
          <span class="badge badge--accent">30 дней</span>
        </div>
        <div class="dash-activity__chart" id="activityChart"></div>
      </section>

      <div class="stack">
        <section class="card card--pad">
          <div class="card__head" style="margin-bottom: var(--sp-2)">
            <div>
              <div class="card__title">К повторению</div>
              <div class="card__sub">${d.due_total} карточек ждут вас</div>
            </div>
            <a class="btn btn--soft btn--sm" href="/study">Все</a>
          </div>
          <div class="dash-due">
            ${
              dueDecks.length
                ? dueDecks
                    .slice(0, 5)
                    .map(
                      (deck) => `
              <a class="dash-due__item" href="/study?deck=${deck.id}">
                <span class="dash-due__dot" style="background:${esc(deck.color)}"></span>
                <span class="dash-due__name truncate">${esc(deck.name)}</span>
                <span class="badge badge--accent">${deck.due}</span>
              </a>`
                    )
                    .join("")
                : `<p class="muted" style="font-size: var(--fs-sm); padding: 8px 0">Всё повторено на сегодня.</p>`
            }
          </div>
        </section>

        <section class="card card--pad">
          <div class="card__head" style="margin-bottom: var(--sp-3)">
            <div>
              <div class="card__title">Неделя</div>
              <div class="card__sub">Повторения по дням</div>
            </div>
            <span class="badge ${d.streak ? "badge--warning" : ""}">
              <svg class="icon icon--sm" style="width:12px;height:12px"><use href="#i-flame" /></svg> ${d.streak} дн.
            </span>
          </div>
          <div class="dash-week-strip" id="weekStrip"></div>
        </section>
      </div>
    </div>

    <section class="rise rise-3">
      <div class="row row--between" style="margin-bottom: var(--sp-3)">
        <h2>Коллоды</h2>
        <a class="btn btn--ghost btn--sm" href="/decks">Все колоды <svg class="icon icon--sm"><use href="#i-arrow-right" /></svg></a>
      </div>
      <div class="grid grid--decks">
        ${d.decks.slice(0, 3).map(deckCardHTML).join("")}
      </div>
    </section>

    ${
      d.recent_sessions.length
        ? `<section class="card card--pad dash-sessions rise rise-4">
            <div class="card__title" style="margin-bottom: var(--sp-2)">Недавние тренировки</div>
            <div class="row-list">
              ${d.recent_sessions
                .map(
                  (s) => `
                <div class="row-item">
                  <span class="dash-sessions__icon" style="color:${esc(s.color || "var(--accent)")}">
                    <svg class="icon icon--sm"><use href="#i-clock" /></svg>
                  </span>
                  <div style="flex:1; min-width:0">
                    <div style="font-weight:600; font-size: var(--fs-sm)" class="truncate">${esc(s.deck || "Все колоды")}</div>
                    <div class="dash-sessions__meta">${relDayLabel(s.started_at)}, ${fmtTime(s.started_at)}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-weight:600; font-size: var(--fs-sm)" class="num">${s.reviews} карт.</div>
                    <div class="dash-sessions__meta">${fmtDuration(s.minutes)}</div>
                  </div>
                </div>`
                )
                .join("")}
            </div>
          </section>`
        : ""
    }
  `;

  const chartHost = document.getElementById("activityChart");
  areaChart(chartHost, d.activity);

  const sparkHost = document.getElementById("weekSpark");
  if (sparkHost) sparkline(sparkHost, weekValues, { width: 96, height: 36 });

  const strip = document.getElementById("weekStrip");
  if (strip) {
    const max = Math.max(1, ...weekValues);
    const todayISO = new Date().toDateString();
    strip.innerHTML = d.week_strip
      .map((w) => {
        const dt = new Date(w.date + "T00:00:00");
        const isToday = dt.toDateString() === todayISO;
        const h = Math.max(6, Math.round((w.reviews / max) * 64));
        return `
          <div class="dash-week-strip__col ${isToday ? "is-today" : ""}" title="${w.reviews} повторений">
            <div class="dash-week-strip__bar ${isToday ? "is-today" : ""}" style="height:0" data-h="${h}"></div>
            <span class="dash-week-strip__label">${DOW[dt.getDay()]}</span>
          </div>`;
      })
      .join("");
    requestAnimationFrame(() => {
      strip.querySelectorAll("[data-h]").forEach((b, i) => {
        setTimeout(() => (b.style.height = `${b.dataset.h}px`), i * 40);
      });
    });
  }

  page.querySelectorAll("[data-count]").forEach((el) => {
    countUp(el, Number(el.dataset.count), { suffix: el.dataset.suffix || "" });
  });
  requestAnimationFrame(() => {
    page.querySelectorAll("[data-ring-offset]").forEach((c) => {
      c.style.strokeDashoffset = c.dataset.ringOffset;
    });
    page.querySelectorAll("[data-fill]").forEach((f) => {
      f.style.width = `${f.dataset.fill}%`;
    });
  });
}

async function init() {
  try {
    const data = await api.get("/api/overview");
    render(data);
  } catch (e) {
    page.innerHTML = `<div class="card"><div class="empty">
      <div class="empty__art"><svg class="icon"><use href="#i-inbox" /></svg></div>
      <div class="empty__title">Не удалось загрузить данные</div>
      <p class="empty__text">${esc(e.message)}</p>
      <div class="empty__actions"><button class="btn btn--primary" onclick="location.reload()">Повторить</button></div>
    </div></div>`;
  }
}

init();
