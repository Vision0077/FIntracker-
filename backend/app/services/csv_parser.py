"""
Day 15: CSV Bank Statement Parser
==================================
Parses CSV exports from Indian banks and maps rows to TransactionCreate objects.

Supported column layouts (auto-detected):
  Layout A — HDFC / ICICI style:
    Date | Narration/Description | Chq/Ref | Value Date | Withdrawal | Deposit | Balance

  Layout B — SBI style:
    Txn Date | Description | Ref No | Debit | Credit | Balance

  Layout C — Generic / Fintrak export:
    date | description | amount | type | category | payment_method

  Layout D — Flat amount (positive = credit, negative = debit):
    Date | Description | Amount | Balance

Column aliases are matched case-insensitively with whitespace stripped.

Usage:
    rows, errors = parse_csv(file_bytes, filename="hdfc_jun.csv")
"""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from app.schemas.transaction import TransactionCreate


# ---------------------------------------------------------------------------
# Column alias maps — each list is tried in order, first match wins
# ---------------------------------------------------------------------------

DATE_COLS = [
    "date", "txn date", "transaction date", "value date",
    "posting date", "book date", "trans date",
]

DESC_COLS = [
    "description", "narration", "particulars", "remarks",
    "transaction details", "transaction description", "trans description",
    "details", "merchant", "merchant name",
]

DEBIT_COLS = [
    "debit", "withdrawal", "withdrawal amt", "debit amount",
    "dr", "dr amount", "amount debited",
]

CREDIT_COLS = [
    "credit", "deposit", "credit amount", "cr", "cr amount",
    "amount credited",
]

# Used when a single signed amount column is present (+deposit, -withdrawal)
AMOUNT_COLS = [
    "amount", "transaction amount", "txn amount", "net amount",
]

TYPE_COLS = ["type", "transaction type", "txn type"]

PAYMENT_METHOD_COLS = ["payment method", "payment_method", "mode", "mode of payment"]

