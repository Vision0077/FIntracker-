import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, func, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.bank_item import BankItem
    from app.models.transaction import Transaction


class Account(Base):
    """
    Represents a financial account — bank account, credit card, UPI wallet, or manual.
    bank_item_id is nullable: NULL means it's a manually created account (cash, etc.)
    """
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    bank_item_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("bank_items.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_provider_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Account type: depository | credit | wallet | upi | manual
    type: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)
    # Payment method: UPI | CARD | WALLET | SUBSCRIPTION | CASH
    payment_method: Mapped[str] = mapped_column(String(50), default="UPI", nullable=False)
    balance: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), default=Decimal("0.00"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="accounts")
    bank_item: Mapped["BankItem | None"] = relationship("BankItem", back_populates="accounts")
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", back_populates="account", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Account id={self.id} name={self.name} type={self.type}>"
