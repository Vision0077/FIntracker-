from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionRead,
    TransactionUpdate,
    UploadResponse,
)
from app.services.auth_service import get_current_user
from app.services import transaction_service

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get(
    "",
    response_model=TransactionListResponse,
    summary="List transactions with optional filters",
)
async def list_transactions(
    start_date: Optional[date] = Query(
        default=None, description="Filter from this date (YYYY-MM-DD)"
    ),
    end_date: Optional[date] = Query(
        default=None, description="Filter up to this date (YYYY-MM-DD)"
    ),
    category: Optional[str] = Query(
        default=None,
        description="Filter by category: FOOD, TRAVEL, MISCELLANEOUS, SUBSCRIPTION, SALARY",
    ),
    payment_method: Optional[str] = Query(
        default=None,
        description="Filter by payment method: UPI, CARD, WALLET, SUBSCRIPTION, CASH",
    ),
    type: Optional[str] = Query(
        default=None, description="Filter by type: INCOME or EXPENSE"
    ),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(
        default=20, ge=1, le=100, description="Items per page (max 100)"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    """
    Return a paginated list of transactions for the current user.

    All filters are optional and combinable.
    Results are sorted by transaction_date DESC, then created_at DESC.
    Soft-deleted transactions are excluded.
    """
    return await transaction_service.list_transactions(
        user_id=current_user.id,
        db=db,
        start_date=start_date,
        end_date=end_date,
        category=category,
        payment_method=payment_method,
        type_filter=type,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="Upload bank statement for parsing (PDF / CSV / Excel)",
)
async def upload_statement(
    file: UploadFile = File(..., description="Bank statement: PDF, CSV, or Excel"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UploadResponse:
    """
    **Statement Upload Endpoint** — accepts PDF, CSV, or Excel files.

    - **CSV** — fully parsed and imported (Day 15).
    - **PDF** — coming in Day 16 (pdfplumber integration).
    - **Excel** — coming in Day 17 (openpyxl integration).

    CSV parsing supports HDFC, SBI, ICICI, and generic bank export formats.
    Duplicate transactions are detected via provider_transaction_id and skipped.
    """
    from fastapi import HTTPException

    allowed_extensions = (".pdf", ".csv", ".xlsx", ".xls", ".txt")
    allowed_content_types = {
        "application/pdf",
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/plain",
    }

    filename = file.filename or "unknown"
    content_type = file.content_type or "application/octet-stream"
    contents = await file.read()
    size_bytes = len(contents)

    # Validate file type
    is_csv = (
        content_type in {"text/csv", "text/plain"}
        or filename.lower().endswith((".csv", ".txt"))
    )
    is_pdf = (
        content_type == "application/pdf"
        or filename.lower().endswith(".pdf")
    )
    is_excel = (
        content_type in {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        }
        or filename.lower().endswith((".xlsx", ".xls"))
    )

    if not (is_csv or is_pdf or is_excel):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type '{content_type}'. "
                f"Please upload a PDF, CSV, or Excel (.xlsx) bank statement."
            ),
        )

    # --- Day 15: CSV fully implemented ---
    if is_csv:
        result = await transaction_service.parse_and_import_csv(
            file_bytes=contents,
            filename=filename,
            user_id=current_user.id,
            db=db,
        )
        total_parsed = result["imported"] + result["skipped"] + len(result["errors"])
        has_errors = bool(result["errors"])
        return UploadResponse(
            filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            status="parsed" if not has_errors else "partial",
            message=(
                f"CSV parsed: {result['imported']} imported, "
                f"{result['skipped']} duplicates skipped"
                + (f", {len(result['errors'])} rows had errors." if has_errors else ".")
            ),
            transactions_parsed=total_parsed,
            transactions_imported=result["imported"],
            transactions_skipped=result["skipped"],
            parse_errors=result["errors"][:20],   # cap at 20 to keep response size reasonable
        )

    # --- Day 16: PDF — fully implemented (pdfplumber) ---
    if is_pdf:
        result = await transaction_service.parse_and_import_pdf(
            file_bytes=contents,
            filename=filename,
            user_id=current_user.id,
            db=db,
        )
        total_parsed = result["imported"] + result["skipped"] + len(result["errors"])
        has_errors = bool(result["errors"])
        return UploadResponse(
            filename=filename,
            content_type=content_type,
            size_bytes=size_bytes,
            status="parsed" if not has_errors else "partial",
            message=(
                f"PDF parsed: {result['imported']} imported, "
                f"{result['skipped']} duplicates skipped"
                + (f", {len(result['errors'])} rows had errors." if has_errors else ".")
            ),
            transactions_parsed=total_parsed,
            transactions_imported=result["imported"],
            transactions_skipped=result["skipped"],
            parse_errors=result["errors"][:20],
        )

    # --- Day 17: Excel — coming soon ---
    return UploadResponse(
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        status="pending",
        message="Excel parsing coming in Day 17 (openpyxl integration). File received.",
        transactions_parsed=0,
    )



@router.post(
    "",
    response_model=TransactionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new transaction",
)
async def create_transaction(
    payload: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionRead:
    """
    Create a manual transaction.

    - `amount` must be positive; use `type` (INCOME/EXPENSE) for direction.
    - AI category suggestion is auto-populated in `ai_suggested_category`.
    - If a `provider_transaction_id` is provided, duplicate imports are prevented.
    """
    transaction = await transaction_service.create_transaction(
        user_id=current_user.id,
        payload=payload,
        db=db,
    )
    return TransactionRead.model_validate(transaction)


@router.get(
    "/{transaction_id}",
    response_model=TransactionRead,
    summary="Get a single transaction by ID",
)
async def get_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionRead:
    """
    Fetch a single transaction by its UUID.

    Returns **404** if not found or if it belongs to another user.
    """
    transaction = await transaction_service.get_transaction(
        transaction_id=transaction_id,
        user_id=current_user.id,
        db=db,
    )
    return TransactionRead.model_validate(transaction)


@router.put(
    "/{transaction_id}",
    response_model=TransactionRead,
    summary="Update a transaction",
)
async def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionRead:
    """
    Partially update a transaction. Only provided fields are changed.

    AI category is re-suggested if description, amount, or payment_method changes.
    """
    transaction = await transaction_service.update_transaction(
        transaction_id=transaction_id,
        user_id=current_user.id,
        payload=payload,
        db=db,
    )
    return TransactionRead.model_validate(transaction)


@router.delete(
    "/{transaction_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a transaction",
)
async def delete_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Soft-delete a transaction by setting `deleted_at` to the current timestamp.
    The record is excluded from all future queries but retained for audit.
    """
    await transaction_service.soft_delete_transaction(
        transaction_id=transaction_id,
        user_id=current_user.id,
        db=db,
    )
    return {"message": "Transaction deleted successfully."}
