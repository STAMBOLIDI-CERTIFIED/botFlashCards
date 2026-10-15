from __future__ import annotations

import random
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Card, Deck, Review, StudySession, User, utcnow

DECKS = [
    {
        "name": "English · B2",
        "description": "Сложная лексика для свободного общения и работы",
        "color": "#5B5BD6",
        "cards": [
            ("resilient", "устойчивый, стойкий", "a resilient community"),
            ("thorough", "тщательный, основательный", "a thorough analysis"),
            ("vague", "расплывчатый, неопределённый", "a vague answer"),
            ("compelling", "убедительный, захватывающий", "a compelling argument"),
            ("substantial", "значительный, существенный", "substantial progress"),
            ("scrutinize", "внимательно изучать", "scrutinize the report"),
            ("mitigate", "смягчать, уменьшать", "mitigate the risks"),
            ("feasible", "выполнимый, реальный", "a feasible plan"),
            ("redundant", "избыточный, лишний", "redundant information"),
            ("concise", "краткий, сжатый", "keep it concise"),
            ("ambiguous", "двусмысленный", "an ambiguous statement"),
            ("allocate", "распределять, выделять", "allocate resources"),
            ("withhold", "удерживать, скрывать", "withhold information"),
            ("plausible", "правдоподобный", "a plausible excuse"),
            ("detremental", "вредный, ущербный", "detrimental to health"),
            ("meticulous", "дотошный, скрупулёзный", "meticulous attention"),
            ("transient", "преходящий, временный", "a transient phase"),
            ("profound", "глубокий, значимый", "a profound impact"),
            ("aggregate", "в совокупности, суммарный", "in the aggregate"),
            ("inhibit", "тормозить, подавлять", "inhibit growth"),
            ("endeavor", "старание, попытка", "a new endeavor"),
            ("coherent", "последовательный, связный", "a coherent story"),
            ("discrepancy", "расхождение, несоответствие", "a major discrepancy"),
            ("robust", "надёжный, устойчивый", "a robust solution"),
            ("nuance", "тонкость, нюанс", "cultural nuances"),
            ("prosperous", "процветающий", "a prosperous era"),
            ("reluctant", "неохотный", "reluctant to agree"),
            ("streamline", "упрощать, оптимизировать", "streamline the process"),
            ("viable", "жизнеспособный", "a viable alternative"),
            ("explicit", "явный, прямой", "explicit instructions"),
        ],
    },
    {
        "name": "Испанский · A1",
        "description": "Базовые слова и выражения для первого общения",
        "color": "#0EA5A4",
        "cards": [
            ("la ventana", "окно", "Abre la ventana, por favor"),
            ("el desayuno", "завтрак", "Desayuno a las ocho"),
            ("aprender", "учить, выучить", "Quiero aprender español"),
            ("la costumbre", "привычка, обычай", "Una costumbre antigua"),
            ("el barrio", "район, квартал", "Vivo en el centro"),
            ("aunque", "хотя, несмотря на то что", "Aunque llueve, salgo"),
            ("el billete", "билет", "Un billete de ida"),
            ("temprano", "рано", "Me levanto temprano"),
            ("la hambre", "голод", "Tengo mucha hambre"),
            ("acabar", "заканчивать(ся)", "La clase acaba pronto"),
            ("el ruido", "шум", "Mucho ruido en la calle"),
            ("diferente", "другой, отличный", "Es diferente ahora"),
            ("el viaje", "поездка", "Un viaje largo"),
            ("mejorar", "улучшать(ся)", "Quiero mejorar"),
            ("la fecha", "дата", "¿Cuál es la fecha?"),
            ("alegre", "весёлый, радостный", "Estoy muy alegre"),
            ("el vecino", "сосед", "Mi vecino es amable"),
            ("soler", "иметь в привычке", "Suelo caminar"),
            ("la basura", "мусор", "Saca la basura"),
            ("lograr", "добиваться, достигать", "Logré mi meta"),
        ],
    },
    {
        "name": "UX-термины",
        "description": "Словарь продуктового дизайнера",
        "color": "#D97706",
        "cards": [
            ("affordance", "очевидность действия элемента интерфейса", "strong affordance"),
            ("cognitive load", "когнитивная нагрузка пользователя", "reduce cognitive load"),
            ("progressive disclosure", "поэтапное раскрытие информации", "progressive disclosure"),
            ("heuristic evaluation", "эвристическая оценка интерфейса", "Nielsen heuristics"),
            ("information architecture", "архитектура информации", "IA of the product"),
            ("microinteraction", "микровзаимодействие", "delightful microinteraction"),
            ("edge case", "пограничный случай", "handle edge cases"),
            ("empty state", "пустое состояние экрана", "friendly empty state"),
            ("onboarding", "процесс знакомства с продуктом", "smooth onboarding"),
            ("usability testing", "тестирование удобства", "moderated testing"),
            ("persona", "персона, типаж пользователя", "primary persona"),
            ("journey map", "карта пути пользователя", "user journey map"),
            ("conversion funnel", "воронка конверсии", "checkout funnel"),
            ("dark pattern", "тёмный паттерн проектирования", "avoid dark patterns"),
            ("design system", "дизайн-система", "tokens in a design system"),
            ("accessibility", "доступность интерфейса", "WCAG accessibility"),
            ("responsive layout", "адаптивная вёрстка", "fluid responsive layout"),
            ("latency", "задержка отклика", " perceived latency"),
            ("delight", "эстетическое удовольствие", "moment of delight"),
            ("skeuomorphism", "скевоморфизм", "vs flat design"),
        ],
    },
    {
        "name": "Японский · база",
        "description": "Хирагана и первые слова",
        "color": "#DB2777",
        "cards": [
            ("あい", "любовь", "ai"),
            ("いえ", "дом", "ie"),
            ("うみ", "море", "umi"),
            ("えき", "вокзал", "eki"),
            ("おかし", "конфета, сладость", "okashi"),
            ("かぜ", "ветер", "kaze"),
            ("きって", "марка", "kitte"),
            ("くつ", "туфля", "kutsu"),
            ("けむり", "дым", "kemuri"),
            ("こまかい", "мелкий, подробный", "komakai"),
            ("さかな", "рыба", "sakana"),
            ("しお", "соль", "shio"),
            ("すこやか", "здоровый", "sukoyaka"),
            ("せかい", "мир", "sekai"),
            ("たいせつ", "важный", "taisetsu"),
            ("ちず", "карта", "chizu"),
            ("てがみ", "письмо", "tegami"),
            ("とけい", "часы", "tokei"),
            ("なつ", "лето", "natsu"),
            ("にじ", "радуга", "niji"),
        ],
    },
]

