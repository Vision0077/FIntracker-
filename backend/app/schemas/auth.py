from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Shared / internal
# ---------------------------------------------------------------------------


class UserPublic(BaseModel):
    """Public user representation returned in auth responses."""

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    currency: str = "INR"
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    """Payload for POST /api/v1/auth/register."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def password_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Password must not be blank.")
        return v


class RegisterResponse(BaseModel):
    """Response for a successful registration."""

    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    """Payload for POST /api/v1/auth/login."""

    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class LoginResponse(BaseModel):
    """Response for a successful login."""

    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------


class MeResponse(BaseModel):
    """Response for GET /api/v1/auth/me."""

    user: UserPublic
