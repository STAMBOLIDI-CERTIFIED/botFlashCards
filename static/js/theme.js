import { api } from "./api.js";

const KEY = "lf-theme";
const mq = window.matchMedia("(prefers-color-scheme: dark)");

function tgIsDark() {
  const tg = window.Telegram?.WebApp;
  return tg?.colorScheme === "dark";
}

function systemIsDark() {
  return mq.matches || tgIsDark();
}

export function currentPref() {
  return localStorage.getItem(KEY) || "system";
}

export function isDark() {
  return document.documentElement.dataset.theme === "dark";
}

function applyVisual(pref) {
  const dark = pref === "dark" || (pref === "system" && systemIsDark());
  const root = document.documentElement;
  root.classList.add("theme-anim");
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.themePref = pref;
  setTimeout(() => root.classList.remove("theme-anim"), 320);
  syncButtons(pref);
  const tg = window.Telegram?.WebApp;
  if (tg?.setHeaderColor) {
    try {
      tg.setHeaderColor(dark ? "#0a0c14" : "#f5f6fa");
    } catch (e) {}
  }
}

function syncButtons(pref) {
  document.querySelectorAll("[data-theme-set]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.themeSet === pref);
  });
}

export function setTheme(pref, { persistServer = true } = {}) {
  localStorage.setItem(KEY, pref);
  applyVisual(pref);
  if (persistServer) api.put("/api/settings", { theme: pref }).catch(() => {});
}

export function adoptServerTheme(theme) {
  if (!localStorage.getItem(KEY) && theme) {
    setTheme(theme, { persistServer: false });
  }
}

export function initTheme() {
  syncButtons(currentPref());
  mq.addEventListener("change", () => {
    if (currentPref() === "system") applyVisual("system");
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-set]");
    if (!btn) return;
    e.preventDefault();
    setTheme(btn.dataset.themeSet);
  });
}

initTheme();
