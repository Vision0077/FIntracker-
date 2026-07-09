from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.transaction import Transaction
from app.schemas.analytics import (
    CategoryBreakdownItem,
    CategoryBreakdownResponse,
    ComparisonResponse,
    DashboardSummary,
    PaymentMethodBreakdownItem,
    PaymentMethodBreakdownResponse,
    PeriodSummary,
    SpendingTrendsResponse,
    TrendDataPoint,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_pct_change(current: float, previous: float) -> float:
    """Percentage change from previous to current. Returns 0 if previous is 0."""
    if previous == 0:
        return 0.0
    return round((current - previous) / previous * 100, 2)


def _to_float(value) -> float:
    if value is None:
        return 0.0
    return float(value)


def _active_filter(user_id: uuid.UUID, start: date, end: date, type_: str):
    """Base filter for active transactions of a given type in a date range."""
    return and_(
        Transaction.user_id == str(user_id),
        Transaction.type == type_,
        Transaction.deleted_at.is_(None),
        Transaction.transaction_date >= start,
        Transaction.transaction_date <= end,
    )


# ponytail: aliases kept for call-site clarity
def _active_expenses(user_id: uuid.UUID, start: date, end: date):
    return _active_filter(user_id, start, end, "EXPENSE")


def _active_income(user_id: uuid.UUID, start: date, end: date):
    return _active_filter(user_id, start, end, "INCOME")


# ---------------------------------------------------------------------------
# Dashboard Summary
# ---------------------------------------------------------------------------


async def get_dashboard_summary(
    user_id: uuid.UUID, db: AsyncSession
) -> DashboardSummary:
    """
    Compute the current month's income, expenses, net savings,
    and the sum of all account balances.
    """
    today = datetime.now(timezone.utc).date()
    month_start = today.replace(day=1)

    # Total balance across all accounts
    balance_result = await db.execute(
        select(func.sum(Account.balance)).where(Account.user_id == str(user_id))
    )
    total_balance = _to_float(balance_result.scalar_one_or_none())

    # Monthly income + expenses in one conditional-aggregate query (2 round-trips saved)
    agg_result = await db.execute(
        select(
            func.sum(case((Transaction.type == "INCOME", Transaction.amount), else_=0)).label("income"),
            func.sum(case((Transaction.type == "EXPENSE", Transaction.amount), else_=0)).label("expenses"),
        ).where(
            and_(
                Transaction.user_id == str(user_id),
                Transaction.deleted_at.is_(None),
                Transaction.transaction_date >= month_start,
                Transaction.transaction_date <= today,
            )
        )
    )
    agg = agg_result.one()
    monthly_income = _to_float(agg.income)
    monthly_expenses = _to_float(agg.expenses)

    # Top spending category this month
    top_cat_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(_active_expenses(user_id, month_start, today))
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(1)
    )
    top_row = top_cat_result.first()
    top_category = top_row[0] if top_row else None

    return DashboardSummary(
        total_balance=round(total_balance, 2),
        monthly_income=round(monthly_income, 2),
        monthly_expenses=round(monthly_expenses, 2),
        net_savings=round(monthly_income - monthly_expenses, 2),
        top_category=top_category,
    )


# ---------------------------------------------------------------------------
# Spending Trends
# ---------------------------------------------------------------------------


def _period_to_date_range(period: str) -> tuple[date, date]:
    """Compute (start_date, end_date) for a named period ending today."""
    today = datetime.now(timezone.utc).date()
    if period == "daily":
        return today, today
    elif period == "weekly":
        return today - timedelta(days=6), today
    elif period == "fortnightly":
        return today - timedelta(days=13), today
    elif period == "monthly":
        return today.replace(day=1), today
    elif period == "quarterly":
        return today - timedelta(days=89), today
    elif period == "half_yearly":
        return today - timedelta(days=179), today
    elif period == "yearly":
        return today - timedelta(days=364), today
    else:
        # "custom" or unrecognised — last 30 days
        return today - timedelta(days=29), today


