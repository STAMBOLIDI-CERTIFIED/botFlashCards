from __future__ import annotations

from datetime import datetime, timedelta

from .models import Card, utcnow

MAX_INTERVAL = 365.0
GRADES = (0, 1, 2, 3)


def grade_label(grade: int) -> str:
    return {0: "Снова", 1: "Трудно", 2: "Хорошо", 3: "Легко"}[grade]


def next_interval_days(card: Card, grade: int) -> float:
    """SM-2-lite: возвращает интервал в днях после оценки grade."""
    ease = max(1.3, card.ease)
    current = max(card.interval_days, 0.0)
    if grade == 0:
        return 0.0
    if current <= 0:
        return {1: 1.0, 2: 1.0, 3: 3.0}[grade]
    if grade == 1:
        return min(MAX_INTERVAL, max(1.0, current * 1.2))
    if grade == 2:
        return min(MAX_INTERVAL, max(current + 1.0, current * ease))
    return min(MAX_INTERVAL, max(current + 2.0, current * ease * 1.3))


def apply_review(card: Card, grade: int, duration_ms: int = 0) -> tuple[float, float]:
    """Применяет оценку к карточке. Возвращает (prev_interval, new_interval)."""
    now = utcnow()
    prev = float(card.interval_days)
    new_interval = next_interval_days(card, grade)

    if grade == 0:
        card.ease = max(1.3, card.ease - 0.22)
        card.lapses = card.lapses + 1
        card.interval_days = 0.0
        card.due_at = now + timedelta(minutes=10)
        card.stability = max(0.2, card.stability * 0.5)
    else:
        if grade == 1:
            card.ease = max(1.3, card.ease - 0.12)
        elif grade == 3:
            card.ease = min(3.2, card.ease + 0.1)
        factor = {1: 0.7, 2: 1.0, 3: 1.4}[grade]
        card.stability = max(0.5, (card.stability or 0.5) * factor + 0.4)
        card.interval_days = new_interval
        card.due_at = now + timedelta(days=new_interval)

    card.reps += 1
    card.last_review_at = now
    return prev, float(card.interval_days)


def human_interval(days: float) -> str:
    if days <= 0:
        return "10 мин"
    if days < 1:
        return f"{int(days * 24)} ч"
    if days < 30:
        d = int(round(days))
        return f"{d} д"
    if days < 365:
        m = int(round(days / 30))
        return f"{m} мес"
    y = int(round(days / 365))
    return f"{y} г"