CATEGORY_COLS = ["category", "expense category"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalise_header(h: str) -> str:
    """Lowercase + strip + collapse internal whitespace."""
    return re.sub(r"\s+", " ", h.strip().lower())


def _find_col(headers: list[str], aliases: list[str]) -> Optional[int]:
    """Return index of the first header that matches any alias, or None."""
    norm = [_normalise_header(h) for h in headers]
    for alias in aliases:
        for i, h in enumerate(norm):
            if h == alias:
                return i
    return None


def _parse_date(raw: str) -> Optional[date]:
    """Try several common Indian date formats."""
    raw = raw.strip()
    formats = [
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
        "%Y-%m-%d",                    # ISO
        "%d %b %Y", "%d-%b-%Y",        # 12 Jun 2024
        "%d %b %y", "%d-%b-%y",        # 12 Jun 24
        "%m/%d/%Y",                    # US format (fallback)
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(raw: str) -> Optional[Decimal]:
    """
    Parse currency string to Decimal.
    Handles: '1,23,456.78', '₹1234', '(500)', '-500', '1 234.50'
    Returns None if unparseable.
    """
    raw = raw.strip()
    if not raw or raw in ("-", "—", "nil", "n/a"):
        return None
    # Remove currency symbols, commas, spaces
    cleaned = re.sub(r"[₹$,\s]", "", raw)
    # Parentheses = negative: (500) -> -500
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1]
    try:
        val = Decimal(cleaned)
        return val
    except InvalidOperation:
        return None


def _detect_payment_method(description: str) -> str:
    """Heuristic: infer payment method from transaction description."""
    desc = description.lower()
    if any(kw in desc for kw in ["upi", "gpay", "phonepe", "paytm", "bhim", "neft", "imps", "rtgs"]):
        return "UPI"
    if any(kw in desc for kw in ["atm", "pos", "swipe", "card", "visa", "mastercard", "rupay"]):
        return "CARD"
    if any(kw in desc for kw in ["wallet", "mobikwik", "freecharge", "airtel money"]):
        return "WALLET"
    if any(kw in desc for kw in ["nach", "ecs", "subscription", "auto-debit", "mandate"]):
        return "SUBSCRIPTION"
    return "UPI"  # default for digital banking


# ---------------------------------------------------------------------------
# Core parser
# ---------------------------------------------------------------------------


class ParseError(Exception):
    """Raised when a row cannot be parsed."""
    pass


def _build_transaction(
    row_num: int,
    txn_date: date,
    description: str,
    amount: Decimal,
    txn_type: str,
    payment_method: str,
    category: Optional[str],
    user_id: uuid.UUID,
) -> TransactionCreate:
    """Validate and build a TransactionCreate from parsed row fields."""
    if amount <= 0:
        raise ParseError(f"Row {row_num}: amount must be > 0 (got {amount})")

    from app.services.transaction_service import ai_suggest_category

    auto_category = category or ai_suggest_category(
        description=description,
        amount=float(amount),
        payment_method=payment_method,
    )

    return TransactionCreate(
        amount=float(amount),
        type=txn_type,
        payment_method=payment_method,
        description=description[:512],
        raw_merchant_name=description[:255],
        category=auto_category,
        transaction_date=txn_date,
        provider_transaction_id=f"csv-{user_id}-{txn_date.isoformat()}-{abs(hash(description + str(amount))) % 10**9}",
    )


def parse_csv(
    file_bytes: bytes,
    filename: str,
    user_id: uuid.UUID,
    default_payment_method: str = "UPI",
) -> tuple[list[TransactionCreate], list[str]]:
    """
    Parse a CSV bank statement.

    Returns:
        (transactions, errors)
        transactions — list of TransactionCreate ready to insert
        errors       — list of human-readable error strings for skipped rows
    """
    transactions: list[TransactionCreate] = []
    errors: list[str] = []

    # Decode bytes — try UTF-8 then fall back to latin-1 (common for bank exports)
    try:
        text = file_bytes.decode("utf-8-sig")   # utf-8-sig strips BOM
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1")

    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    # Skip completely empty leading rows (some banks add header blurb)
    header_row_idx = 0
    for i, row in enumerate(rows):
        non_empty = [c for c in row if c.strip()]
        if len(non_empty) >= 3:
            header_row_idx = i
            break

    if header_row_idx >= len(rows):
        errors.append("Could not find a valid header row with at least 3 columns.")
        return transactions, errors

    headers = rows[header_row_idx]
    data_rows = rows[header_row_idx + 1:]

    # Detect column indices
    date_idx    = _find_col(headers, DATE_COLS)
    desc_idx    = _find_col(headers, DESC_COLS)
    debit_idx   = _find_col(headers, DEBIT_COLS)
    credit_idx  = _find_col(headers, CREDIT_COLS)
    amount_idx  = _find_col(headers, AMOUNT_COLS)
    type_idx    = _find_col(headers, TYPE_COLS)
    method_idx  = _find_col(headers, PAYMENT_METHOD_COLS)
    cat_idx     = _find_col(headers, CATEGORY_COLS)

    if date_idx is None:
        errors.append(
            f"No date column found. Expected one of: {DATE_COLS[:4]}. "
            f"Found headers: {headers}"
        )
        return transactions, errors

    if desc_idx is None:
        errors.append(
            f"No description column found. Expected one of: {DESC_COLS[:4]}. "
            f"Found headers: {headers}"
        )
        return transactions, errors

    has_debit_credit = debit_idx is not None and credit_idx is not None
    has_amount = amount_idx is not None

    if not has_debit_credit and not has_amount:
        errors.append(
            "No amount column found. Need either debit+credit columns "
            "or a single signed amount column. "
            f"Found headers: {headers}"
        )
        return transactions, errors

    # Parse rows
    for row_num, row in enumerate(data_rows, start=header_row_idx + 2):
        # Skip blank rows
        if not any(c.strip() for c in row):
            continue

        # Pad short rows (some banks omit trailing empty cols)
        while len(row) <= max(
            date_idx,
            desc_idx,
            debit_idx or 0,
            credit_idx or 0,
            amount_idx or 0,
        ):
            row.append("")

        # --- Date ---
        raw_date = row[date_idx].strip()
        if not raw_date:
            errors.append(f"Row {row_num}: empty date, skipping.")
            continue
        txn_date = _parse_date(raw_date)
        if txn_date is None:
            errors.append(f"Row {row_num}: unrecognised date format '{raw_date}', skipping.")
            continue

        # --- Description ---
        description = row[desc_idx].strip()
        if not description:
            description = "Unknown transaction"

        # --- Amount and type ---
        if has_debit_credit:
            debit_raw  = row[debit_idx].strip()  if debit_idx  is not None else ""
            credit_raw = row[credit_idx].strip() if credit_idx is not None else ""
            debit  = _parse_amount(debit_raw)
            credit = _parse_amount(credit_raw)

            if debit and debit > 0:
                amount = debit
                txn_type = "EXPENSE"
            elif credit and credit > 0:
                amount = credit
                txn_type = "INCOME"
            else:
                errors.append(f"Row {row_num}: both debit and credit are empty/zero, skipping.")
                continue

        else:  # single signed amount col
            raw_amt = row[amount_idx].strip() if amount_idx is not None else ""
            parsed = _parse_amount(raw_amt)
            if parsed is None:
                errors.append(f"Row {row_num}: cannot parse amount '{raw_amt}', skipping.")
                continue
            if parsed < 0:
                amount = abs(parsed)
                txn_type = "EXPENSE"
            elif parsed > 0:
                amount = parsed
                # Check if type col gives explicit direction
                if type_idx is not None:
                    raw_type = row[type_idx].strip().upper()
                    txn_type = "INCOME" if raw_type in ("INCOME", "CR", "CREDIT") else "EXPENSE"
                else:
                    txn_type = "INCOME"
            else:
                errors.append(f"Row {row_num}: zero-amount row, skipping.")
                continue

        # --- Payment method ---
        if method_idx is not None and row[method_idx].strip():
            raw_method = row[method_idx].strip().upper()
            valid_methods = {"UPI", "CARD", "WALLET", "SUBSCRIPTION", "CASH"}
            payment_method = raw_method if raw_method in valid_methods else _detect_payment_method(description)
        else:
            payment_method = _detect_payment_method(description)

        # --- Category ---
        category = None
        if cat_idx is not None and row[cat_idx].strip():
            category = row[cat_idx].strip().upper()

        # --- Build TransactionCreate ---
        try:
            txn = _build_transaction(
                row_num=row_num,
                txn_date=txn_date,
                description=description,
                amount=amount,
                txn_type=txn_type,
                payment_method=payment_method,
                category=category,
                user_id=user_id,
            )
            transactions.append(txn)
        except ParseError as e:
            errors.append(str(e))
        except Exception as e:
            errors.append(f"Row {row_num}: unexpected error — {e}")

    return transactions, errors
