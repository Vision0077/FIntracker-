from __future__ import annotations

import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.schemas.budget import (
    BudgetCreate,
    BudgetListResponse,
    BudgetRead,
    BudgetUpdate,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_budget_or_404(
    budget_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> Budget:
    """Fetch a budget owned by the user or raise 404."""
    result = await db.execute(
        select(Budget).where(
            and_(Budget.id == str(budget_id), Budget.user_id == str(user_id))
        )
    )
    budget = result.scalar_one_or_none()
    if budget is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found.",
        )
    return budget


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


async def list_budgets(
    user_id: uuid.UUID,
    db: AsyncSession,
    month_year: Optional[str] = None,
) -> BudgetListResponse:
    """
    Return all budgets for the user, optionally filtered by month_year.
    Includes computed remaining amount and utilisation percentage.
    """
    query = select(Budget).where(Budget.user_id == str(user_id))
    if month_year is not None:
        query = query.where(Budget.month_year == month_year)
    query = query.order_by(Budget.month_year.desc(), Budget.created_at.desc())

    result = await db.execute(query)
    budgets = result.scalars().all()

    items = [BudgetRead.from_orm_with_computed(b) for b in budgets]

    return BudgetListResponse(
        items=items,
        total=len(items),
        month_year=month_year,
    )


async def create_budget(
    user_id: uuid.UUID,
    payload: BudgetCreate,
    db: AsyncSession,
) -> BudgetRead:
    """Create a new budget for a category/month."""
    budget = Budget(
        id=str(uuid.uuid4()),
        user_id=str(user_id),
        category=payload.category.upper(),
        payment_method=payload.payment_method.upper() if payload.payment_method else None,
        limit_amount=payload.limit_amount,
        current_spent=0.00,
        month_year=payload.month_year,
    )
    db.add(budget)
    await db.flush()

    # Sync current_spent from existing transactions for this month/category
    await _sync_budget_spent(budget, db)

    return BudgetRead.from_orm_with_computed(budget)


async def update_budget(
    budget_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: BudgetUpdate,
    db: AsyncSession,
) -> BudgetRead:
    """Update mutable fields of a budget."""
    budget = await _get_budget_or_404(budget_id, user_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "category" and value:
            value = value.upper()
        if field == "payment_method" and value:
            value = value.upper()
        setattr(budget, field, value)

    await db.flush()
    return BudgetRead.from_orm_with_computed(budget)


async def delete_budget(
    budget_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Permanently delete a budget."""
    budget = await _get_budget_or_404(budget_id, user_id, db)
    await db.delete(budget)
    await db.flush()


# ---------------------------------------------------------------------------
# Sync helper
# ---------------------------------------------------------------------------


async def _sync_budget_spent(budget: Budget, db: AsyncSession) -> None:
    """
    Recalculate current_spent from actual EXPENSE transactions
    for the budget's category and month.
    """
    from app.models.transaction import Transaction
    from sqlalchemy import func
    import datetime

    try:
        year, month = budget.month_year.split("-")
        month_start = datetime.date(int(year), int(month), 1)
        # Last day of the month
        if int(month) == 12:
            month_end = datetime.date(int(year) + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            month_end = datetime.date(int(year), int(month) + 1, 1) - datetime.timedelta(days=1)
    except (ValueError, AttributeError):
        return

    filters = and_(
        Transaction.user_id == budget.user_id,
        Transaction.category == budget.category,
        Transaction.type == "EXPENSE",
        Transaction.deleted_at.is_(None),
        Transaction.transaction_date >= month_start,
        Transaction.transaction_date <= month_end,
    )

    # If budget is tied to a specific payment method, filter on that too
    if budget.payment_method:
        filters = and_(
            filters,
            Transaction.payment_method == budget.payment_method,
        )

    result = await db.execute(
        select(func.sum(Transaction.amount)).where(filters)
    )
    spent = result.scalar_one_or_none()
    budget.current_spent = float(spent) if spent is not None else 0.00
