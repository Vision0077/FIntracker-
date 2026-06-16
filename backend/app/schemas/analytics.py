from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Dashboard Summary
# ---------------------------------------------------------------------------


class DashboardSummary(BaseModel):
    """Response for GET /api/v1/analytics/dashboard-summary."""

    total_balance: float = Field(
        ..., description="Sum of all account balances in INR"
    )
    monthly_income: float = Field(
        ..., description="Total income for the current month"
    )
    monthly_expenses: float = Field(
        ..., description="Total expenses for the current month"
    )
    net_savings: float = Field(
        ..., description="monthly_income - monthly_expenses"
    )
    top_category: Optional[str] = Field(
        None, description="Category with highest spend this month"
    )
    currency: str = "INR"


# ---------------------------------------------------------------------------
# Spending Trends
# ---------------------------------------------------------------------------

PeriodType = Literal[
    "daily",
    "weekly",
    "fortnightly",
    "monthly",
    "quarterly",
    "half_yearly",
    "yearly",
    "custom",
]


class TrendDataPoint(BaseModel):
    """Single data point in a spending trend series."""

    label: str = Field(..., description="Date or period label, e.g. '2024-06-01'")
    income: float = 0.0
    expenses: float = 0.0
    net: float = 0.0


class SpendingTrendsResponse(BaseModel):
    """Response for GET /api/v1/analytics/spending-trends."""

    period: str
    start_date: date
    end_date: date
    data: list[TrendDataPoint]
    total_income: float
    total_expenses: float
    net_savings: float
    currency: str = "INR"


# ---------------------------------------------------------------------------
# Category Breakdown
# ---------------------------------------------------------------------------


class CategoryBreakdownItem(BaseModel):
    """Single category in the breakdown."""

    category: str
    total_amount: float
    transaction_count: int
    percentage: float = Field(..., description="Percentage of total spend")


class CategoryBreakdownResponse(BaseModel):
    """Response for GET /api/v1/analytics/category-breakdown."""

    start_date: date
    end_date: date
    total_expenses: float
    items: list[CategoryBreakdownItem]
    currency: str = "INR"


# ---------------------------------------------------------------------------
# Payment Method Breakdown
# ---------------------------------------------------------------------------


class PaymentMethodBreakdownItem(BaseModel):
    """Single payment method in the breakdown."""

    payment_method: str
    total_amount: float
    transaction_count: int
    percentage: float


class PaymentMethodBreakdownResponse(BaseModel):
    """Response for GET /api/v1/analytics/payment-method-breakdown."""

    start_date: date
    end_date: date
    total_expenses: float
    items: list[PaymentMethodBreakdownItem]
    currency: str = "INR"


# ---------------------------------------------------------------------------
# Period Comparison
# ---------------------------------------------------------------------------


class PeriodSummary(BaseModel):
    """Summarised stats for one comparison period."""

    start_date: date
    end_date: date
    total_income: float
    total_expenses: float
    net_savings: float
    top_category: Optional[str] = None
    transaction_count: int


class ComparisonResponse(BaseModel):
    """Response for GET /api/v1/analytics/comparison."""

    period_type: str
    current: PeriodSummary
    previous: PeriodSummary
    income_change_pct: float = Field(
        ..., description="% change in income (positive = up)"
    )
    expenses_change_pct: float = Field(
        ..., description="% change in expenses (positive = up)"
    )
    savings_change_pct: float
    currency: str = "INR"
