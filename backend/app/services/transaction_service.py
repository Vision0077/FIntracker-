from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionRead,
    TransactionUpdate,
    UploadResponse,
)


# ---------------------------------------------------------------------------
# AI Categorisation Scaffold
# ---------------------------------------------------------------------------


async def ai_suggest_category(
    description: str,
    amount: float,
    payment_method: str,
) -> str:
    """
    AI Categorization Engine - Scaffold Hook

    TODO: Integrate ML model here.
    Pattern: Analyze transaction description + amount + payment_method
    to suggest the most appropriate category.

    Future implementation:
    1. Load trained model (scikit-learn / TensorFlow)
    2. Preprocess description (tokenize, clean merchant names)
    3. Predict category from trained patterns
    4. Return category string

    Special rules:
    - Regular recurring amounts (rent, subscriptions) → not flagged as anomalies
    - Inflation-aware: gradually increasing amounts in same category → normal
    - Only flag sudden spikes or new categories as concerns
    """
    # Placeholder heuristics until ML model is integrated
    desc_lower = description.lower()
    if any(
        word in desc_lower
        for word in ["zomato", "swiggy", "food", "restaurant", "cafe", "hotel", "eat"]
    ):
        return "FOOD"
    elif any(
        word in desc_lower
        for word in [
            "uber",
            "ola",
            "rapido",
            "metro",
            "train",
            "flight",
            "petrol",
            "fuel",
        ]
    ):
        return "TRAVEL"
    elif any(
        word in desc_lower
        for word in [
            "netflix",
            "spotify",
            "amazon prime",
            "hotstar",
            "subscription",
        ]
    ):
        return "SUBSCRIPTION"
    elif any(
        word in desc_lower
        for word in ["salary", "payroll", "stipend", "income"]
    ):
        return "SALARY"
    elif any(word in desc_lower for word in ["rent", "emi", "loan"]):
        return "MISCELLANEOUS"
    else:
        return "MISCELLANEOUS"


# ---------------------------------------------------------------------------
# Base query helper
# ---------------------------------------------------------------------------


def _active_transactions_query(user_id: uuid.UUID):
    """Return a base select that filters by user and excludes soft-deleted rows."""
    return select(Transaction).where(
        and_(
            Transaction.user_id == str(user_id),
            Transaction.deleted_at.is_(None),
        )
    )


# ---------------------------------------------------------------------------
# CRUD operations
# ---------------------------------------------------------------------------


