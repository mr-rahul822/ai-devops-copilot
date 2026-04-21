"""
src/audit_logger.py — Immutable audit trail for every action.

Every single action event goes through this logger. No exceptions.

Event types:
  ACTION_REQUESTED  — POST /actions/execute called
  ACTION_APPROVED   — user confirmed via /approve
  ACTION_REJECTED   — user cancelled via /reject
  ACTION_EXECUTING  — just before executor runs
  ACTION_COMPLETED  — executor succeeded
  ACTION_FAILED     — executor raised exception
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import AuditLog

logger = logging.getLogger(__name__)


class AuditLogger:
    """Writes and reads audit events for actions."""

    @staticmethod
    async def log_event(
        action_id: uuid.UUID,
        user_id: uuid.UUID,
        event_type: str,
        detail: str | None = None,
        ip_address: str | None = None,
        db: AsyncSession | None = None,
    ) -> AuditLog | None:
        """
        Insert an audit event into the audit_logs table.

        Also prints a structured console log line so operators can follow
        the trail in Docker logs.
        """
        # Console log — always visible
        logger.info(
            "[AUDIT] %s | action=%s | user=%s | %s",
            event_type, action_id, user_id, detail or "",
        )

        if db is None:
            return None

        entry = AuditLog(
            action_id=action_id,
            user_id=user_id,
            event_type=event_type,
            event_detail=detail,
            ip_address=ip_address,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)
        return entry

    @staticmethod
    async def get_action_history(
        action_id: uuid.UUID,
        db: AsyncSession,
    ) -> list[AuditLog]:
        """Return all audit events for the given action, in chronological order."""
        result = await db.execute(
            select(AuditLog)
            .where(AuditLog.action_id == action_id)
            .order_by(AuditLog.timestamp.asc())
        )
        return list(result.scalars().all())
