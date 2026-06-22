from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import List
import json
import warnings


_INSECURE_DEFAULT_KEY = "your-super-secret-jwt-key-minimum-32-characters-change-this"


class Settings(BaseSettings):
    # Database
    # Development default: SQLite (pure Python, no build tools needed)
    # Production: set DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/fintrack in .env
    DATABASE_URL: str = "sqlite+aiosqlite:///./fintrack.db"

    # JWT
    SECRET_KEY: str = _INSECURE_DEFAULT_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:5173","http://localhost:5174","http://localhost:8080","http://127.0.0.1:5500"]'

    # App
    APP_NAME: str = "FinTrack"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        """Fix 5: Guard against deploying with the insecure default SECRET_KEY."""
        if self.SECRET_KEY == _INSECURE_DEFAULT_KEY:
            if not self.DEBUG:
                raise ValueError(
                    "SECRET_KEY must be set to a secure random value in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
            warnings.warn(
                "[FinTrack] SECRET_KEY is still the insecure default. "
                "Set a strong SECRET_KEY in your .env file before deploying.",
                stacklevel=2,
            )
        return self

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
