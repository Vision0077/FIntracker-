from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetListResponse, BudgetRead, BudgetUpdate
from app.services.auth_service import get_current_user
from app.services import budget_service

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.get(
    "",
    response_model=BudgetListResponse,
    summary="List all budgets with spending progress",
)
async def list_budgets(
    month_year: Optional[str] = Query(
        default=None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
        description="Filter by month: YYYY-MM (e.g. 2024-06)",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetListResponse:
    """
    Return all budgets for the current user.

    Each budget includes:
    - `limit_amount`: the monthly cap
    - `current_spent`: auto-synced from actual transactions
    - `remaining`: limit_amount - current_spent
    - `utilisation_pct`: percentage of budget used
    """
    return await budget_service.list_budgets(
        user_id=current_user.id,
        db=db,
        month_year=month_year,
    )


@router.post(
    "",
    response_model=BudgetRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new category budget",
)
async def create_budget(
    payload: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetRead:
    """
    Create a new monthly budget for a category.

    - `category`: e.g. FOOD, TRAVEL, SUBSCRIPTION
    - `payment_method`: optional — restricts budget to a specific payment type
    - `limit_amount`: monthly cap in INR
    - `month_year`: format YYYY-MM
    
    `current_spent` is automatically populated from existing transactions.
    """
    return await budget_service.create_budget(
        user_id=current_user.id,
        payload=payload,
        db=db,
    )


@router.put(
    "/{budget_id}",
    response_model=BudgetRead,
    summary="Update an existing budget",
)
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetRead:
    """
    Partially update a budget. Only provided fields are changed.

    Returns **404** if the budget does not exist or belongs to another user.
    """
    return await budget_service.update_budget(
        budget_id=budget_id,
        user_id=current_user.id,
        payload=payload,
        db=db,
    )


@router.delete(
    "/{budget_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a budget",
)
async def delete_budget(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Permanently delete a budget.
    Returns 404 if not found or belongs to another user.
    """
    await budget_service.delete_budget(
        budget_id=budget_id,
        user_id=current_user.id,
        db=db,
    )
    return {"message": "Budget deleted successfully."}
