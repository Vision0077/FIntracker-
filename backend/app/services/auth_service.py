from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
    decode_access_token,
)
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, UserPublic

# HTTP Bearer scheme — token extracted from Authorization: Bearer <token>
_bearer_scheme = HTTPBearer()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_user_by_email(
    email: str, db: AsyncSession
) -> Optional[User]:
    """Fetch a user by email address, or return None."""
    result = await db.execute(
        select(User).where(User.email == email.lower().strip())
    )
    return result.scalar_one_or_none()


async def _get_user_by_id(
    user_id: uuid.UUID, db: AsyncSession
) -> Optional[User]:
    """Fetch a user by primary key, or return None."""
    result = await db.execute(select(User).where(User.id == str(user_id)))
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


async def register_user(
    payload: RegisterRequest, db: AsyncSession
) -> tuple[str, User]:
    """
    Create a new user account.

    Returns:
        Tuple of (access_token, User).

    Raises:
        HTTPException 409 if email already exists.
    """
    email = payload.email.lower().strip()

    existing = await _get_user_by_email(email, db)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        id=str(uuid.uuid4()),
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        currency="INR",
    )
    db.add(user)
    await db.flush()  # get id without committing

    token = create_access_token(data={"sub": str(user.id)})
    return token, user


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


async def login_user(
    payload: LoginRequest, db: AsyncSession
) -> tuple[str, User]:
    """
    Authenticate a user and return an access token.

    Raises:
        HTTPException 401 if credentials are invalid.
    """
    email = payload.email.lower().strip()
    user = await _get_user_by_email(email, db)

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": str(user.id)})
    return token, user


# ---------------------------------------------------------------------------
# Current-user dependency
# ---------------------------------------------------------------------------


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — validates the Bearer token and returns the User.

    Raises:
        HTTPException 401 if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            raise credentials_exception
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = await _get_user_by_id(user_id, db)
    if user is None:
        raise credentials_exception

    return user
