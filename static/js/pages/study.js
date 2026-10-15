import { api } from "../api.js";
import { esc, nodeFrom, qs, toast } from "../ui.js";

const page = document.getElementById("studyPage");
const params = new URLSearchParams(location.search);
let deckFilter = params.get("deck") ? Number(params.get("deck")) : null;

let shell = null;
let state = {
  cards: [],
  index: 0,
  sessionId: null,
  shownAt: Date.now(),
  reviews: 0,
  correct: 0,
  startedAt: Date.now(),
  flipped: false,
  done: false,
  busy: false,
  node: null,
};

function renderFilters(decks) {
  const wrap = document.createElement("div");
  wrap.className = "row row--wrap";
  wrap.style.marginBottom = "var(--sp-4)";
  wrap.innerHTML = `
    <button class="chip ${deckFilter ? "" : "is-active"}" data-deck-filter="">Все колоды</button>
    ${decks
      .map(
        (d) =>
          `<button class="chip ${deckFilter === d.id ? "is-active" : ""}" data-deck-filter="${d.id}">${esc(d.name)}</button>`
      )
      .join("")}`;
  wrap.querySelectorAll("[data-deck-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.deckFilter;
      deckFilter = val ? Number(val) : null;
      const url = new URL(location.href);
      if (deckFilter) url.searchParams.set("deck", String(deckFilter));
      else url.searchParams.delete("deck");
      history.replaceState(null, "", url);
      if (state.sessionId && state.reviews > 0) {
        api.post(`/api/study/sessions/${state.sessionId}/end`, { duration_ms: Date.now() - state.startedAt }).catch(() => {});
      }
      load();
    });
  });
  return wrap;
}

function showEmpty(message) {
  const node = nodeFrom("tplStudyEmpty");
  if (message) qs(".empty__text", node).textContent = message;
  shell.appendChild(node);
}

function showDone() {
  const node = nodeFrom("tplStudyDone");
  const minutes = (Date.now() - state.startedAt) / 60000;
  qs("[data-done-reviews]", node).textContent = state.reviews;
  qs("[data-done-accuracy]", node).textContent = state.reviews
    ? `${Math.round((state.correct / state.reviews) * 100)}%`
    : "—";
  qs("[data-done-time]", node).textContent = minutes < 1 ? "<1м" : `${Math.round(minutes)}м`;
  qs("[data-again]", node).addEventListener("click", () => load());
  shell.innerHTML = "";
  shell.appendChild(node);
}

function currentCard() {
  return state.cards[state.index];
}

function paintCard() {
  const card = currentCard();
  if (!card) {
    finish();
    return;
  }
  const node = nodeFrom("tplStudySession");
  const total = state.cards.length;
  qs("[data-deck-name]", node).textContent = card.deck?.name || "Все колоды";
  qs("[data-current]", node).textContent = Math.min(state.index + 1, total);
  qs("[data-total]", node).textContent = total;
  qs("[data-remaining]", node).textContent = total - state.index;
  qs("[data-today-badge]", node).textContent = `${state.reviews} сегодня`;
  qs("[data-front]", node).textContent = card.front;
  qs("[data-back]", node).textContent = card.back;
  const hint = qs("[data-hint]", node);
  if (card.hint) hint.textContent = `Подсказка: ${card.hint}`;
  else hint.hidden = true;

  const grades = qs("[data-grades]", node);
  grades.classList.add("is-hidden");
  qs("[data-study-hint]", node).textContent = "Нажмите на карточку, чтобы увидеть ответ";
  card.grades.forEach((g) => {
    const btn = qs(`[data-grade="${g.grade}"]`, node);
    btn.innerHTML = `${esc(g.label)}<small>${esc(g.interval)}</small>`;
  });

  shell.innerHTML = "";
  shell.appendChild(node);
  requestAnimationFrame(() => {
    qs("[data-progress]", node).style.width = `${(state.index / total) * 100}%`;
  });

  qs("[data-exit]", node).addEventListener("click", () => {
    if (state.sessionId && state.reviews > 0) {
      api
        .post(`/api/study/sessions/${state.sessionId}/end`, { duration_ms: Date.now() - state.startedAt })
        .catch(() => {});
    }
    location.href = "/";
  });

  const cardEl = qs("[data-card]", node);
  cardEl.addEventListener("click", () => {
    if (state.flipped) return;
    state.flipped = true;
    cardEl.classList.add("is-flipped");
    grades.classList.remove("is-hidden");
    qs("[data-study-hint]", node).textContent = "Оцените, насколько хорошо вспомнили ответ";
  });

  grades.querySelectorAll("[data-grade]").forEach((btn) => {
    btn.addEventListener("click", () => grade(Number(btn.dataset.grade)));
  });

  state.flipped = false;
  state.shownAt = Date.now();
  state.node = node;
}

function flipCurrent() {
  if (!state.flipped && state.node) qs("[data-card]", state.node)?.click();
}

async function grade(g) {
  const card = currentCard();
  if (!card || state.busy || !state.flipped) return;
  state.busy = true;
  const duration = Date.now() - state.shownAt;
  try {
    const res = await api.post("/api/reviews", {
      card_id: card.id,
      grade: g,
      duration_ms: duration,
      session_id: state.sessionId,
    });
    state.reviews += 1;
    if (g >= 2) state.correct += 1;
    state.index += 1;
    toast(`Следующее повторение: ${res.interval}`);
    if (state.index >= state.cards.length) await finish();
    else paintCard();
  } catch (e) {
    toast(e.message, "error");
  } finally {
    state.busy = false;
  }
}

async function finish() {
  if (state.done) return;
  state.done = true;
  if (state.sessionId) {
    await api
      .post(`/api/study/sessions/${state.sessionId}/end`, { duration_ms: Date.now() - state.startedAt })
      .catch(() => {});
  }
  showDone();
}

function bindKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (state.done || !state.node || !shell?.contains(state.node)) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      flipCurrent();
      return;
    }
    if (state.flipped && ["1", "2", "3", "4"].includes(e.key)) {
      e.preventDefault();
      grade(Number(e.key) - 1);
    }
    if (e.key === "Escape") {
      location.href = "/";
    }
  });
}

async function load() {
  page.innerHTML = `
    <div class="study-shell">
      <div class="skeleton" style="height: 40px"></div>
      <div class="skeleton" style="flex:1; min-height: 340px; border-radius: var(--r-2xl)"></div>
      <div class="skeleton" style="height:58px; border-radius: var(--r-md)"></div>
    </div>`;
  try {
    const [decksRes, queue] = await Promise.all([
      api.get("/api/decks"),
      api.get(`/api/study/queue${deckFilter ? `?deck_id=${deckFilter}` : ""}`),
    ]);
    page.innerHTML = "";
    page.appendChild(renderFilters(decksRes.decks));
    shell = document.createElement("div");
    page.appendChild(shell);

    if (!queue.cards.length) {
      showEmpty();
      return;
    }

    state = {
      cards: queue.cards,
      index: 0,
      sessionId: null,
      shownAt: Date.now(),
      reviews: 0,
      correct: 0,
      startedAt: Date.now(),
      flipped: false,
      done: false,
      busy: false,
      node: null,
    };
    const session = await api.post("/api/study/sessions", { deck_id: deckFilter });
    state.sessionId = session.id;
    paintCard();
  } catch (e) {
    page.innerHTML = `<div class="card card--pad"><b>Ошибка загрузки</b><p class="muted">${esc(e.message)}</p></div>`;
  }
}

bindKeyboard();
load();
