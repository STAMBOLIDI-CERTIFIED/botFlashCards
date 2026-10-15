from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import Card, Deck, Review, StudySession, User, utcnow
from .scheduling import GRADES, apply_review, human_interval, next_interval_days

router = APIRouter(prefix="/api")

MATURE_DAYS = 21


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat(timespec="seconds") if dt else None


def date_key(dt: datetime) -> str:
    return dt.date().isoformat()


async def get_user(session: AsyncSession) -> User:
    user = (await session.execute(select(User).order_by(User.id))).scalars().first()
    if user is None:
        user = User(name="Ученик")
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


async def deck_with_stats(session: AsyncSession, deck: Deck, today: date) -> dict:
    total = await session.scalar(
        select(func.count()).select_from(Card).where(Card.deck_id == deck.id)
    )
    new_count = await session.scalar(
        select(func.count())
        .select_from(Card)
        .where(Card.deck_id == deck.id, Card.reps == 0)
    )
    mature = await session.scalar(
        select(func.count())
        .select_from(Card)
        .where(Card.deck_id == deck.id, Card.interval_days >= MATURE_DAYS)
    )
    due = await session.scalar(
        select(func.count())
        .select_from(Card)
        .where(Card.deck_id == deck.id, Card.due_at < datetime.combine(today, datetime.max.time()))
    )
    reviews = await session.scalar(
        select(func.count()).select_from(Review).where(Review.deck_id == deck.id)
    )
    learning = max(0, (total or 0) - (new_count or 0) - (mature or 0))
    return {
        "id": deck.id,
        "name": deck.name,
        "description": deck.description,
        "color": deck.color,
        "cards": total or 0,
        "new": new_count or 0,
        "learning": learning,
        "mature": mature or 0,
        "due": due or 0,
        "reviews": reviews or 0,
        "mastery": round(((mature or 0) / total) * 100) if total else 0,
        "created_at": iso(deck.created_at),
    }


async def series_for(session: AsyncSession, user_id: int, days: int, since: date | None = None):
    start = (since or utcnow().date()) - timedelta(days=days - 1)
    rows = (
        await session.execute(
            select(
                func.date(Review.reviewed_at),
                func.count(Review.id),
                func.sum(case_correct()),
            )
            .where(Review.user_id == user_id, Review.reviewed_at >= datetime.combine(start, datetime.min.time()))
            .group_by(func.date(Review.reviewed_at))
        )
    ).all()
    by_day = {str(d): (c, ok or 0) for d, c, ok in rows}
    out = []
    for i in range(days):
        day = start + timedelta(days=i)
        count, ok = by_day.get(day.isoformat(), (0, 0))
        out.append(
            {
                "date": day.isoformat(),
                "reviews": int(count),
                "correct": int(ok),
                "accuracy": round(ok / count * 100) if count else None,
            }
        )
    return out


def case_correct():
    from sqlalchemy import case

    return case((Review.grade >= 2, 1), else_=0)


async def streak_info(session: AsyncSession, user_id: int) -> dict:
    rows = (
        await session.execute(
            select(func.date(Review.reviewed_at))
            .where(Review.user_id == user_id)
            .distinct()
            .order_by(func.date(Review.reviewed_at).desc())
            .limit(400)
        )
    ).scalars()
    days = {str(d) for d in rows}
    if not days:
        return {"streak": 0, "best": 0}
    cursor = utcnow().date()
    if cursor.isoformat() not in days:
        cursor -= timedelta(days=1)
        if cursor.isoformat() not in days:
            return {"streak": 0, "best": await _best_streak(days)}
    streak = 0
    while cursor.isoformat() in days:
        streak += 1
        cursor -= timedelta(days=1)
    return {"streak": streak, "best": max(streak, await _best_streak(days))}


