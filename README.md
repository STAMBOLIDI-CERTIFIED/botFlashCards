# Lingua Flow

Премиальный веб-интерфейс для изучения языков с интервальным повторением (flashcards + SRS).
Построен с нуля: FastAPI (Python) бэкенд, vanilla JS фронтенд, SVG-графики, light/dark темы,
адаптивная вёрстка с нижней мобильной навигацией.

## Стек

- **Backend**: Python · FastAPI · SQLAlchemy 2 (async) · asyncpg (PostgreSQL) / aiosqlite (fallback)
- **Frontend**: Jinja2 templates · vanilla ES modules · CSS custom properties · SVG-графики без зависимостей
- **Бот (опционально)**: aiogram 3 (включается при наличии `BOT_TOKEN`)
- **БД**: PostgreSQL (в проде) с локальным SQLite-фолбэком для разработки

## Возможности

- **Dashboard** — ежедневная цель, стрик, карточка «Недавние тренировки», недельная динамика
- **Колоды** — создание/редактирование/удаление колод, цвета, статистика освоения
- **Тренировки** — карточки с плавным переворотом, оценка сложности, SM-2-lite расписание
- **Календарь** — тепловая карта активности + таймлайн занятий по часам
- **Аналитика** — area/sparkline/heatmap/бар-графики точности и распределения оценок
- **Настройки** — тема (system/light/dark), дневная цель, профиль
- **UX** — пустые состояния, микровзаимодействия (countUp, toast, модалки), Telegram WebApp-совместимость

## Быстрый старт (локально)

```bash
# 1. Окружение
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Переменные
cp .env.example .env
# отредактируйте DATABASE_URL (или оставьте пустым для SQLite-фолбэка)

# 3. Запуск (создаст таблицы и, при SEED_ON_START=1, демо-данные)
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Откройте http://127.0.0.1:8000

### Засев демо-данных вручную

```bash
python -m app.seed
```

## Переменные окружения (.env)

| Переменная        | Описание                                      | По умолчанию |
|-------------------|-----------------------------------------------|--------------|
| `DATABASE_URL`    | DSN PostgreSQL. Пусто → SQLite фолбэк в `data/` | —            |
| `PORT`            | Порт HTTP-сервера                              | `8000`       |
| `SEED_ON_START`   | `1` — создать демо-данные при старте           | `0`          |
| `BOT_TOKEN`       | Токен Telegram-бота (aiogram). Пусто → бот off                     | —            |
| `WEBAPP_URL`      | Публичный HTTPS-URL для кнопки Mini App                            | —            |
| `OWNER_ID`        | Telegram ID владельца — бот отвечает только ему                    | —            |
| `ALLOWED_USER_IDS`| Доп. ID через запятую (общий доступ бота)                          | —            |
| `DATA_DIR`        | Каталог для SQLite/загрузок                    | `./data`     |

## Деплой на bothost

`main.py` в корне — единственный entrypoint. Сервис читает `PORT` из окружения.

### Через Git (рекомендуется)

1. Заведите переменные `DATABASE_URL` (PostgreSQL bothost) и `SEED_ON_START=1` в панели bothost.
2. Подключите репозиторий `STAMBOLIDI-CERTIFIED/botFlashCards` в панели bothost.
3. Bothost соберёт образ по `Dockerfile` и запустит `python main.py`.
4. Приложение само создаст таблицы при старте; первые данные засеются при `SEED_ON_START=1`.

### Локальный запуск Docker-образа

```bash
docker build -t lingua-flow .
docker run --rm -p 8000:8000 --env-file .env lingua-flow
```

## Структура проекта

```
app/
  api.py            # REST-эндпоинты (decks, cards, reviews, study, calendar, analytics, settings)
  config.py         # Чтение окружения
  db.py             # Async engine + сессии (PostgreSQL / SQLite fallback)
  models.py         # User, Deck, Card, Review, StudySession
  routes_pages.py   # Jinja2-маршруты страниц
  scheduling.py     # SM-2-lite: apply_review, human_interval
  seed.py           # Демо-данные (колоды, карты, история повторений)
static/
  css/              # tokens, base, components, layout, pages
  js/               # api, app, charts, theme, ui + pages/*
templates/          # base + страницы (dashboard, decks, study, calendar, analytics, settings)
main.py             # FastAPI lifespan + (опционально) aiogram-бот
```

## Лицензия

Частный проект. Все права защищены.
