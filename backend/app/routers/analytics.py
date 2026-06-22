from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.schemas.analytics import (
    CategoryBreakdownResponse,
    ComparisonResponse,
    DashboardSummary,
    PaymentMethodBreakdownResponse,
    SpendingTrendsResponse,
)
from app.services.auth_service import get_current_user
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get(
    "/dashboard-summary",
    response_model=DashboardSummary,
    summary="Get key financial KPIs for the current month",
)
async def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    """
    Returns:
    - **total_balance**: Sum of all account balances (INR)
    - **monthly_income**: Total income for the current calendar month
    - **monthly_expenses**: Total expenses for the current calendar month
    - **net_savings**: monthly_income - monthly_expenses
    - **top_category**: Highest-spend category this month
    """
    return await analytics_service.get_dashboard_summary(
        user_id=current_user.id, db=db
    )


@router.get(
    "/spending-trends",
    response_model=SpendingTrendsResponse,
    summary="Daily income/expense aggregates for chart rendering",
)
async def spending_trends(
    period: str = Query(
        default="monthly",
        description=(
            "Period: daily | weekly | fortnightly | monthly | "
            "quarterly | half_yearly | yearly | custom"
        ),
    ),
    start_date: Optional[date] = Query(
        default=None,
        description="Required when period=custom (YYYY-MM-DD)",
    ),
    end_date: Optional[date] = Query(
        default=None,
        description="Required when period=custom (YYYY-MM-DD)",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SpendingTrendsResponse:
    """
    Return daily income/expense totals for the selected period.

    Use `period=custom` with `start_date` and `end_date` for arbitrary ranges.
    Response includes per-day data points suitable for chart components.
    """
    # Fix 7: Reject custom period without both dates instead of silent fallback
    if period == "custom" and (start_date is None or end_date is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both start_date and end_date are required when period=custom.",
        )
    return await analytics_service.get_spending_trends(
        user_id=current_user.id,
        db=db,
        period=period,
        start_date=start_date,
        end_date=end_date,
    )



@router.get(
    "/category-breakdown",
    response_model=CategoryBreakdownResponse,
    summary="Expense breakdown grouped by category",
)
async def category_breakdown(
    start_date: Optional[date] = Query(
        default=None,
        description="Start date for the analysis window (default: start of current month)",
    ),
    end_date: Optional[date] = Query(
        default=None,
        description="End date for the analysis window (default: today)",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoryBreakdownResponse:
    """
    Group expenses by category for the given date window.
    Returns amounts and percentage of total spend per category.
    """
    return await analytics_service.get_category_breakdown(
        user_id=current_user.id,
        db=db,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/payment-method-breakdown",
    response_model=PaymentMethodBreakdownResponse,
    summary="Expense breakdown grouped by payment method",
)
async def payment_method_breakdown(
    start_date: Optional[date] = Query(
        default=None,
        description="Start date (default: start of current month)",
    ),
    end_date: Optional[date] = Query(
        default=None,
        description="End date (default: today)",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaymentMethodBreakdownResponse:
    """
    Group expenses by payment method (UPI, Card, Wallet, Subscription, Cash).
    Returns amounts and percentages for pie/donut chart rendering.
    """
    return await analytics_service.get_payment_method_breakdown(
        user_id=current_user.id,
        db=db,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/comparison",
    response_model=ComparisonResponse,
    summary="Compare spending across two arbitrary date periods",
)
async def comparison(
    period_type: str = Query(
        default="monthly",
        description="Label for the period type (e.g. monthly, custom)",
    ),
    current_start: date = Query(..., description="Current period start (YYYY-MM-DD)"),
    current_end: date = Query(..., description="Current period end (YYYY-MM-DD)"),
    previous_start: date = Query(..., description="Previous period start (YYYY-MM-DD)"),
    previous_end: date = Query(..., description="Previous period end (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ComparisonResponse:
    """
    Compare income, expenses, and savings between two date ranges.

    Returns absolute values for each period plus percentage change metrics,
    suitable for MoM / QoQ / custom comparison widgets.
    """
    return await analytics_service.get_comparison(
        user_id=current_user.id,
        db=db,
        period_type=period_type,
        current_start=current_start,
        current_end=current_end,
        previous_start=previous_start,
        previous_end=previous_end,
    )
