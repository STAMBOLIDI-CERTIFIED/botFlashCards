import { api } from "../api.js";
import { confirmModal, esc, nodeFrom, openModal, qs, toast } from "../ui.js";
import { DECK_COLORS } from "../deck-colors.js";

const page = document.getElementById("deckPage");
const deckId = Number(page?.dataset.deckId);

function stateBadge(state) {
  if (state === "new") return `<span class="badge">новая</span>`;
  if (state === "learning") return `<span class="badge badge--warning">учебная</span>`;
  if (state === "mature") return `<span class="badge badge--success">выучена</span>`;
  return `<span class="badge badge--info">повторение</span>`;
}

function renderCards(list, onChanged) {
  const host = qs("[data-card-list]");
  if (!list.length) {
    host.innerHTML = `
      <div class="empty" style="padding: var(--sp-7) var(--sp-5)">
        <div class="empty__art"><svg class="icon"><use href="#i-inbox" /></svg></div>
        <div class="empty__title">В колоде нет карточек</div>
        <p class="empty__text">Добавьте пары «вопрос — ответ», и они появятся в расписании повторений.</p>
        <div class="empty__actions">
          <button class="btn btn--primary btn--sm" data-add-empty>Добавить карточку</button>
        </div>
      </div>`;
    qs("[data-add-empty]", host)?.addEventListener("click", () => openAddCard(onChanged));
    return;
  }
  host.innerHTML = list
    .map(
      (c) => `
    <div class="card-row" data-card-id="${c.id}">
      <div class="card-row__body">
        <div class="card-row__front truncate">${esc(c.front)}</div>
        <div class="card-row__back truncate">${esc(c.back)}</div>
      </div>
      ${stateBadge(c.state)}
      <span class="faint num" style="font-size: var(--fs-xs); width: 62px; text-align: right">${c.interval ? `${c.interval} д` : "—"}</span>
      <button class="btn btn--ghost btn--icon" data-edit-card aria-label="Изменить карточку">
        <svg class="icon icon--sm"><use href="#i-edit" /></svg>
      </button>
      <button class="btn btn--ghost btn--icon" data-del-card aria-label="Удалить карточку">
        <svg class="icon icon--sm"><use href="#i-trash" /></svg>
      </button>
    </div>`
    )
    .join("");
  host.querySelectorAll("[data-edit-card]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("[data-card-id]");
      const card = list.find((c) => String(c.id) === row.dataset.cardId);
      if (card) openEditCard(card, onChanged);
    });
  });
  host.querySelectorAll("[data-del-card]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("[data-card-id]");
      const id = row.dataset.cardId;
      confirmModal({
        title: "Удалить карточку?",
        text: "История её повторений также будет удалена.",
        onConfirm: async () => {
          await api.del(`/api/cards/${id}`);
          toast("Карточка удалена");
          onChanged();
        },
      });
    });
  });
}

// Автоподсказка: тянем пример на английском, пока поле подсказки пустое
// или заполнено автоматически. Ручной ввод не перетираем.
function bindAutoHint(root, frontSel, hintSel) {
  const front = qs(frontSel, root);
  const hint = qs(hintSel, root);
  const state = qs("[data-hint-state]", root);
  if (!front || !hint || !state) return;
  let timer = null;
  let manual = Boolean(hint.value.trim()); // непустая при открытии = чужая, не трогаем
  hint.addEventListener("input", () => (manual = Boolean(hint.value.trim())));
  front.addEventListener("input", () => {
    clearTimeout(timer);
    const word = front.value.trim();
    if (!word || manual) return;
    state.textContent = "ищем…";
    timer = setTimeout(async () => {
      if (manual || front.value.trim() !== word) return;
      try {
        const { hint: generated } = await api.get(`/api/hint?word=${encodeURIComponent(word)}`);
        if (manual || front.value.trim() !== word) return;
        hint.value = generated || "";
        state.textContent = generated ? "(из словаря)" : "(словарь не нашёл)";
      } catch (e) {
        state.textContent = "(недоступно)";
      }
    }, 550);
  });
}

function openAddCard(onSaved) {
  openModal({
    title: "Новая карточка",
    sub: "Спросите на лицевой стороне, ответ — на обороте",
    body: `
      <div class="stack">
        <div class="field">
          <label class="field__label" for="mcFront">Вопрос / слово</label>
          <input class="input" id="mcFront" placeholder="resilient" />
        </div>
        <div class="field">
          <label class="field__label" for="mcBack">Ответ / перевод</label>
          <input class="input" id="mcBack" placeholder="устойчивый, стойкий" />
        </div>
        <div class="field">
          <label class="field__label" for="mcHint">Подсказка <span class="faint" data-hint-state>(заполнится автоматически)</span></label>
          <input class="input" id="mcHint" placeholder="a resilient community" />
        </div>
      </div>`,
    actions: [
      { label: "Отмена", variant: "btn--secondary", onClick: ({ close }) => close() },
      {
        label: "Добавить",
        variant: "btn--primary",
        onClick: async ({ close, root }) => {
          const front = qs("#mcFront", root).value.trim();
          const back = qs("#mcBack", root).value.trim();
          if (!front || !back) {
            toast("Заполните вопрос и ответ", "error");
            return;
          }
          await api.post(`/api/decks/${deckId}/cards`, {
            front,
            back,
            hint: qs("#mcHint", root).value.trim(),
          });
          close();
          toast("Карточка добавлена");
          onSaved();
        },
      },
    ],
    onMount(root) {
      bindAutoHint(root, "#mcFront", "#mcHint");
    },
  });
}

