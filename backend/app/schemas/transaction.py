from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums / Literals
# ---------------------------------------------------------------------------

TransactionType = Literal["INCOME", "EXPENSE"]

PaymentMethod = Literal["UPI", "CARD", "WALLET", "SUBSCRIPTION", "CASH"]

CategoryType = Literal[
    "FOOD", "TRAVEL", "MISCELLANEOUS", "SUBSCRIPTION", "SALARY",
    "RENT", "BILLS", "SERVICE", "PAYROLL"
]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


class TransactionCreate(BaseModel):
    """Payload for POST /api/v1/transactions."""

    account_id: Optional[uuid.UUID] = None
    amount: float = Field(..., gt=0, description="Positive amount in INR")
    type: TransactionType
    payment_method: PaymentMethod
    description: str = Field(default="", max_length=512)
    raw_merchant_name: Optional[str] = Field(default=None, max_length=255)
    category: str = Field(default="MISCELLANEOUS", max_length=100)
    subcategory: Optional[str] = Field(default=None, max_length=100)
    transaction_date: date
    is_pending: bool = False
    provider_transaction_id: Optional[str] = Field(
        default=None, max_length=255
    )

    @field_validator("category")
    @classmethod
    def category_uppercase(cls, v: str) -> str:
        return v.upper().strip()

    @field_validator("subcategory")
    @classmethod
    def subcategory_uppercase(cls, v: str | None) -> str | None:
        if v is not None:
            return v.upper().strip()
        return v


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


class TransactionUpdate(BaseModel):
    """Payload for PUT /api/v1/transactions/{id}. All fields optional."""

    amount: Optional[float] = Field(default=None, gt=0)
    type: Optional[TransactionType] = None
    payment_method: Optional[PaymentMethod] = None
    description: Optional[str] = Field(default=None, max_length=512)
    raw_merchant_name: Optional[str] = Field(default=None, max_length=255)
    category: Optional[str] = Field(default=None, max_length=100)
    subcategory: Optional[str] = Field(default=None, max_length=100)
    transaction_date: Optional[date] = None
    is_pending: Optional[bool] = None

    @field_validator("category")
    @classmethod
    def category_uppercase(cls, v: str | None) -> str | None:
        if v is not None:
            return v.upper().strip()
        return v

    @field_validator("subcategory")
    @classmethod
    def subcategory_uppercase(cls, v: str | None) -> str | None:
        if v is not None:
            return v.upper().strip()
        return v


# ---------------------------------------------------------------------------
# Read (response)
# ---------------------------------------------------------------------------


class TransactionRead(BaseModel):
    """Single transaction response."""

    id: uuid.UUID
    user_id: uuid.UUID
    account_id: Optional[uuid.UUID]  # nullable: manual transactions may have no account
    provider_transaction_id: Optional[str]
    amount: float
    type: str
    payment_method: str
    description: str
    raw_merchant_name: Optional[str]
    category: str
    subcategory: Optional[str]
    ai_suggested_category: Optional[str]
    transaction_date: date
    is_pending: bool
    created_at: datetime
    deleted_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Paginated list response
# ---------------------------------------------------------------------------


class TransactionListResponse(BaseModel):
    """Paginated transaction list."""

    items: list[TransactionRead]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Upload response stub
# ---------------------------------------------------------------------------


class UploadResponse(BaseModel):
    """Response for POST /api/v1/transactions/upload."""

    filename: str
    content_type: str
    size_bytes: int
    status: str = "received"           # 'received' | 'parsed' | 'partial' | 'pending' | 'error'
    message: str
    transactions_parsed: int = 0       # rows read from file
    transactions_imported: int = 0     # rows successfully inserted to DB
    transactions_skipped: int = 0      # duplicates skipped
    parse_errors: list[str] = []       # per-row error messages


# ---------------------------------------------------------------------------
# Day 19: Preview response
# ---------------------------------------------------------------------------


class UploadPreviewRow(BaseModel):
    """Single parsed row returned by the preview (dry-run) endpoint."""

    date: str                          # ISO date: "2024-06-12"
    description: str
    amount: float
    type: str                          # "INCOME" | "EXPENSE"
    payment_method: str
    category: str
    is_duplicate: bool                 # True if already imported
    provider_transaction_id: Optional[str]


class UploadPreviewResponse(BaseModel):
    """Response for POST /api/v1/transactions/upload/preview."""

    filename: str
    total_rows: int                    # total parsed rows
    new_rows: int                      # rows not yet in DB
    duplicate_rows: int                # rows already in DB
    rows: list[UploadPreviewRow]       # full row details for review table
    errors: list[str] = []            # parse-time errors


# ---------------------------------------------------------------------------
# Day 20: Duplicate detection
# ---------------------------------------------------------------------------


class DuplicateGroup(BaseModel):
    """A cluster of transaction IDs that are likely duplicates of each other."""
    ids: list[str]                     # transaction IDs in this group
    reason: str                        # human-readable reason (e.g. "Same amount ₹450 on 2024-06-12")
    amount: float
    date: str                          # ISO date of the group
    description: str                   # representative description


class DuplicatesResponse(BaseModel):
    """Response for GET /api/v1/transactions/duplicates."""
    groups: list[DuplicateGroup]
    total_flagged: int                 # total unique transaction IDs flagged
