from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api import router as api_router
from .config import BASE_DIR, PORT, SEED_ON_START
from .db import SessionLocal, init_db
from .routes_pages import router as pages_router
from .seed import seed_if_empty

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("lingua")


def _allowed_user_ids() -> set[int]:
    """ID пользователей, которым разрешено общаться с ботом.

    OWNER_ID — основной владелец; ALLOWED_USER_IDS — доп. список через запятую.
    Пусто = доступ открыт для всех.
    """
    ids: set[int] = set()
    for key in ("OWNER_ID", "ALLOWED_USER_IDS"):
        raw = os.getenv(key, "").strip()
        if not raw:
            continue
        for part in raw.replace(";", ",").split(","):
            part = part.strip()
            if part.isdigit():
                ids.add(int(part))
    return ids


async def _maybe_start_bot() -> None:
    token = os.getenv("BOT_TOKEN", "").strip()
    if not token:
        return
    try:
        from aiogram import Bot, Dispatcher
        from aiogram.filters import CommandStart
        from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
    except ImportError:
        log.warning("BOT_TOKEN задан, но aiogram не установлен — бот не запущен.")
        return

    webapp_url = os.getenv("WEBAPP_URL", "").strip()
    allowed = _allowed_user_ids()
    bot = Bot(token)
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def start(message: Message) -> None:
        if allowed and message.from_user and message.from_user.id not in allowed:
            return  # молча игнорируем всех, кроме владельца
        text = "Lingua Flow — карточки с интервальным повторением."
        reply_markup = None
        if webapp_url:
            text += "\nОткрывай веб-приложение, чтобы учиться и следить за прогрессом."
            reply_markup = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="Открыть Lingua Flow", web_app=WebAppInfo(url=webapp_url))]
                ]
            )
        await message.answer(text, reply_markup=reply_markup)

    if allowed:
        log.info("Бот запущен в приватном режиме: доступ только для %s", sorted(allowed))
    else:
        log.info("Бот запущен: доступ открыт для всех пользователей.")
    if webapp_url:
        log.info("WEBAPP_URL: %s", webapp_url)
    else:
        log.warning("WEBAPP_URL не задан — кнопка Mini App не будет показана.")

    try:
        await dp.start_polling(bot)
    except asyncio.CancelledError:
        pass
    finally:
        await bot.session.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if SEED_ON_START:
        async with SessionLocal() as session:
            created = await seed_if_empty(session)
            if created:
                log.info("Созданы демо-данные (первая инициализация БД).")
    bot_task = None
    if os.getenv("BOT_TOKEN", "").strip():
        bot_task = asyncio.create_task(_maybe_start_bot())
    yield
    if bot_task:
        bot_task.cancel()
        try:
            await bot_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Lingua Flow", lifespan=lifespan)
app.include_router(api_router)
app.include_router(pages_router)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


def run() -> None:
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")


if __name__ == "__main__":
    run()