function openEditCard(card, onSaved) {
  openModal({
    title: "Изменить карточку",
    sub: "Лицевая сторона, ответ и подсказка",
    body: `
      <div class="stack">
        <div class="field">
          <label class="field__label" for="ecFront">Вопрос / слово</label>
          <input class="input" id="ecFront" value="${esc(card.front)}" />
        </div>
        <div class="field">
          <label class="field__label" for="ecBack">Ответ / перевод</label>
          <input class="input" id="ecBack" value="${esc(card.back)}" />
        </div>
        <div class="field">
          <label class="field__label" for="ecHint">Подсказка <span class="faint" data-hint-state>${card.hint ? "(ваша)" : "(заполнится автоматически)"}</span></label>
          <input class="input" id="ecHint" value="${esc(card.hint || "")}" placeholder="a resilient community" />
        </div>
      </div>`,
    actions: [
      { label: "Отмена", variant: "btn--secondary", onClick: ({ close }) => close() },
      {
        label: "Сохранить",
        variant: "btn--primary",
        onClick: async ({ close, root }) => {
          const front = qs("#ecFront", root).value.trim();
          const back = qs("#ecBack", root).value.trim();
          if (!front || !back) {
            toast("Заполните вопрос и ответ", "error");
            return;
          }
          await api.patch(`/api/cards/${card.id}`, {
            front,
            back,
            hint: qs("#ecHint", root).value.trim(),
          });
          close();
          toast("Карточка изменена");
          onSaved();
        },
      },
    ],
    onMount(root) {
      bindAutoHint(root, "#ecFront", "#ecHint");
    },
  });
}

function openEditDeck(deck, onSaved) {
  let color = deck.color;
  openModal({
    title: "Изменить колоду",
    body: `
      <div class="stack">
        <div class="field">
          <label class="field__label" for="edName">Название</label>
          <input class="input" id="edName" maxlength="160" value="${esc(deck.name)}" />
        </div>
        <div class="field">
          <label class="field__label" for="edDesc">Описание</label>
          <textarea class="textarea" id="edDesc">${esc(deck.description || "")}</textarea>
        </div>
        <div class="field">
          <label class="field__label">Цвет</label>
          <div class="color-row">
            ${DECK_COLORS.map(
              (c) => `<button class="color-dot ${c === deck.color ? "is-active" : ""}" style="background:${c}" data-color="${c}" aria-label="Цвет"></button>`
            ).join("")}
          </div>
        </div>
      </div>`,
    actions: [
      { label: "Отмена", variant: "btn--secondary", onClick: ({ close }) => close() },
      {
        label: "Сохранить",
        variant: "btn--primary",
        onClick: async ({ close, root }) => {
          const name = qs("#edName", root).value.trim();
          if (!name) return toast("Введите название", "error");
          await api.patch(`/api/decks/${deckId}`, {
            name,
            description: qs("#edDesc", root).value.trim(),
            color,
          });
          close();
          toast("Сохранено");
          onSaved();
        },
      },
    ],
    onMount(root) {
      root.querySelectorAll("[data-color]").forEach((btn) => {
        btn.addEventListener("click", () => {
          root.querySelectorAll("[data-color]").forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          color = btn.dataset.color;
        });
      });
    },
  });
}

async function load() {
  try {
    let deck = await api.get(`/api/decks/${deckId}`);
    document.title = `${deck.name} — Lingua Flow`;
    const node = nodeFrom("tplDeckDetail");
    page.innerHTML = "";
    page.appendChild(node);

    function paint() {
      qs(".deck-hero__dot", node).style.background = deck.color;
      qs("[data-name]", node).textContent = deck.name;
      qs("[data-desc]", node).textContent = deck.description || "Без описания";
      qs("[data-cards]", node).textContent = deck.cards;
      qs("[data-due]", node).textContent = deck.due;
      qs("[data-mature]", node).textContent = deck.mature;
      qs("[data-new]", node).textContent = deck.new;
      qs("[data-total]", node).textContent = deck.cards;
      qs("[data-mastery-label]", node).textContent = `${deck.mastery}%`;
      qs("[data-study-link]", node).href = `/study?deck=${deck.id}`;
      const fills = qs("[data-mastery-fill]", node);
      setTimeout(() => (fills.style.width = `${deck.mastery}%`), 100);
      const parts = qs("[data-mastery-bar]", node).children;
      const total = Math.max(1, deck.cards);
      parts[0].style.width = `${(deck.new / total) * 100}%`;
      parts[1].style.width = `${(deck.learning / total) * 100}%`;
      parts[2].style.width = `${(deck.mature / total) * 100}%`;
      renderCards(deck.cards_list, refresh);
    }

    async function refresh() {
      deck = await api.get(`/api/decks/${deckId}`);
      paint();
    }

    qs("[data-add-card]", node).addEventListener("click", () => openAddCard(refresh));
    qs("[data-edit-deck]", node).addEventListener("click", () => openEditDeck(deck, refresh));
    qs("[data-delete-deck]", node).addEventListener("click", () =>
      confirmModal({
        title: "Удалить колоду?",
        text: "Все карточки и история повторений будут удалены безвозвратно.",
        onConfirm: async () => {
          await api.del(`/api/decks/${deckId}`);
          toast("Колода удалена");
          location.href = "/decks";
        },
      })
    );

    paint();
  } catch (e) {
    page.innerHTML = `<div class="card"><div class="empty">
      <div class="empty__art"><svg class="icon"><use href="#i-inbox" /></svg></div>
      <div class="empty__title">Колода не найдена</div>
      <p class="empty__text">${esc(e.message)}</p>
      <div class="empty__actions"><a class="btn btn--primary" href="/decks">К колодам</a></div>
    </div></div>`;
  }
}

load();
