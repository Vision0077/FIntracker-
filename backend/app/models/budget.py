import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, func, Numeric, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Budget(Base):
    """
    Per-category monthly budget limit with real-time spending tracker.
    month_year format: 'YYYY-MM' (e.g. '2026-06')
    current_spent is updated by transaction_service on every EXPENSE creation.
    """
    __tablename__ = "budgets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), nullable=False)
    current_spent: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), default=Decimal("0.00"), nullable=False
    )
    # Format: 'YYYY-MM' (e.g., '2026-06')
    month_year: Mapped[str] = mapped_column(String(7), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_budgets_user_month", "user_id", "month_year"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="budgets")

    @property
    def remaining(self) -> Decimal:
        return self.limit_amount - self.current_spent

    @property
    def percentage_used(self) -> float:
        if self.limit_amount <= 0:
            return 0.0
        return float(self.current_spent / self.limit_amount * 100)

    @property
    def is_over_budget(self) -> bool:
        return self.current_spent > self.limit_amount

    def __repr__(self) -> str:
        return f"<Budget id={self.id} cat={self.category} limit={self.limit_amount} spent={self.current_spent}>"