def _build_cards(deck: Deck, items: list[tuple[str, str, str]], rng: random.Random) -> list[Card]:
    cards: list[Card] = []
    now = utcnow()
    for front, back, hint in items:
        card = Card(
            deck_id=deck.id,
            front=front,
            back=back,
            hint=hint,
            created_at=now - timedelta(days=rng.randint(20, 120)),
        )
        cards.append(card)
    return cards


async def seed_if_empty(session: AsyncSession) -> bool:
    existing = await session.scalar(select(func.count()).select_from(User))
    if existing:
        return False

    rng = random.Random(20261014)
    user = User(name="Алексей", daily_goal=30, theme="system")
    session.add(user)
    await session.flush()

    now = utcnow()
    all_cards: list[Card] = []
    decks: list[Deck] = []
    for spec in DECKS:
        deck = Deck(
            user_id=user.id,
            name=spec["name"],
            description=spec["description"],
            color=spec["color"],
            created_at=now - timedelta(days=rng.randint(60, 150)),
        )
        session.add(deck)
        await session.flush()
        cards = _build_cards(deck, spec["cards"], rng)
        session.add_all(cards)
        decks.append(deck)
        all_cards.extend(cards)
    await session.flush()

    # История повторений за 90 дней с «дырами» и разной интенсивностью
    gaps = {-46, -45, -31, -12, -11, -5}
    for day_offset in range(89, 0, -1):
        day = (now - timedelta(days=day_offset)).date()
        weekday = day.weekday()
        if day_offset in gaps:
            continue
        base = rng.randint(8, 18)
        if weekday in (5, 6):
            base = int(base * 0.55)
        if day_offset < 21:
            base = int(base * 1.35)
        if base <= 0:
            continue
        day_reviews = min(base, len(all_cards) * 2)
        sessions_count = 1 if day_reviews < 14 else rng.choice([1, 2, 2, 3])
        slots = sorted(rng.sample(range(7, 23), sessions_count))
        idx = 0
        for hour in slots:
            count = max(1, day_reviews // sessions_count)
            if idx + count > day_reviews:
                count = day_reviews - idx
            if count <= 0:
                break
            started = datetime(day.year, day.month, day.day, hour, rng.randint(0, 25))
            duration = count * rng.randint(2600, 4800)
            correct = 0
            review_rows = []
            for _ in range(count):
                card = rng.choice(all_cards)
                r = rng.random()
                grade = 0 if r < 0.09 else 1 if r < 0.25 else 2 if r < 0.8 else 3
                if grade >= 2:
                    correct += 1
                review_rows.append(
                    Review(
                        user_id=user.id,
                        deck_id=card.deck_id,
                        card_id=card.id,
                        grade=grade,
                        duration_ms=rng.randint(2200, 7000),
                        prev_interval=float(card.interval_days),
                        new_interval=float(card.interval_days) + rng.random() * 5,
                        reviewed_at=started + timedelta(seconds=rng.randint(10, max(30, duration // 1000))),
                    )
                )
            session.add_all(review_rows)
            session.add(
                StudySession(
                    user_id=user.id,
                    deck_id=rng.choice(decks).id,
                    started_at=started,
                    ended_at=started + timedelta(seconds=max(60, duration // 1000)),
                    reviews_count=count,
                    correct_count=correct,
                    duration_ms=duration,
                )
            )
            idx += count

    # Текущее расписание карточек: часть к повторению сегодня, остальное в будущем
    now_due = now - timedelta(hours=1)
    today = now_due.date()
    for i, card in enumerate(all_cards):
        bucket = i % 10
        if bucket < 3:
            card.due_at = datetime(today.year, today.month, today.day, 0, 5) + timedelta(
                minutes=rng.randint(0, 300)
            )
        elif bucket < 4:
            card.due_at = now - timedelta(days=rng.randint(1, 4))
        else:
            card.due_at = now + timedelta(days=rng.randint(1, 45))
        card.reps = rng.randint(1, 14)
        card.interval_days = float(rng.choice([1, 2, 4, 7, 11, 16, 24, 35]))
        card.ease = round(rng.uniform(2.1, 2.9), 2)
        card.stability = round(card.interval_days * rng.uniform(0.5, 1.1), 2)
        card.lapses = rng.randint(0, 2)

    await session.commit()
    return True
