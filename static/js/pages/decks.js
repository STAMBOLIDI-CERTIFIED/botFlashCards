import { api } from "../api.js";
import { esc, nodeFrom, openModal, qs, toast } from "../ui.js";

const grid = document.getElementById("decksGrid");
const createBtn = document.getElementById("createDeckBtn");
import { DECK_COLORS } from "../deck-colors.js";

function renderEmpty() {
  grid.innerHTML = `
    <div class="card" style="grid-column: 1 / -1">
      <div class="empty">
        <div class="empty__art"><svg class="icon"><use href="#i-layers" /></svg></div>
        <div class="empty__title">Пока нет колод</div>
        <p class="empty__text">Колода — это набор карточек: слов, терминов или примеров. Создайте первую, чтобы начать учиться.</p>
        <div class="empty__actions">
          <button class="btn btn--primary" data-create-first>Создать колоду</button>
        </div>
      </div>
    </div>`;
  qs("[data-create-first]", grid)?.addEventListener("click", openCreate);
}

function render(decks) {
  if (!decks.length) {
    renderEmpty();
    return;
  }
  grid.innerHTML = "";
  decks.forEach((deck, i) => {
    const card = nodeFrom("tplDeckCard");
    card.href = `/decks/${deck.id}`;
    card.style.animation = `rise-in 420ms cubic-bezier(.22,1,.36,1) ${i * 45}ms both`;
    qs(".deck-card__dot", card).style.background = deck.color;
    qs(".deck-card__name", card).textContent = deck.name;
    qs(".deck-card__desc", card).textContent = deck.description || "Колода карточек";
    qs("[data-cards]", card).textContent = deck.cards;
    qs("[data-new]", card).textContent = deck.new;
    qs("[data-mature]", card).textContent = deck.mature;
    const badge = qs("[data-due-badge]", card);
    badge.textContent = deck.due ? `${deck.due} к повторению` : "свободно";
    badge.classList.toggle("badge--accent", deck.due > 0);
    grid.appendChild(card);
    const fill = qs(".progress__fill", card);
    setTimeout(() => (fill.style.width = `${deck.mastery}%`), 120 + i * 60);
  });
}

function openCreate() {
  let color = DECK_COLORS[0];
  openModal({
    title: "Новая колода",
    sub: "Название и цвет — остальное можно добавить позже",
    body: `
      <div class="stack">
        <div class="field">
          <label class="field__label" for="mdName">Название</label>
          <input class="input" id="mdName" placeholder="Например, English B2" maxlength="160" />
        </div>
        <div class="field">
          <label class="field__label" for="mdDesc">Описание</label>
          <textarea class="textarea" id="mdDesc" placeholder="Коротко о том, что внутри"></textarea>
        </div>
        <div class="field">
          <label class="field__label">Цвет</label>
          <div class="color-row">
            ${DECK_COLORS.map(
              (c, i) => `<button class="color-dot ${i === 0 ? "is-active" : ""}" style="background:${c}" data-color="${c}" aria-label="Цвет ${i + 1}"></button>`
            ).join("")}
          </div>
        </div>
      </div>`,
    actions: [
      { label: "Отмена", variant: "btn--secondary", onClick: ({ close }) => close() },
      {
        label: "Создать",
        variant: "btn--primary",
        onClick: async ({ close, root }) => {
          const name = qs("#mdName", root).value.trim();
          if (!name) {
            toast("Введите название колоды", "error");
            return;
          }
          const deck = await api.post("/api/decks", {
            name,
            description: qs("#mdDesc", root).value.trim(),
            color,
          });
          close();
          toast("Колода создана");
          location.href = `/decks/${deck.id}`;
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
    const { decks } = await api.get("/api/decks");
    render(decks);
  } catch (e) {
    grid.innerHTML = `<div class="card"><div class="empty"><div class="empty__title">Ошибка загрузки</div><p class="empty__text">${esc(e.message)}</p></div></div>`;
  }
}

createBtn?.addEventListener("click", openCreate);
load();
