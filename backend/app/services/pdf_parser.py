"""
Day 16: PDF Bank Statement Parser
===================================
Parses PDF bank statement exports from Indian banks using pdfplumber.

Strategy (in order):
  1. Table extraction — pdfplumber detects bordered/bordlerless tables.
     Each page's tables are flattened into rows and passed to the same
     alias-based column matcher used by csv_parser.
  2. Text-line fallback — if no table is found on a page, raw text lines
     are extracted and split by 2+ consecutive spaces (common in
     monospaced PDF statements from SBI, Axis, Kotak).

Supported bank layouts (auto-detected via column aliases):
  HDFC:  Date | Narration | Chq/Ref No. | Value Date | Withdrawal Amt. | Deposit Amt. | Closing Balance
  SBI:   Txn Date | Description | Ref No. | Debit | Credit | Balance
  ICICI: S No | Value Date | Transaction Remarks | Cheque Number | Amount | Dr/Cr
  Axis:  Tran Date | PARTICULARS | Chq No | Debit | Credit | Balance
  Generic: any layout recognised by csv_parser column aliases

Usage:
    txns, errors = parse_pdf(file_bytes, filename="hdfc_jun.pdf", user_id=uid)
"""
from __future__ import annotations

import io
import re
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

# csv_parser helpers are reused here to avoid duplication
from app.services.csv_parser import (
    DATE_COLS,
    DESC_COLS,
    DEBIT_COLS,
    CREDIT_COLS,
    AMOUNT_COLS,
    TYPE_COLS,
    PAYMENT_METHOD_COLS,
    CATEGORY_COLS,
    _normalise_header,
    _find_col,
    _parse_date,
    _parse_amount,
    _detect_payment_method,
    _build_transaction,
    ParseError,
)
from app.schemas.transaction import TransactionCreate


# ---------------------------------------------------------------------------
# ICICI-specific helpers
# ---------------------------------------------------------------------------

# ICICI uses a single "Amount" column + a "Dr/Cr" indicator column
ICICI_DRCR_COLS = ["dr/cr", "dr / cr", "type", "cr/dr", "ind", "indicator"]


def _is_icici_layout(headers: list[str]) -> bool:
    """Detect ICICI statement: has Amount + Dr/Cr columns."""
    norm = [_normalise_header(h) for h in headers]
    has_amount = any(h in AMOUNT_COLS for h in norm)
    has_drcr = any(h in ICICI_DRCR_COLS for h in norm)
    return has_amount and has_drcr


def _find_col_partial(headers: list[str], aliases: list[str]) -> Optional[int]:
    """Like _find_col but also matches if the header CONTAINS any alias (substring)."""
    norm = [_normalise_header(h) for h in headers]
    # Exact match first
    for alias in aliases:
        for i, h in enumerate(norm):
            if h == alias:
                return i
    # Substring match fallback (useful for PDF headers that have extra chars)
    for alias in aliases:
        for i, h in enumerate(norm):
            if alias in h:
                return i
    return None


# ---------------------------------------------------------------------------
# Table → rows converter
# ---------------------------------------------------------------------------


def _table_to_rows(table: list[list]) -> list[list[str]]:
    """
    Convert pdfplumber table (list of lists, possibly with None cells)
    to list of string-cell rows. Empty trailing rows are stripped.
    """
    rows = []
    for raw_row in table:
        if raw_row is None:
            continue
        # Replace None cells with empty string; strip whitespace; collapse newlines
        cleaned = [
            re.sub(r"[\n\r]+", " ", (cell or "").strip())
            for cell in raw_row
        ]
        # Skip completely blank rows
        if any(c for c in cleaned):
            rows.append(cleaned)
    return rows


# ---------------------------------------------------------------------------
# Text-line fallback extractor
# ---------------------------------------------------------------------------


def _text_lines_to_rows(text: str) -> list[list[str]]:
    """
    Split raw text lines by 2+ consecutive spaces → column approximation.
    Used when pdfplumber finds no tables on a page (text-only PDFs).
    """
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        # Split on 2+ spaces (column separator in monospaced statements)
        parts = re.split(r"  +", line)
        parts = [p.strip() for p in parts if p.strip()]
        if len(parts) >= 3:
            rows.append(parts)
    return rows


# ---------------------------------------------------------------------------
# Single-page parser — common for both table and text-line rows
# ---------------------------------------------------------------------------


