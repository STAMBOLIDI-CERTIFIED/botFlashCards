import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    """Загрузить .env как ЛОКАЛЬНЫЙ фолбэк.

    os.environ.setdefault не перезаписывает реальное окружение процесса,
    поэтому переменные, заданные хостом (bothost/Docker), всегда важнее .env.
    """
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

APP_NAME = "Lingua Flow"
PORT = int(os.getenv("PORT", "8000"))
SEED_ON_START = os.getenv("SEED_ON_START", "1") == "1"

_raw_url = os.getenv("DATABASE_URL", "").strip()
if not _raw_url:
    DATABASE_URL = f"sqlite+aiosqlite:///{DATA_DIR / 'lingua_flow.db'}"
elif _raw_url.startswith("postgres://"):
    DATABASE_URL = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql://") and "+asyncpg" not in _raw_url:
    DATABASE_URL = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = _raw_url
