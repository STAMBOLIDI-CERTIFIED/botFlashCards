export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function nodeFrom(templateId) {
  return document.getElementById(templateId).content.firstElementChild.cloneNode(true);
}

export function toast(message, type = "success") {
  const root = document.getElementById("toasts");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  const icon = type === "error" ? "i-x" : "i-check-circle";
  el.innerHTML = `<svg class="icon icon--sm toast__icon"><use href="#${icon}" /></svg><span></span>`;
  el.querySelector("span").textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 240);
  }, 2800);
}

export function openModal({ title, sub = "", body = "", actions = [], onMount }) {
  const root = document.createElement("div");
  root.className = "modal-root";
  root.innerHTML = `
    <div class="modal__backdrop"></div>
    <div class="modal" role="dialog" aria-modal="true">
      <button class="btn btn--ghost btn--icon modal__close" data-close aria-label="Закрыть">
        <svg class="icon icon--sm"><use href="#i-x" /></svg>
      </button>
      <div class="modal__title">${esc(title)}</div>
      ${sub ? `<div class="modal__sub">${esc(sub)}</div>` : ""}
      <div class="modal__body">${body}</div>
      <div class="modal__actions"></div>
    </div>`;
  const actionsEl = root.querySelector(".modal__actions");
  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.className = `btn ${action.variant || "btn--secondary"}`;
    btn.textContent = action.label;
    btn.addEventListener("click", () => action.onClick?.({ close, root }));
    actionsEl.appendChild(btn);
  });
  function close() {
    root.classList.remove("is-open");
    setTimeout(() => root.remove(), 220);
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }
  root.querySelector(".modal__backdrop").addEventListener("click", close);
  root.querySelector("[data-close]").addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add("is-open"));
  onMount?.(root);
  const focusable = root.querySelector("input, textarea, select, button.btn--primary");
  focusable?.focus();
  return { close, root };
}

export function confirmModal({ title, text, confirmLabel = "Удалить", onConfirm }) {
  openModal({
    title,
    sub: text,
    actions: [
      { label: "Отмена", variant: "btn--secondary", onClick: ({ close }) => close() },
      {
        label: confirmLabel,
        variant: "btn--danger",
        onClick: async ({ close }) => {
          close();
          await onConfirm();
        },
      },
    ],
  });
}

export function countUp(el, target, { duration = 900, decimals = 0, suffix = "" } = {}) {
  const start = performance.now();
  const from = 0;
  function frame(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = from + (target - from) * eased;
    el.textContent = value.toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const DOW_LONG = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const DOW_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function fmtDateLong(date) {
  return `${DOW_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function fmtDayShort(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtMonthTitle(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_NOM[m - 1]} ${y}`;
}

export function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtDuration(minutes) {
  if (minutes < 1) return `${Math.round(minutes * 60)} сек`;
  if (minutes < 60) return `${Math.round(minutes)} мин`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function relDayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return "сегодня";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "вчера";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const DOW_SHORT_EXPORT = DOW_SHORT;

export function initials(name) {
  const parts = String(name || "У").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "У";
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function toLocalDate(iso) {
  return new Date(iso);
}

export function dateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
