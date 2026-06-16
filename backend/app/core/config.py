from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # Database
    # Development default: SQLite (pure Python, no build tools needed)
    # Production: set DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/fintrack in .env
    DATABASE_URL: str = "sqlite+aiosqlite:///./fintrack.db"

    # JWT
    SECRET_KEY: str = "your-super-secret-jwt-key-minimum-32-characters-change-this"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:5173","http://localhost:5174","http://localhost:8080","http://127.0.0.1:5500"]'

    # App
    APP_NAME: str = "FinTrack"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
