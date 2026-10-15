import { api } from "../api.js";
import { debounce, qs, toast } from "../ui.js";

const nameInput = qs("#setName");
const saveNameBtn = qs("#saveName");
const goal = qs("#setGoal");
const goalValue = qs("#setGoalValue");

function paintGoal(v) {
  goalValue.textContent = `${v} / день`;
}

async function load() {
  const s = await api.get("/api/settings");
  nameInput.value = s.name;
  goal.value = s.daily_goal;
  paintGoal(s.daily_goal);
}

saveNameBtn?.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) return toast("Введите имя", "error");
  const s = await api.put("/api/settings", { name });
  toast("Имя сохранено");
  document.querySelectorAll("[data-user-name]").forEach((n) => (n.textContent = s.name));
});

nameInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveNameBtn.click();
});

goal?.addEventListener("input", () => paintGoal(goal.value));
const saveGoal = debounce(async () => {
  const s = await api.put("/api/settings", { daily_goal: Number(goal.value) });
  paintGoal(s.daily_goal);
  toast("Цель обновлена");
  document.querySelectorAll("[data-user-goal]").forEach((n) => (n.textContent = `Цель: ${s.daily_goal} карточек`));
}, 400);
goal?.addEventListener("change", saveGoal);

load().catch((e) => toast(e.message, "error"));
