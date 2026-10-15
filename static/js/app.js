import { api } from "./api.js";
import { adoptServerTheme, initTheme } from "./theme.js";
import { initials } from "./ui.js";

initTheme();

const topbar = document.getElementById("topbar");
function onScroll() {
  topbar?.classList.toggle("is-scrolled", window.scrollY > 4);
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const avatarBtn = document.getElementById("avatarBtn");
const avatarMenu = document.getElementById("avatarMenu");
if (avatarBtn && avatarMenu) {
  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = avatarMenu.classList.toggle("is-open");
    avatarBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", () => {
    avatarMenu.classList.remove("is-open");
    avatarBtn.setAttribute("aria-expanded", "false");
  });
}

function bootTelegram() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand?.();
    tg.disableVerticalSwipes?.();
  } catch (e) {}
}

function applyProfile(me) {
  document.querySelectorAll("[data-user-name]").forEach((n) => (n.textContent = me.name));
  const ini = initials(me.name);
  document.querySelectorAll("[data-user-initials]").forEach((n) => (n.textContent = ini));
  document.querySelectorAll("[data-user-goal]").forEach(
    (n) => (n.textContent = `Цель: ${me.daily_goal} карточек`)
  );
  if (me.photo_url) renderPhoto(me.photo_url, ini);
  adoptServerTheme(me.theme);
  const chip = document.getElementById("streakChip");
  if (chip && me.streak > 0) {
    chip.hidden = false;
    const c = chip.querySelector("[data-streak-count]");
    if (c) c.textContent = me.streak;
  }
}

function renderPhoto(url, ini) {
  document.querySelectorAll("[data-user-initials]").forEach((n) => {
    const img = document.createElement("img");
    img.className = "avatar__img";
    img.src = url;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => {
      img.remove();
      n.textContent = ini;
    });
    n.textContent = "";
    n.appendChild(img);
  });
}

async function fetchProfile() {
  const tg = window.Telegram?.WebApp;
  if (!tg || !tg.initData) return null; // обычный браузер — доступ закрыт
  return api.post("/api/tg-sync", {});
}

function showGate(reason) {
  if (document.getElementById("gate")) return;
  const gate = document.createElement("div");
  gate.id = "gate";
  gate.className = "gate";
  gate.innerHTML = `
    <div class="gate__card rise">
      <div class="gate__icon">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
      </div>
      <h1 class="gate__title">Откройте в Telegram</h1>
      <p class="gate__text">${reason}</p>
      <a class="btn btn--primary" href="https://t.me/flash_cards_online_bot" target="_blank" rel="noopener">Открыть бота</a>
    </div>`;
  document.body.appendChild(gate);
  document.documentElement.classList.add("is-locked");
}

async function boot() {
  bootTelegram();
  try {
    const me = await fetchProfile();
    if (!me) {
      showGate("Приложение доступно только внутри Telegram — откройте мини-приложение у бота.");
      return;
    }
    applyProfile(me);
    if (me.due_total > 0) {
      document.querySelectorAll("[data-nav-due]").forEach((b) => {
        b.hidden = false;
        b.textContent = me.due_total;
      });
    }
  } catch (e) {
    if (e.status === 401) {
      showGate("Приложение доступно только внутри Telegram — откройте мини-приложение у бота.");
    } else if (e.status === 403) {
      showGate("Доступ к приложению ограничен его владельцем.");
    }
    /* offline / прочие ошибки — молча */
  }
}

boot();
