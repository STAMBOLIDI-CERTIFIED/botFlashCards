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

async function boot() {
  bootTelegram();
  try {
    const me = await api.get("/api/me");
    document.querySelectorAll("[data-user-name]").forEach((n) => (n.textContent = me.name));
    const ini = initials(me.name);
    document.querySelectorAll("[data-user-initials]").forEach((n) => (n.textContent = ini));
    document.querySelectorAll("[data-user-goal]").forEach(
      (n) => (n.textContent = `Цель: ${me.daily_goal} карточек`)
    );
    adoptServerTheme(me.theme);
    const chip = document.getElementById("streakChip");
    if (chip && me.streak > 0) {
      chip.hidden = false;
      const c = chip.querySelector("[data-streak-count]");
      if (c) c.textContent = me.streak;
    }
    if (me.due_total > 0) {
      document.querySelectorAll("[data-nav-due]").forEach((b) => {
        b.hidden = false;
        b.textContent = me.due_total;
      });
    }
  } catch (e) {
    /* offline / first boot */
  }
}

boot();
