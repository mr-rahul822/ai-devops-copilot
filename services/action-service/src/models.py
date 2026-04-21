"""
src/models.py — SQLAlchemy ORM models for the Action Service.

Tables:
  - actions:    stores every action request with its lifecycle status
  - audit_logs: immutable log of every event for every action
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, Text, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP

from src.database import Base


class Action(Base):
    """Represents a single infrastructure action through its full lifecycle."""

    __tablename__ = "actions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_service: Mapped[str] = mapped_column(String(100), nullable=False)
    executor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    params: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="PENDING_APPROVAL")
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=True)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    executed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    incident_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationship to audit trail
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="action", lazy="selectin", order_by="AuditLog.timestamp"
    )

    __table_args__ = (
        Index("idx_actions_user", "user_id"),
        Index("idx_actions_status", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<Action {self.action_type} target={self.target_service} "
            f"status={self.status}>"
        )


class AuditLog(Base):
    """Immutable audit event tied to a specific action."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    action_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("actions.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    event_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Back-reference to action
    action: Mapped["Action"] = relationship(back_populates="audit_logs")

    __table_args__ = (
        Index("idx_audit_action", "action_id"),
        Index("idx_audit_user", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.event_type} action={self.action_id}>"
