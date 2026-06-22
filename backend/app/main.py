from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import create_tables
from app.routers import auth, transactions, analytics, budgets

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Application lifespan handler.
    - Auto-creates SQLite tables on startup (dev convenience).
    - For PostgreSQL, run: alembic upgrade head
    """
    print(f"[START] {settings.APP_NAME} v{settings.APP_VERSION} starting...")
    # Auto-create tables (idempotent — safe to call every startup)
    # In production with PostgreSQL, use Alembic migrations instead.
    await create_tables()
    print("[OK] Database tables verified.")
    yield
    print(f"[STOP] {settings.APP_NAME} shutting down...")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "FinTrack — Personal Expense Tracker API\n\n"
            "Currency: **INR (₹)**\n\n"
            "All protected endpoints require `Authorization: Bearer <token>`."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------ #
    # CORS
    # ------------------------------------------------------------------ #
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------ #
    # Global exception handlers
    # ------------------------------------------------------------------ #

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """Catch-all for unhandled exceptions — return JSON instead of HTML."""
        # Fix 6: Log internally; never expose exception class names to clients
        logger.exception("Unhandled exception on %s %s", request.method, request.url)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred."},
        )


    # ------------------------------------------------------------------ #
    # Routers
    # ------------------------------------------------------------------ #
    API_PREFIX = "/api/v1"

    app.include_router(auth.router, prefix=API_PREFIX)
    app.include_router(transactions.router, prefix=API_PREFIX)
    app.include_router(analytics.router, prefix=API_PREFIX)
    app.include_router(budgets.router, prefix=API_PREFIX)

    # ------------------------------------------------------------------ #
    # Health check
    # ------------------------------------------------------------------ #

    @app.get("/health", tags=["Health"], summary="API health check")
    async def health_check() -> dict:
        return {
            "status": "ok",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
        }

    @app.get("/", tags=["Root"], summary="API root")
    async def root() -> dict:
        return {
            "message": f"Welcome to {settings.APP_NAME}",
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "redoc": "/redoc",
        }

    return app


# ---------------------------------------------------------------------------
# WSGI/ASGI entry point
# ---------------------------------------------------------------------------

app = create_app()
