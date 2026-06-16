from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


class BudgetCreate(BaseModel):
    """Payload for POST /api/v1/budgets."""

    category: str = Field(..., max_length=100)
    payment_method: Optional[str] = Field(default=None, max_length=50)
    limit_amount: float = Field(..., gt=0, description="Budget cap in INR")
    month_year: str = Field(
        ...,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
        description="Format: YYYY-MM e.g. 2024-06",
    )


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


class BudgetUpdate(BaseModel):
    """Payload for PUT /api/v1/budgets/{id}. All fields optional."""

    category: Optional[str] = Field(default=None, max_length=100)
    payment_method: Optional[str] = Field(default=None, max_length=50)
    limit_amount: Optional[float] = Field(default=None, gt=0)
    month_year: Optional[str] = Field(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
    )


# ---------------------------------------------------------------------------
# Read (response)
# ---------------------------------------------------------------------------


class BudgetRead(BaseModel):
    """Single budget response with spending progress."""

    id: uuid.UUID
    user_id: uuid.UUID
    category: str
    payment_method: Optional[str]
    limit_amount: float
    current_spent: float
    remaining: float = Field(
        ..., description="limit_amount - current_spent (can be negative)"
    )
    utilisation_pct: float = Field(
        ..., description="(current_spent / limit_amount) * 100"
    )
    month_year: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_computed(cls, budget: object) -> "BudgetRead":
        """Construct from ORM model, adding computed fields."""
        limit = float(budget.limit_amount)  # type: ignore[attr-defined]
        spent = float(budget.current_spent)  # type: ignore[attr-defined]
        remaining = limit - spent
        utilisation = (spent / limit * 100) if limit > 0 else 0.0
        return cls(
            id=budget.id,  # type: ignore[attr-defined]
            user_id=budget.user_id,  # type: ignore[attr-defined]
            category=budget.category,  # type: ignore[attr-defined]
            payment_method=budget.payment_method,  # type: ignore[attr-defined]
            limit_amount=limit,
            current_spent=spent,
            remaining=remaining,
            utilisation_pct=round(utilisation, 2),
            month_year=budget.month_year,  # type: ignore[attr-defined]
            created_at=budget.created_at,  # type: ignore[attr-defined]
            updated_at=budget.updated_at,  # type: ignore[attr-defined]
        )


# ---------------------------------------------------------------------------
# List response
# ---------------------------------------------------------------------------


class BudgetListResponse(BaseModel):
    """Response for GET /api/v1/budgets."""

    items: list[BudgetRead]
    total: int
    month_year: Optional[str] = None
