"""
src/models.py — SQLAlchemy ORM model for the incidents table.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    service_name = Column(String(100), nullable=False)
    alert_id = Column(UUID(as_uuid=True), nullable=True)
    alert_type = Column(String(50), nullable=True)
    severity = Column(String(20), nullable=True)
    cpu_percent = Column(Float, nullable=True)
    ram_percent = Column(Float, nullable=True)
    disk_percent = Column(Float, nullable=True)
    log_excerpt = Column(Text, nullable=True)
    root_cause = Column(Text, nullable=True)
    simple_explanation = Column(Text, nullable=True)
    fix_steps = Column(JSONB, nullable=True)
    resolution = Column(Text, nullable=True)
    status = Column(String(20), default="open")
    confidence = Column(Float, nullable=True)
    ai_response = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_incidents_user", "user_id"),
        Index("idx_incidents_status", "status"),
    )
