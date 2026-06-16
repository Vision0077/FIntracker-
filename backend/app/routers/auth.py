from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MeResponse,
    RegisterRequest,
    RegisterResponse,
    UserPublic,
)
from app.services.auth_service import (
    get_current_user,
    login_user,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    """
    Create a new user with email + password.

    Returns an access token and the created user profile.
    Raises **409 Conflict** if the email is already registered.
    """
    token, user = await register_user(payload, db)
    return RegisterResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate and receive a JWT token",
)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """
    Validate email + password and return a 7-day JWT access token.

    Raises **401 Unauthorized** on invalid credentials.
    """
    token, user = await login_user(payload, db)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
    )


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get current authenticated user profile",
)
async def me(
    current_user: User = Depends(get_current_user),
) -> MeResponse:
    """
    Return the profile of the currently authenticated user.

    Requires a valid Bearer token.
    """
    return MeResponse(user=UserPublic.model_validate(current_user))
