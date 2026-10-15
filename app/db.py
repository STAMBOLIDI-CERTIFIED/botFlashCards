from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import DATABASE_URL
from .models import Base

log = logging.getLogger("lingua.db")

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

DB_URL_ACTIVE = DATABASE_URL


async def init_db() -> None:
    global engine, SessionLocal, DB_URL_ACTIVE
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        if not DB_URL_ACTIVE.startswith("sqlite"):
            log.warning(
                "PostgreSQL недоступен (%s). Перехожу на локальный SQLite-файл.", exc
            )
            from .config import DATA_DIR

            DB_URL_ACTIVE = f"sqlite+aiosqlite:///{DATA_DIR / 'lingua_flow.db'}"
            engine = create_async_engine(DB_URL_ACTIVE, pool_pre_ping=True, future=True)
            SessionLocal = async_sessionmaker(
                engine, class_=AsyncSession, expire_on_commit=False
            )
        else:
            raise

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session():
    async with SessionLocal() as session:
        yield session