async def _best_streak(days: set[str]) -> int:
    if not days:
        return 0
    ordered = sorted(date.fromisoformat(d) for d in days)
    best = current = 1
    for prev, cur in zip(ordered, ordered[1:]):
        current = current + 1 if (cur - prev).days == 1 else 1
        best = max(best, current)
    return best


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/me")
async def me(session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    today = utcnow().date()
    due = await session.scalar(
        select(func.count())
        .select_from(Card)
        .join(Deck)
        .where(Deck.user_id == user.id, Card.due_at <= utcnow())
    )
    done_today = await session.scalar(
        select(func.count())
        .select_from(Review)
        .where(Review.user_id == user.id, Review.reviewed_at >= datetime.combine(today, datetime.min.time()))
    )
    streak = await streak_info(session, user.id)
    return {
        "name": user.name,
        "daily_goal": user.daily_goal,
        "theme": user.theme,
        "due_total": int(due or 0),
        "done_today": int(done_today or 0),
        "streak": streak["streak"],
    }


@router.get("/overview")
async def overview(session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    today = utcnow().date()
    now = utcnow()

    decks = (await session.execute(select(Deck).where(Deck.user_id == user.id).order_by(Deck.created_at))).scalars().all()
    deck_stats = [await deck_with_stats(session, d, today) for d in decks]

    done_today = await session.scalar(
        select(func.count())
        .select_from(Review)
        .where(Review.user_id == user.id, Review.reviewed_at >= datetime.combine(today, datetime.min.time()))
    )
    correct_today = await session.scalar(
        select(func.count())
        .select_from(Review)
        .where(
            Review.user_id == user.id,
            Review.reviewed_at >= datetime.combine(today, datetime.min.time()),
            Review.grade >= 2,
        )
    )
    week = await series_for(session, user.id, 7)
    prev_week_rows = (
        await session.execute(
            select(func.count())
            .select_from(Review)
            .where(
                Review.user_id == user.id,
                Review.reviewed_at >= datetime.combine(today - timedelta(days=13), datetime.min.time()),
                Review.reviewed_at < datetime.combine(today - timedelta(days=6), datetime.min.time()),
            )
        )
    ).scalar() or 0
    activity = await series_for(session, user.id, 30)
    streak = await streak_info(session, user.id)

    week_total = sum(d["reviews"] for d in week)
    week_correct = sum(d["correct"] for d in week)
    minutes_week = await session.scalar(
        select(func.coalesce(func.sum(StudySession.duration_ms), 0)).where(
            StudySession.user_id == user.id,
            StudySession.started_at >= datetime.combine(today - timedelta(days=6), datetime.min.time()),
        )
    )
    due_total = sum(d["due"] for d in deck_stats)

    recent = (
        await session.execute(
            select(StudySession, Deck.name, Deck.color)
            .join(Deck, Deck.id == StudySession.deck_id, isouter=True)
            .where(StudySession.user_id == user.id, StudySession.reviews_count > 0)
            .order_by(StudySession.started_at.desc())
            .limit(4)
        )
    ).all()

    return {
        "user": {
            "name": user.name,
            "daily_goal": user.daily_goal,
            "theme": user.theme,
        },
        "today": {
            "done": int(done_today or 0),
            "goal": user.daily_goal,
            "correct": int(correct_today or 0),
            "accuracy": round((correct_today or 0) / done_today * 100) if done_today else None,
        },
        "streak": streak["streak"],
        "best_streak": streak["best"],
        "week": {
            "reviews": week_total,
            "delta": round(((week_total - prev_week_rows) / prev_week_rows) * 100) if prev_week_rows else None,
            "minutes": int((minutes_week or 0) / 60000),
            "accuracy": round(week_correct / week_total * 100) if week_total else None,
        },
        "due_total": due_total,
        "decks": deck_stats,
        "activity": activity,
        "week_strip": week,
        "recent_sessions": [
            {
                "id": s.id,
                "started_at": iso(s.started_at),
                "reviews": s.reviews_count,
                "correct": s.correct_count,
                "minutes": round(s.duration_ms / 60000, 1),
                "deck": name,
                "color": color,
            }
            for s, name, color in recent
        ],
        "server_time": iso(now),
    }


@router.get("/decks")
async def list_decks(session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    today = utcnow().date()
    decks = (await session.execute(select(Deck).where(Deck.user_id == user.id).order_by(Deck.created_at))).scalars().all()
    return {"decks": [await deck_with_stats(session, d, today) for d in decks]}


class DeckIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    color: str = "#5B5BD6"


class DeckPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    color: str | None = None


@router.post("/decks")
async def create_deck(payload: DeckIn, session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    deck = Deck(user_id=user.id, name=payload.name.strip(), description=payload.description.strip(), color=payload.color)
    session.add(deck)
    await session.commit()
    await session.refresh(deck)
    return await deck_with_stats(session, deck, utcnow().date())


@router.get("/decks/{deck_id}")
async def get_deck(deck_id: int, session: AsyncSession = Depends(get_session)):
    deck = await session.get(Deck, deck_id)
    if deck is None:
        raise HTTPException(404, "Колода не найдена")
    stats = await deck_with_stats(session, deck, utcnow().date())
    cards = (
        await session.execute(select(Card).where(Card.deck_id == deck_id).order_by(Card.due_at, Card.id))
    ).scalars().all()
    stats["cards_list"] = [
        {
            "id": c.id,
            "front": c.front,
            "back": c.back,
            "hint": c.hint,
            "reps": c.reps,
            "lapses": c.lapses,
            "interval": round(c.interval_days, 1),
            "due_at": iso(c.due_at),
            "state": "new" if c.reps == 0 else "learning" if c.interval_days < 1 else "mature" if c.interval_days >= MATURE_DAYS else "review",
        }
        for c in cards
    ]
    return stats


@router.patch("/decks/{deck_id}")
async def update_deck(deck_id: int, payload: DeckPatch, session: AsyncSession = Depends(get_session)):
    deck = await session.get(Deck, deck_id)
    if deck is None:
        raise HTTPException(404, "Колода не найдена")
    if payload.name is not None:
        deck.name = payload.name.strip()
    if payload.description is not None:
        deck.description = payload.description.strip()
    if payload.color is not None:
        deck.color = payload.color
    await session.commit()
    return await deck_with_stats(session, deck, utcnow().date())


@router.delete("/decks/{deck_id}")
async def delete_deck(deck_id: int, session: AsyncSession = Depends(get_session)):
    deck = await session.get(Deck, deck_id)
    if deck is None:
        raise HTTPException(404, "Колода не найдена")
    await session.delete(deck)
    await session.commit()
    return {"ok": True}


class CardIn(BaseModel):
    front: str = Field(min_length=1)
    back: str = Field(min_length=1)
    hint: str = ""


class CardPatch(BaseModel):
    front: str | None = None
    back: str | None = None
    hint: str | None = None


@router.post("/decks/{deck_id}/cards")
async def create_card(deck_id: int, payload: CardIn, session: AsyncSession = Depends(get_session)):
    deck = await session.get(Deck, deck_id)
    if deck is None:
        raise HTTPException(404, "Колода не найдена")
    card = Card(deck_id=deck_id, front=payload.front.strip(), back=payload.back.strip(), hint=payload.hint.strip())
    session.add(card)
    await session.commit()
    return {"id": card.id, "front": card.front, "back": card.back, "hint": card.hint, "state": "new"}


@router.patch("/cards/{card_id}")
async def update_card(card_id: int, payload: CardPatch, session: AsyncSession = Depends(get_session)):
    card = await session.get(Card, card_id)
    if card is None:
        raise HTTPException(404, "Карточка не найдена")
    if payload.front is not None:
        card.front = payload.front.strip()
    if payload.back is not None:
        card.back = payload.back.strip()
    if payload.hint is not None:
        card.hint = payload.hint.strip()
    await session.commit()
    return {"id": card.id, "front": card.front, "back": card.back, "hint": card.hint}


@router.delete("/cards/{card_id}")
async def delete_card(card_id: int, session: AsyncSession = Depends(get_session)):
    card = await session.get(Card, card_id)
    if card is None:
        raise HTTPException(404, "Карточка не найдена")
    await session.delete(card)
    await session.commit()
    return {"ok": True}


def card_payload(card: Card, deck: Deck | None = None) -> dict:
    return {
        "id": card.id,
        "deck_id": card.deck_id,
        "front": card.front,
        "back": card.back,
        "hint": card.hint,
        "reps": card.reps,
        "due_at": iso(card.due_at),
        "deck": {"id": deck.id, "name": deck.name, "color": deck.color} if deck else None,
        "grades": [
            {"grade": g, "label": {0: "Снова", 1: "Трудно", 2: "Хорошо", 3: "Легко"}[g],
             "interval": human_interval(next_interval_days(card, g))}
            for g in GRADES
        ],
    }


@router.get("/study/queue")
async def study_queue(
    deck_id: int | None = None,
    limit: int = Query(default=40, le=200),
    session: AsyncSession = Depends(get_session),
):
    user = await get_user(session)
    now = utcnow()
    stmt = select(Card, Deck).join(Deck, Deck.id == Card.deck_id).where(
        Deck.user_id == user.id, Card.due_at <= now
    )
    if deck_id:
        stmt = stmt.where(Card.deck_id == deck_id)
    total_due = len((await session.execute(stmt)).all())
    rows = (await session.execute(stmt.order_by(Card.due_at, Card.id).limit(limit))).all()
    done_today = await session.scalar(
        select(func.count()).select_from(Review).where(
            Review.user_id == user.id,
            Review.reviewed_at >= datetime.combine(now.date(), datetime.min.time()),
        )
    )
    return {
        "cards": [card_payload(c, d) for c, d in rows],
        "remaining": len(rows),
        "due_total": total_due,
        "done_today": int(done_today or 0),
        "goal": user.daily_goal,
    }


class ReviewIn(BaseModel):
    card_id: int
    grade: int = Field(ge=0, le=3)
    duration_ms: int = 0
    session_id: int | None = None


@router.post("/reviews")
async def create_review(payload: ReviewIn, session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    card = await session.get(Card, payload.card_id)
    if card is None:
        raise HTTPException(404, "Карточка не найдена")
    deck = await session.get(Deck, card.deck_id)
    prev, new = apply_review(card, payload.grade, payload.duration_ms)
    session.add(
        Review(
            user_id=user.id,
            deck_id=card.deck_id,
            card_id=card.id,
            grade=payload.grade,
            duration_ms=payload.duration_ms,
            prev_interval=prev,
            new_interval=new,
        )
    )
    if payload.session_id:
        st = await session.get(StudySession, payload.session_id)
        if st and st.user_id == user.id:
            st.reviews_count += 1
            if payload.grade >= 2:
                st.correct_count += 1
            st.duration_ms += max(0, payload.duration_ms)
    await session.commit()
    now = utcnow()
    remaining = await session.scalar(
        select(func.count()).select_from(Card).join(Deck).where(
            Deck.user_id == user.id, Card.due_at <= now, Card.id != card.id
        )
    )
    return {
        "ok": True,
        "card": card_payload(card, deck),
        "queue_remaining": int(remaining or 0),
        "interval": human_interval(new),
    }


class SessionIn(BaseModel):
    deck_id: int | None = None


@router.post("/study/sessions")
async def start_session(payload: SessionIn, session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    st = StudySession(user_id=user.id, deck_id=payload.deck_id)
    session.add(st)
    await session.commit()
    return {"id": st.id, "started_at": iso(st.started_at)}


class SessionEnd(BaseModel):
    duration_ms: int = 0


@router.post("/study/sessions/{session_id}/end")
async def end_session(session_id: int, payload: SessionEnd, session: AsyncSession = Depends(get_session)):
    st = await session.get(StudySession, session_id)
    if st is None:
        raise HTTPException(404, "Сессия не найдена")
    st.ended_at = utcnow()
    if payload.duration_ms:
        st.duration_ms = max(st.duration_ms, payload.duration_ms)
    await session.commit()
    return {"ok": True, "reviews": st.reviews_count, "correct": st.correct_count}


@router.get("/calendar")
async def calendar(month: str | None = None, session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    now = utcnow()
    if month:
        try:
            year, mon = (int(p) for p in month.split("-"))
            start = date(year, mon, 1)
        except ValueError:
            raise HTTPException(400, "Неверный формат месяца")
    else:
        start = date(now.year, now.month, 1)
    if start.month == 12:
        end = date(start.year + 1, 1, 1)
    else:
        end = date(start.year, start.month + 1, 1)

    rows = (
        await session.execute(
            select(Review)
            .where(
                Review.user_id == user.id,
                Review.reviewed_at >= datetime.combine(start, datetime.min.time()),
                Review.reviewed_at < datetime.combine(end, datetime.min.time()),
            )
        )
    ).scalars().all()
    sessions_rows = (
        await session.execute(
            select(StudySession, Deck.name, Deck.color)
            .join(Deck, Deck.id == StudySession.deck_id, isouter=True)
            .where(
                StudySession.user_id == user.id,
                StudySession.reviews_count > 0,
                StudySession.started_at >= datetime.combine(start, datetime.min.time()),
                StudySession.started_at < datetime.combine(end, datetime.min.time()),
            )
            .order_by(StudySession.started_at)
        )
    ).all()

    by_day: dict[str, dict] = {}
    for r in rows:
        key = date_key(r.reviewed_at)
        day = by_day.setdefault(key, {"date": key, "reviews": 0, "correct": 0, "minutes": 0.0, "sessions": []})
        day["reviews"] += 1
        day["correct"] += 1 if r.grade >= 2 else 0
        day["minutes"] += r.duration_ms / 60000
    for st, name, color in sessions_rows:
        key = date_key(st.started_at)
        day = by_day.setdefault(key, {"date": key, "reviews": 0, "correct": 0, "minutes": 0.0, "sessions": []})
        day["sessions"].append(
            {
                "id": st.id,
                "started_at": iso(st.started_at),
                "hour": st.started_at.hour + st.started_at.minute / 60,
                "reviews": st.reviews_count,
                "correct": st.correct_count,
                "minutes": round(st.duration_ms / 60000, 1),
                "deck": name,
                "color": color,
            }
        )

    days = []
    cursor = start
    while cursor < end:
        info = by_day.get(cursor.isoformat())
        days.append(
            info
            if info
            else {"date": cursor.isoformat(), "reviews": 0, "correct": 0, "minutes": 0.0, "sessions": []}
        )
        cursor += timedelta(days=1)

    streak = await streak_info(session, user.id)
    return {
        "month": start.isoformat()[:7],
        "days": days,
        "total_reviews": sum(d["reviews"] for d in days),
        "total_minutes": round(sum(d["minutes"] for d in days)),
        "streak": streak["streak"],
        "best": streak["best"],
    }


@router.get("/analytics")
async def analytics(days: int = Query(default=90, le=366), session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    today = utcnow().date()
    start = today - timedelta(days=days - 1)

    series = await series_for(session, user.id, days)
    total_reviews = sum(d["reviews"] for d in series)
    total_correct = sum(d["correct"] for d in series)

    grades_rows = (
        await session.execute(
            select(Review.grade, func.count(Review.id))
            .where(Review.user_id == user.id, Review.reviewed_at >= datetime.combine(start, datetime.min.time()))
            .group_by(Review.grade)
        )
    ).all()
    grades = {g: 0 for g in GRADES}
    for g, c in grades_rows:
        grades[int(g)] = int(c)

    minutes = await session.scalar(
        select(func.coalesce(func.sum(StudySession.duration_ms), 0)).where(
            StudySession.user_id == user.id,
            StudySession.started_at >= datetime.combine(start, datetime.min.time()),
        )
    )
    dow_expr = extract("dow", StudySession.started_at)
    weekday_rows = (
        await session.execute(
            select(
                dow_expr,
                func.coalesce(func.sum(StudySession.duration_ms), 0),
            )
            .where(
                StudySession.user_id == user.id,
                StudySession.started_at >= datetime.combine(start, datetime.min.time()),
            )
            .group_by(dow_expr)
        )
    ).all()
    weekday_minutes = [0] * 7
    for dow, ms in weekday_rows:
        try:
            idx = (int(dow) - 1) % 7  # 0=Вс .. 6=Сб -> пн..вс
        except (TypeError, ValueError):
            continue
        weekday_minutes[idx] = int((ms or 0) / 60000)

    decks = (await session.execute(select(Deck).where(Deck.user_id == user.id).order_by(Deck.created_at))).scalars().all()
    mastery = [await deck_with_stats(session, d, today) for d in decks]

    heatmap = await series_for(session, user.id, 84)
    active_days = sum(1 for d in series if d["reviews"] > 0)

    return {
        "range_days": days,
        "totals": {
            "reviews": total_reviews,
            "minutes": int((minutes or 0) / 60000),
            "accuracy": round(total_correct / total_reviews * 100) if total_reviews else 0,
            "active_days": active_days,
            "cards": sum(d["cards"] for d in mastery),
            "mature": sum(d["mature"] for d in mastery),
        },
        "series": series,
        "grades": [
            {"grade": 0, "label": "Снова", "count": grades[0]},
            {"grade": 1, "label": "Трудно", "count": grades[1]},
            {"grade": 2, "label": "Хорошо", "count": grades[2]},
            {"grade": 3, "label": "Легко", "count": grades[3]},
        ],
        "weekday_minutes": weekday_minutes,
        "decks": [
            {"name": d["name"], "color": d["color"], "new": d["new"], "learning": d["learning"], "mature": d["mature"], "cards": d["cards"]}
            for d in mastery
        ],
        "heatmap": heatmap,
    }


class SettingsIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    daily_goal: int | None = Field(default=None, ge=5, le=500)
    theme: str | None = Field(default=None, pattern="^(system|light|dark)$")


@router.get("/settings")
async def get_settings(session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    return {"name": user.name, "daily_goal": user.daily_goal, "theme": user.theme}


@router.put("/settings")
async def put_settings(payload: SettingsIn, session: AsyncSession = Depends(get_session)):
    user = await get_user(session)
    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.daily_goal is not None:
        user.daily_goal = payload.daily_goal
    if payload.theme is not None:
        user.theme = payload.theme
    await session.commit()
    return {"name": user.name, "daily_goal": user.daily_goal, "theme": user.theme}
