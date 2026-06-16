import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.account import Account


class BankItem(Base):
    """
    Stores a secure connection to a bank/UPI provider (e.g. Plaid, Setu, NPCI).
    IMPORTANT: access_token MUST be encrypted at rest using AES-256 in production.
    """
    __tablename__ = "bank_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # SECURITY: Encrypt with AES-256 before storing. Never store plaintext tokens.
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    item_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    institution_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Status: ACTIVE | DISCONNECTED | ERROR | PENDING_REAUTH
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="bank_items")
    accounts: Mapped[list["Account"]] = relationship(
        "Account", back_populates="bank_item", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<BankItem id={self.id} institution={self.institution_name}>"