async def list_transactions(
    user_id: uuid.UUID,
    db: AsyncSession,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    payment_method: Optional[str] = None,
    type_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> TransactionListResponse:
    """
    Return a paginated, filtered list of transactions for a user.
    """
    page_size = min(page_size, 100)  # cap
    offset = (page - 1) * page_size

    base = _active_transactions_query(user_id)

    if start_date is not None:
        base = base.where(Transaction.transaction_date >= start_date)
    if end_date is not None:
        base = base.where(Transaction.transaction_date <= end_date)
    if category is not None:
        base = base.where(Transaction.category == category.upper())
    if payment_method is not None:
        base = base.where(
            Transaction.payment_method == payment_method.upper()
        )
    if type_filter is not None:
        base = base.where(Transaction.type == type_filter.upper())

    # Count total matching records
    count_query = select(func.count()).select_from(base.subquery())
    total_result = await db.execute(count_query)
    total: int = total_result.scalar_one()

    # Fetch page
    page_query = (
        base.order_by(
            Transaction.transaction_date.desc(),
            Transaction.created_at.desc(),
        )
        .offset(offset)
        .limit(page_size)
    )
    rows = await db.execute(page_query)
    transactions = rows.scalars().all()

    total_pages = max(1, math.ceil(total / page_size))

    return TransactionListResponse(
        items=[TransactionRead.model_validate(t) for t in transactions],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def create_transaction(
    user_id: uuid.UUID,
    payload: TransactionCreate,
    db: AsyncSession,
) -> Transaction:
    """
    Create a new transaction and run AI categorisation scaffold.
    """
    # Resolve default account for this payment method if none provided
    account_id = payload.account_id
    if not account_id:
        from app.models.account import Account
        stmt = select(Account).where(
            and_(
                Account.user_id == str(user_id),
                Account.payment_method == payload.payment_method.upper()
            )
        )
        res = await db.execute(stmt)
        account = res.scalar_one_or_none()
        if not account:
            account = Account(
                id=str(uuid.uuid4()),
                user_id=str(user_id),
                name=f"Default {payload.payment_method.upper()} Account",
                type="manual" if payload.payment_method.upper() in ["CASH", "SUBSCRIPTION"] else payload.payment_method.lower(),
                payment_method=payload.payment_method.upper(),
                balance=0.0,
                currency="INR"
            )
            db.add(account)
            await db.flush()
        account_id = uuid.UUID(account.id) if isinstance(account.id, str) else account.id

    # Run AI suggestion
    ai_category = await ai_suggest_category(
        description=payload.description,
        amount=payload.amount,
        payment_method=payload.payment_method,
    )

    transaction = Transaction(
        id=str(uuid.uuid4()),
        user_id=str(user_id),
        account_id=str(account_id) if account_id else None,
        provider_transaction_id=payload.provider_transaction_id,
        amount=payload.amount,
        type=payload.type,
        payment_method=payload.payment_method,
        description=payload.description,
        raw_merchant_name=payload.raw_merchant_name,
        category=payload.category,
        subcategory=payload.subcategory,
        ai_suggested_category=ai_category,
        transaction_date=payload.transaction_date,
        is_pending=payload.is_pending,
    )
    db.add(transaction)
    await db.flush()

    # Update account balance
    from app.models.account import Account
    balance_delta = float(payload.amount) if payload.type == "INCOME" else -float(payload.amount)
    await db.execute(
        update(Account)
        .where(Account.id == str(account_id))
        .values(balance=Account.balance + balance_delta)
    )

    # Update budget current_spent for this category + month
    await _update_budget_spent(
        user_id=user_id,
        category=payload.category,
        payment_method=payload.payment_method,
        month_year=payload.transaction_date.strftime("%Y-%m"),
        delta=float(payload.amount) if payload.type == "EXPENSE" else 0.0,
        db=db,
    )

    return transaction


async def get_transaction(
    transaction_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Transaction:
    """Fetch a single transaction owned by the user."""
    result = await db.execute(
        _active_transactions_query(user_id).where(
            Transaction.id == str(transaction_id)
        )
    )
    transaction = result.scalar_one_or_none()
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found.",
        )
    return transaction


async def update_transaction(
    transaction_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: TransactionUpdate,
    db: AsyncSession,
) -> Transaction:
    """Update mutable fields of a transaction."""
    transaction = await get_transaction(transaction_id, user_id, db)

    update_data = payload.model_dump(exclude_unset=True)

    # If category / payment_method changes, re-run AI suggestion
    desc = update_data.get("description", transaction.description)
    amount = float(update_data.get("amount", transaction.amount))
    pm = update_data.get("payment_method", transaction.payment_method)

    if any(k in update_data for k in ("description", "amount", "payment_method")):
        update_data["ai_suggested_category"] = await ai_suggest_category(
            description=desc, amount=amount, payment_method=pm
        )

    for field, value in update_data.items():
        setattr(transaction, field, value)

    await db.flush()
    return transaction


async def soft_delete_transaction(
    transaction_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Soft-delete a transaction by setting deleted_at."""
    transaction = await get_transaction(transaction_id, user_id, db)
    transaction.deleted_at = datetime.now(timezone.utc)
    
    # Reverse the account balance
    if transaction.account_id:
        from app.models.account import Account
        from sqlalchemy import update
        reverse_delta = float(transaction.amount) if transaction.type == "EXPENSE" else -float(transaction.amount)
        await db.execute(
            update(Account)
            .where(Account.id == str(transaction.account_id))
            .values(balance=Account.balance + reverse_delta)
        )

    await db.flush()


# ---------------------------------------------------------------------------
# Budget helper
# ---------------------------------------------------------------------------


async def _update_budget_spent(
    user_id: uuid.UUID,
    category: str,
    payment_method: str,
    month_year: str,
    delta: float,
    db: AsyncSession,
) -> None:
    """
    Increment current_spent on matching budgets when an EXPENSE is created.
    No-op if delta is 0 (i.e. transaction is INCOME).
    """
    if delta <= 0:
        return

    from app.models.budget import Budget

    # Match budgets for this user/category/month (payment_method optional)
    await db.execute(
        update(Budget)
        .where(
            and_(
                Budget.user_id == str(user_id),
                Budget.category == category,
                Budget.month_year == month_year,
            )
        )
        .values(current_spent=Budget.current_spent + delta)
    )
