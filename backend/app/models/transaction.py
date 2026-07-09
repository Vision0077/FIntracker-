import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    String, DateTime, Date, ForeignKey, func,
    Numeric, Boolean, UniqueConstraint, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.account import Account


class Transaction(Base):
    """
    Core financial transaction record.
    Handles both manually entered and auto-synced bank transactions.

    Key design decisions:
    - Soft delete: deleted_at IS NULL = active; timestamp = deleted
    - Idempotency: UNIQUE(account_id, provider_transaction_id) prevents duplicate syncs
    - ai_suggested_category: ML categorization engine hook (see transaction_service.py)
    - amount is always POSITIVE; 'type' (INCOME/EXPENSE) gives direction
    """
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Bank/UPI provider transaction ID for deduplication (NULL for manual entries)
    provider_transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Amount is ALWAYS positive; direction determined by 'type'
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), nullable=False)
    # INCOME or EXPENSE
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    # Top level: UPI | CARD | WALLET | SUBSCRIPTION | CASH
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False, default="UPI")

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    raw_merchant_name: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Primary: FOOD | TRAVEL | MISCELLANEOUS | SUBSCRIPTION | SALARY | RENT | BILLS | SERVICE | PAYROLL
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="MISCELLANEOUS", index=True)
    # Sub-category (user-defined): RESTAURANTS | DELIVERY | FUEL | etc.
    subcategory: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # AI Categorization Engine Hook — populated by ai_suggest_category() in transaction_service.py
    # Future: replace heuristic with actual ML model output
    ai_suggested_category: Mapped[str | None] = mapped_column(String(100), nullable=True)

    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # True if still pending settlement at the bank
    is_pending: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Soft delete: NULL = active, timestamp = soft-deleted
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # Idempotency guarantee: prevents duplicate bank sync entries
        UniqueConstraint("account_id", "provider_transaction_id", name="uq_transaction_account_provider"),
        Index("ix_transactions_category", "category"),
        Index("ix_transactions_payment_method", "payment_method"),
        # Note: PostgreSQL partial index (WHERE deleted_at IS NULL) defined in schema.sql
        # SQLite uses a standard compound index as fallback
        Index("ix_transactions_user_date", "user_id", "transaction_date"),
        # Covers the ubiquitous (user_id, deleted_at IS NULL, transaction_date) filter
        Index("ix_transactions_user_active_date", "user_id", "deleted_at", "transaction_date"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="transactions")
    account: Mapped["Account | None"] = relationship("Account", back_populates="transactions")

    def __repr__(self) -> str:
        return f"<Transaction id={self.id} amount={self.amount} type={self.type} cat={self.category}>"