def _parse_rows(
    headers: list[str],
    data_rows: list[list[str]],
    user_id: uuid.UUID,
    page_label: str,
) -> tuple[list[TransactionCreate], list[str]]:
    """
    Parse data rows given a header row.
    Mirrors csv_parser logic but adapted for PDF (no encoding, no csv.reader).
    """
    transactions: list[TransactionCreate] = []
    errors: list[str] = []

    date_idx   = _find_col_partial(headers, DATE_COLS)
    desc_idx   = _find_col_partial(headers, DESC_COLS)
    debit_idx  = _find_col_partial(headers, DEBIT_COLS)
    credit_idx = _find_col_partial(headers, CREDIT_COLS)
    amount_idx = _find_col_partial(headers, AMOUNT_COLS)
    type_idx   = _find_col_partial(headers, TYPE_COLS)
    method_idx = _find_col_partial(headers, PAYMENT_METHOD_COLS)
    cat_idx    = _find_col_partial(headers, CATEGORY_COLS)

    # ICICI: Amount + Dr/Cr indicator
    drcr_col_aliases = ICICI_DRCR_COLS
    drcr_idx = None
    norm_headers = [_normalise_header(h) for h in headers]
    for alias in drcr_col_aliases:
        for i, h in enumerate(norm_headers):
            if h == alias or alias in h:
                drcr_idx = i
                break
        if drcr_idx is not None:
            break

    if date_idx is None or desc_idx is None:
        errors.append(
            f"{page_label}: Could not identify date/description columns. "
            f"Headers found: {headers}"
        )
        return transactions, errors

    has_debit_credit = debit_idx is not None and credit_idx is not None
    has_amount = amount_idx is not None

    if not has_debit_credit and not has_amount:
        errors.append(
            f"{page_label}: No amount column found. Headers: {headers}"
        )
        return transactions, errors

    for row_num, row in enumerate(data_rows, start=2):
        # Ensure row is wide enough
        max_idx = max(
            date_idx, desc_idx,
            debit_idx or 0, credit_idx or 0,
            amount_idx or 0, drcr_idx or 0,
        )
        if len(row) <= max_idx:
            row = row + [""] * (max_idx + 1 - len(row))

        # --- Date ---
        raw_date = row[date_idx].strip()
        if not raw_date:
            continue  # header continuation or blank row
        txn_date = _parse_date(raw_date)
        if txn_date is None:
            # Likely a non-data row (totals row, page header repeat, etc.)
            continue

        # --- Description ---
        description = row[desc_idx].strip()
        if not description:
            description = "Unknown transaction"

        # --- Amount and type ---
        if has_debit_credit:
            debit  = _parse_amount(row[debit_idx])  if debit_idx  is not None else None
            credit = _parse_amount(row[credit_idx]) if credit_idx is not None else None

            if debit and debit > 0:
                amount, txn_type = debit, "EXPENSE"
            elif credit and credit > 0:
                amount, txn_type = credit, "INCOME"
            else:
                continue  # balance-only row or running total

        else:
            # Single amount col, possibly with Dr/Cr indicator
            raw_amt = row[amount_idx].strip() if amount_idx is not None else ""
            parsed = _parse_amount(raw_amt)
            if parsed is None:
                continue
            if parsed == 0:
                continue

            abs_amount = abs(parsed)

            if drcr_idx is not None:
                raw_indicator = row[drcr_idx].strip().upper()
                # Dr → expense, Cr → income
                if raw_indicator in ("DR", "D", "DEBIT", "WITHDRAWAL"):
                    txn_type = "EXPENSE"
                elif raw_indicator in ("CR", "C", "CREDIT", "DEPOSIT"):
                    txn_type = "INCOME"
                else:
                    txn_type = "EXPENSE" if parsed < 0 else "INCOME"
            elif type_idx is not None:
                raw_type = row[type_idx].strip().upper()
                txn_type = "INCOME" if raw_type in ("INCOME", "CR", "CREDIT") else "EXPENSE"
            else:
                txn_type = "EXPENSE" if parsed < 0 else "INCOME"

            amount = abs_amount

        # --- Payment method ---
        if method_idx is not None and len(row) > method_idx and row[method_idx].strip():
            raw_method = row[method_idx].strip().upper()
            valid_methods = {"UPI", "CARD", "WALLET", "SUBSCRIPTION", "CASH"}
            payment_method = raw_method if raw_method in valid_methods else _detect_payment_method(description)
        else:
            payment_method = _detect_payment_method(description)

        # --- Category ---
        category = None
        if cat_idx is not None and len(row) > cat_idx and row[cat_idx].strip():
            category = row[cat_idx].strip().upper()

        # --- Build ---
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
            errors.append(f"{page_label} row {row_num}: {e}")

    return transactions, errors


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def parse_pdf(
    file_bytes: bytes,
    filename: str,
    user_id: uuid.UUID,
) -> tuple[list[TransactionCreate], list[str]]:
    """
    Parse a PDF bank statement using pdfplumber.

    Strategy per page:
      1. Extract tables (pdfplumber's table finder handles bordered + borderless)
      2. If no tables found → fall back to text-line splitting by 2+ spaces
      3. First non-empty row of each table/block treated as header
      4. Remaining rows parsed via _parse_rows (same logic as CSV parser)

    Returns:
        (transactions, errors)
        transactions — list[TransactionCreate] ready to insert
        errors       — list[str] per-page / per-row messages for bad rows
    """
    try:
        import pdfplumber
    except ImportError:
        return [], ["pdfplumber is not installed. Run: pip install pdfplumber==0.11.4"]

    all_transactions: list[TransactionCreate] = []
    all_errors: list[str] = []

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if not pdf.pages:
                return [], ["PDF has no pages."]

            for page_num, page in enumerate(pdf.pages, start=1):
                page_label = f"Page {page_num}"

                # ── Strategy 1: table extraction ──────────────────────────────
                tables = page.extract_tables(
                    table_settings={
                        "vertical_strategy": "lines_strict",
                        "horizontal_strategy": "lines_strict",
                        "snap_tolerance": 3,
                        "join_tolerance": 3,
                        "edge_min_length": 3,
                    }
                )

                # Fallback to looser settings if strict finds nothing
                if not tables:
                    tables = page.extract_tables(
                        table_settings={
                            "vertical_strategy": "text",
                            "horizontal_strategy": "text",
                            "snap_tolerance": 5,
                            "join_tolerance": 5,
                        }
                    )

                if tables:
                    for t_idx, table in enumerate(tables):
                        rows = _table_to_rows(table)
                        if len(rows) < 2:
                            continue  # need at least header + 1 data row

                        # First row = header
                        headers = rows[0]
                        data_rows = rows[1:]

                        txns, errs = _parse_rows(
                            headers=headers,
                            data_rows=data_rows,
                            user_id=user_id,
                            page_label=f"{page_label} Table {t_idx + 1}",
                        )
                        all_transactions.extend(txns)
                        all_errors.extend(errs)

                else:
                    # ── Strategy 2: text-line fallback ────────────────────────
                    text = page.extract_text() or ""
                    if not text.strip():
                        all_errors.append(f"{page_label}: no text or tables found, skipping.")
                        continue

                    rows = _text_lines_to_rows(text)
                    if len(rows) < 2:
                        all_errors.append(
                            f"{page_label}: text extracted but too few columns to identify header. Skipping."
                        )
                        continue

                    # Heuristic: find the row most likely to be a header
                    # (contains at least 2 of the common column keywords)
                    header_idx = 0
                    best_score = 0
                    all_aliases = DATE_COLS + DESC_COLS + DEBIT_COLS + CREDIT_COLS + AMOUNT_COLS
                    for i, row in enumerate(rows[:10]):  # only check first 10 rows
                        norm = [_normalise_header(c) for c in row]
                        score = sum(1 for cell in norm if any(a in cell for a in all_aliases))
                        if score > best_score:
                            best_score = score
                            header_idx = i

                    if best_score < 2:
                        # Can't identify header — try first row anyway
                        header_idx = 0

                    headers = rows[header_idx]
                    data_rows = rows[header_idx + 1:]

                    txns, errs = _parse_rows(
                        headers=headers,
                        data_rows=data_rows,
                        user_id=user_id,
                        page_label=f"{page_label} (text fallback)",
                    )
                    all_transactions.extend(txns)
                    all_errors.extend(errs)

    except Exception as e:
        all_errors.append(f"PDF open/parse failed: {e}")

    return all_transactions, all_errors