async def get_spending_trends(
    user_id: uuid.UUID,
    db: AsyncSession,
    period: str = "daily",
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> SpendingTrendsResponse:
    """
    Return daily income/expense totals for the requested period.
    For periods longer than 30 days, data is still returned per calendar day.
    """
    if period == "custom" and start_date and end_date:
        _start, _end = start_date, end_date
    else:
        _start, _end = _period_to_date_range(period)

    # Query daily sums
    rows = await db.execute(
        select(
            Transaction.transaction_date,
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            and_(
                Transaction.user_id == str(user_id),
                Transaction.deleted_at.is_(None),
                Transaction.transaction_date >= _start,
                Transaction.transaction_date <= _end,
            )
        )
        .group_by(Transaction.transaction_date, Transaction.type)
        .order_by(Transaction.transaction_date)
    )

    # Organise by date
    daily: dict[date, dict[str, float]] = {}
    current = _start
    while current <= _end:
        daily[current] = {"INCOME": 0.0, "EXPENSE": 0.0}
        current += timedelta(days=1)

    for row in rows:
        d, t, total = row
        if d in daily:
            daily[d][t] = _to_float(total)

    data: list[TrendDataPoint] = []
    total_income = 0.0
    total_expenses = 0.0
    for d in sorted(daily):
        inc = daily[d]["INCOME"]
        exp = daily[d]["EXPENSE"]
        total_income += inc
        total_expenses += exp
        data.append(
            TrendDataPoint(
                label=d.isoformat(),
                income=round(inc, 2),
                expenses=round(exp, 2),
                net=round(inc - exp, 2),
            )
        )

    return SpendingTrendsResponse(
        period=period,
        start_date=_start,
        end_date=_end,
        data=data,
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
        net_savings=round(total_income - total_expenses, 2),
    )


# ---------------------------------------------------------------------------
# Category Breakdown
# ---------------------------------------------------------------------------


async def get_category_breakdown(
    user_id: uuid.UUID,
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> CategoryBreakdownResponse:
    """Group expenses by category, calculate amounts and percentages."""
    today = datetime.now(timezone.utc).date()
    _start = start_date or today.replace(day=1)
    _end = end_date or today

    rows = await db.execute(
        select(
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("cnt"),
        )
        .where(_active_expenses(user_id, _start, _end))
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )

    results = rows.all()
    total_expenses = sum(_to_float(r[1]) for r in results)

    items: list[CategoryBreakdownItem] = []
    for row in results:
        cat, total, cnt = row
        amt = _to_float(total)
        pct = round(amt / total_expenses * 100, 2) if total_expenses > 0 else 0.0
        items.append(
            CategoryBreakdownItem(
                category=cat,
                total_amount=round(amt, 2),
                transaction_count=cnt,
                percentage=pct,
            )
        )

    return CategoryBreakdownResponse(
        start_date=_start,
        end_date=_end,
        total_expenses=round(total_expenses, 2),
        items=items,
    )


# ---------------------------------------------------------------------------
# Payment Method Breakdown
# ---------------------------------------------------------------------------


async def get_payment_method_breakdown(
    user_id: uuid.UUID,
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> PaymentMethodBreakdownResponse:
    """Group expenses by payment method, calculate amounts and percentages."""
    today = datetime.now(timezone.utc).date()
    _start = start_date or today.replace(day=1)
    _end = end_date or today

    rows = await db.execute(
        select(
            Transaction.payment_method,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("cnt"),
        )
        .where(_active_expenses(user_id, _start, _end))
        .group_by(Transaction.payment_method)
        .order_by(func.sum(Transaction.amount).desc())
    )

    results = rows.all()
    total_expenses = sum(_to_float(r[1]) for r in results)

    items: list[PaymentMethodBreakdownItem] = []
    for row in results:
        pm, total, cnt = row
        amt = _to_float(total)
        pct = round(amt / total_expenses * 100, 2) if total_expenses > 0 else 0.0
        items.append(
            PaymentMethodBreakdownItem(
                payment_method=pm,
                total_amount=round(amt, 2),
                transaction_count=cnt,
                percentage=pct,
            )
        )

    return PaymentMethodBreakdownResponse(
        start_date=_start,
        end_date=_end,
        total_expenses=round(total_expenses, 2),
        items=items,
    )


# ---------------------------------------------------------------------------
# Period Comparison
# ---------------------------------------------------------------------------


async def _compute_period_summary(
    user_id: uuid.UUID,
    start: date,
    end: date,
    db: AsyncSession,
) -> PeriodSummary:
    """Compute income, expenses, and top category for a given date range."""
    # ponytail: 4 queries → 2 via conditional aggregation
    agg_result = await db.execute(
        select(
            func.sum(case((Transaction.type == "INCOME", Transaction.amount), else_=0)).label("income"),
            func.sum(case((Transaction.type == "EXPENSE", Transaction.amount), else_=0)).label("expenses"),
            func.count(Transaction.id).label("txn_count"),
        ).where(
            and_(
                Transaction.user_id == str(user_id),
                Transaction.deleted_at.is_(None),
                Transaction.transaction_date >= start,
                Transaction.transaction_date <= end,
            )
        )
    )
    agg = agg_result.one()
    total_income = _to_float(agg.income)
    total_expenses = _to_float(agg.expenses)
    txn_count = agg.txn_count or 0

    top_cat_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(_active_expenses(user_id, start, end))
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(1)
    )
    top_row = top_cat_result.first()
    top_category = top_row[0] if top_row else None

    return PeriodSummary(
        start_date=start,
        end_date=end,
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
        net_savings=round(total_income - total_expenses, 2),
        top_category=top_category,
        transaction_count=txn_count,
    )


async def get_comparison(
    user_id: uuid.UUID,
    db: AsyncSession,
    period_type: str,
    current_start: date,
    current_end: date,
    previous_start: date,
    previous_end: date,
) -> ComparisonResponse:
    """Compare two arbitrary date periods."""
    current = await _compute_period_summary(
        user_id, current_start, current_end, db
    )
    previous = await _compute_period_summary(
        user_id, previous_start, previous_end, db
    )

    return ComparisonResponse(
        period_type=period_type,
        current=current,
        previous=previous,
        income_change_pct=_safe_pct_change(
            current.total_income, previous.total_income
        ),
        expenses_change_pct=_safe_pct_change(
            current.total_expenses, previous.total_expenses
        ),
        savings_change_pct=_safe_pct_change(
            current.net_savings, previous.net_savings
        ),
    )
