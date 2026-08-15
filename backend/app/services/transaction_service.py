from __future__ import annotations

import math
import uuid
from decimal import Decimal
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.budget import Budget
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


def ai_suggest_category(
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
    # ponytail: heuristic stub; ceiling = keyword-match O(n*k). Upgrade path: sklearn/TF model.
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
    elif any(word in desc_lower for word in ["salary", "payroll", "stipend", "income"]):
        return "SALARY"
    elif any(word in desc_lower for word in ["rent"]):
        return "RENT"
    elif any(word in desc_lower for word in ["emi", "loan"]):
        return "BILLS"
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
    ai_category = ai_suggest_category(
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
    amount_decimal = Decimal(str(payload.amount))
    balance_delta = amount_decimal if payload.type == "INCOME" else -amount_decimal
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
        delta=Decimal(str(payload.amount)) if payload.type == "EXPENSE" else Decimal("0.0"),
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

    # Snapshot old budget-relevant values BEFORE applying changes
    old_category = transaction.category
    old_payment_method = transaction.payment_method
    old_amount = Decimal(str(transaction.amount))
    old_type = transaction.type
    old_month_year = transaction.transaction_date.strftime("%Y-%m")

    update_data = payload.model_dump(exclude_unset=True)

    # If category / payment_method changes, re-run AI suggestion
    desc = update_data.get("description", transaction.description)
    amount = float(update_data.get("amount", transaction.amount))
    pm = update_data.get("payment_method", transaction.payment_method)

    if any(k in update_data for k in ("description", "amount", "payment_method")):
        update_data["ai_suggested_category"] = ai_suggest_category(
            description=desc, amount=amount, payment_method=pm
        )

    for field, value in update_data.items():
        setattr(transaction, field, value)

    await db.flush()

    # Fix 2B: Reconcile budgets if any money/category/type field changed
    budget_fields = {"amount", "category", "type", "payment_method", "transaction_date"}
    if budget_fields & set(update_data.keys()):
        new_type = transaction.type
        new_month_year = transaction.transaction_date.strftime("%Y-%m")

        # Reverse the OLD budget contribution (if it was an expense)
        if old_type == "EXPENSE":
            await _update_budget_spent(
                user_id=user_id,
                category=old_category,
                payment_method=old_payment_method,
                month_year=old_month_year,
                delta=-old_amount,
                db=db,
            )

        # Apply the NEW budget contribution (if it is now an expense)
        if new_type == "EXPENSE":
            await _update_budget_spent(
                user_id=user_id,
                category=transaction.category,
                payment_method=transaction.payment_method,
                month_year=new_month_year,
                delta=Decimal(str(transaction.amount)),
                db=db,
            )

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
        reverse_delta = Decimal(str(transaction.amount)) if transaction.type == "EXPENSE" else -Decimal(str(transaction.amount))
        await db.execute(
            update(Account)
            .where(Account.id == str(transaction.account_id))
            .values(balance=Account.balance + reverse_delta)
        )

    # Fix 2A: Reverse the budget current_spent for EXPENSE transactions
    if transaction.type == "EXPENSE":
        await _update_budget_spent(
            user_id=user_id,
            category=transaction.category,
            payment_method=transaction.payment_method,
            month_year=transaction.transaction_date.strftime("%Y-%m"),
            delta=-Decimal(str(transaction.amount)),  # negative = reverse
            db=db,
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
    delta: Decimal,
    db: AsyncSession,
) -> None:
    """
    Increment (or decrement when delta < 0) current_spent on matching budgets.
    No-op if delta is 0 (i.e. transaction is INCOME with no change).
    Matches budgets scoped to user + category + month_year.
    If a budget has a specific payment_method, it is only updated when the
    transaction's payment_method matches — preventing cross-budget contamination.
    """
    if delta == 0:
        return

    # Fix 2C: Update budgets that either have no payment_method filter
    # OR whose payment_method exactly matches the transaction's payment_method.
    await db.execute(
        update(Budget)
        .where(
            and_(
                Budget.user_id == str(user_id),
                Budget.category == category,
                Budget.month_year == month_year,
                # Only touch budgets with matching or unset payment_method
                (Budget.payment_method == payment_method) | (Budget.payment_method.is_(None)),
            )
        )
        .values(current_spent=Budget.current_spent + delta)
    )


# ---------------------------------------------------------------------------
# Day 15: CSV Import
# ---------------------------------------------------------------------------


async def parse_and_import_csv(
    file_bytes: bytes,
    filename: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """
    Parse a CSV bank statement and bulk-insert valid transactions.

    Calls csv_parser.parse_csv() to extract TransactionCreate objects,
    then inserts each one via create_transaction() (which handles AI
    categorisation, budget updates, and dedup via provider_transaction_id).

    Duplicate handling:
      If a transaction with the same provider_transaction_id already exists
      for this user it is silently skipped (counted in 'skipped', not 'errors').

    Returns:
        {
            "imported": int,    -- rows successfully inserted
            "skipped": int,     -- duplicates skipped
            "errors": list[str] -- human-readable messages for invalid rows
        }
    """
    from app.services.csv_parser import parse_csv

    parsed_txns, parse_errors = parse_csv(
        file_bytes=file_bytes,
        filename=filename,
        user_id=user_id,
    )

    imported = 0
    skipped = 0
    import_errors: list[str] = list(parse_errors)  # include parse-time errors

    for txn in parsed_txns:
        # Dedup check: skip if provider_transaction_id already exists for user
        if txn.provider_transaction_id:
            existing = await db.execute(
                select(Transaction)
                .where(
                    and_(
                        Transaction.user_id == str(user_id),
                        Transaction.provider_transaction_id == txn.provider_transaction_id,
                        Transaction.deleted_at.is_(None),
                    )
                )
                .limit(1)
            )
            if existing.scalar_one_or_none() is not None:
                skipped += 1
                continue

        try:
            await create_transaction(
                user_id=user_id,
                payload=txn,
                db=db,
            )
            imported += 1
        except Exception as e:
            import_errors.append(f"Insert error for '{txn.description}': {e}")

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": import_errors,
    }


# ---------------------------------------------------------------------------
# Day 17: Excel Import
# ---------------------------------------------------------------------------


async def parse_and_import_excel(
    file_bytes: bytes,
    filename: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """
    Parse an Excel (.xlsx/.xls) bank statement and bulk-insert transactions.

    Mirrors parse_and_import_csv / parse_and_import_pdf exactly.
    Returns {imported, skipped, errors}.
    """
    from app.services.excel_parser import parse_excel

    parsed_txns, parse_errors = parse_excel(
        file_bytes=file_bytes,
        filename=filename,
        user_id=user_id,
    )

    imported = 0
    skipped = 0
    import_errors: list[str] = list(parse_errors)

    for txn in parsed_txns:
        if txn.provider_transaction_id:
            existing = await db.execute(
                select(Transaction)
                .where(
                    and_(
                        Transaction.user_id == str(user_id),
                        Transaction.provider_transaction_id == txn.provider_transaction_id,
                        Transaction.deleted_at.is_(None),
                    )
                )
                .limit(1)
            )
            if existing.scalar_one_or_none() is not None:
                skipped += 1
                continue

        try:
            await create_transaction(user_id=user_id, payload=txn, db=db)
            imported += 1
        except Exception as e:
            import_errors.append(f"Insert error for '{txn.description}': {e}")

    return {"imported": imported, "skipped": skipped, "errors": import_errors}


# ---------------------------------------------------------------------------
# Day 19: Preview (dry_run) — parse without inserting
# ---------------------------------------------------------------------------


async def parse_statement_preview(
    file_bytes: bytes,
    filename: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """
    Parse a statement file and return parsed rows WITHOUT inserting them.

    Used by the frontend review step (Day 18/19 stepper).
    Each row is returned as a plain dict with the fields the user will see.
    Also checks which rows would be duplicates (already exist in DB).

    Returns:
        {
            "rows": list[dict],   -- parsed transaction previews
            "errors": list[str],  -- parse-time errors
        }

    Row shape:
        {
            "date": "2024-06-12",
            "description": "UPI/ZOMATO",
            "amount": 450.0,
            "type": "EXPENSE",
            "payment_method": "UPI",
            "category": "FOOD",
            "is_duplicate": bool,  -- True if already imported
            "provider_transaction_id": str,
        }
    """
    from app.services.csv_parser import parse_csv
    from app.services.pdf_parser import parse_pdf
    from app.services.excel_parser import parse_excel

    fname_lower = filename.lower()
    if fname_lower.endswith((".xlsx", ".xls")):
        parsed_txns, parse_errors = parse_excel(file_bytes, filename, user_id)
    elif fname_lower.endswith(".pdf"):
        parsed_txns, parse_errors = parse_pdf(file_bytes, filename, user_id)
    else:
        parsed_txns, parse_errors = parse_csv(file_bytes, filename, user_id)

    rows = []
    for txn in parsed_txns:
        is_dup = False
        if txn.provider_transaction_id:
            existing = await db.execute(
                select(Transaction)
                .where(
                    and_(
                        Transaction.user_id == str(user_id),
                        Transaction.provider_transaction_id == txn.provider_transaction_id,
                        Transaction.deleted_at.is_(None),
                    )
                )
                .limit(1)
            )
            is_dup = existing.scalar_one_or_none() is not None

        rows.append({
            "date": txn.transaction_date.isoformat(),
            "description": txn.description,
            "amount": float(txn.amount),
            "type": txn.type,
            "payment_method": txn.payment_method,
            "category": txn.category,
            "is_duplicate": is_dup,
            "provider_transaction_id": txn.provider_transaction_id,
        })

    return {"rows": rows, "errors": parse_errors}

# ---------------------------------------------------------------------------
# Day 16: PDF Import
# ---------------------------------------------------------------------------


async def parse_and_import_pdf(
    file_bytes: bytes,
    filename: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    """
    Parse a PDF bank statement and bulk-insert valid transactions.

    Calls pdf_parser.parse_pdf() to extract TransactionCreate objects,
    then inserts each one via create_transaction() with the same
    dedup + error-isolation logic as parse_and_import_csv.

    Returns:
        {
            "imported": int,    -- rows successfully inserted
            "skipped": int,     -- duplicates skipped
            "errors": list[str] -- human-readable messages for invalid rows/pages
        }
    """
    from app.services.pdf_parser import parse_pdf

    parsed_txns, parse_errors = parse_pdf(
        file_bytes=file_bytes,
        filename=filename,
        user_id=user_id,
    )

    imported = 0
    skipped = 0
    import_errors: list[str] = list(parse_errors)

    for txn in parsed_txns:
        # Dedup check
        if txn.provider_transaction_id:
            existing = await db.execute(
                select(Transaction)
                .where(
                    and_(
                        Transaction.user_id == str(user_id),
                        Transaction.provider_transaction_id == txn.provider_transaction_id,
                        Transaction.deleted_at.is_(None),
                    )
                )
                .limit(1)
            )
            if existing.scalar_one_or_none() is not None:
                skipped += 1
                continue

        try:
            await create_transaction(
                user_id=user_id,
                payload=txn,
                db=db,
            )
            imported += 1
        except Exception as e:
            import_errors.append(f"Insert error for '{txn.description}': {e}")

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": import_errors,
    }
