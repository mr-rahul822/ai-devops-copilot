"""
src/approval_gate.py — Manages the PENDING_APPROVAL → APPROVED / REJECTED flow.

Safety rules:
  - Actions older than 30 minutes cannot be approved (they expire).
  - Only PENDING_APPROVAL actions can be approved or rejected.
"""

import uuid
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Action
from src.audit_logger import AuditLogger

logger = logging.getLogger(__name__)

APPROVAL_TIMEOUT_MINUTES = 30


class ApprovalGate:
    """Controls the approval lifecycle of infrastructure actions."""

    @staticmethod
    async def create_pending_action(
        action_data: dict,
        db: AsyncSession,
        ip_address: str | None = None,
    ) -> Action:
        """
        Insert a new action record with status = PENDING_APPROVAL.

        Args:
            action_data: dict matching the ActionExecuteRequest fields.
            db: async database session.

        Returns:
            The newly created Action DB record.
        """
        action = Action(
            user_id=uuid.UUID(action_data["user_id"]),
            action_type=action_data["action_type"],
            target_service=action_data["target_service"],
            executor_type=action_data["executor_type"],
            params=action_data.get("params", {}),
            status="PENDING_APPROVAL",
            risk_level=action_data["risk_level"],
            requires_approval=action_data.get("requires_approval", True),
            incident_id=uuid.UUID(action_data["incident_id"])
            if action_data.get("incident_id")
            else None,
        )
        db.add(action)
        await db.commit()
        await db.refresh(action)

        # Audit: ACTION_REQUESTED
        await AuditLogger.log_event(
            action_id=action.id,
            user_id=action.user_id,
            event_type="ACTION_REQUESTED",
            detail=(
                f"Action '{action.action_type}' on '{action.target_service}' "
                f"(risk={action.risk_level}, approval={'required' if action.requires_approval else 'not required'})"
            ),
            ip_address=ip_address,
            db=db,
        )

        logger.info(
            "Created action %s — %s on %s [%s]",
            action.id, action.action_type, action.target_service, action.status,
        )
        return action

    @staticmethod
    async def approve_action(
        action_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession,
        ip_address: str | None = None,
    ) -> Action:
        """
        Transition an action from PENDING_APPROVAL → APPROVED.

        Raises:
            ValueError if not found, wrong status, or expired.
        """
        action = await db.get(Action, action_id)
        if action is None:
            raise ValueError(f"Action {action_id} not found")

        if action.status != "PENDING_APPROVAL":
            raise ValueError(
                f"Action {action_id} is '{action.status}', not PENDING_APPROVAL"
            )

        if ApprovalGate.is_expired(action):
            raise ValueError(
                f"Action {action_id} expired (created {action.created_at}). "
                f"Actions must be approved within {APPROVAL_TIMEOUT_MINUTES} minutes."
            )

        action.status = "APPROVED"
        action.approved_by = user_id
        action.approved_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(action)

        await AuditLogger.log_event(
            action_id=action.id,
            user_id=user_id,
            event_type="ACTION_APPROVED",
            detail=f"Action approved by user {user_id}",
            ip_address=ip_address,
            db=db,
        )

        logger.info("Action %s APPROVED by %s", action_id, user_id)
        return action

    @staticmethod
    async def reject_action(
        action_id: uuid.UUID,
        user_id: uuid.UUID,
        reason: str,
        db: AsyncSession,
        ip_address: str | None = None,
    ) -> Action:
        """
        Transition an action from PENDING_APPROVAL → REJECTED.

        Raises:
            ValueError if not found or wrong status.
        """
        action = await db.get(Action, action_id)
        if action is None:
            raise ValueError(f"Action {action_id} not found")

        if action.status != "PENDING_APPROVAL":
            raise ValueError(
                f"Action {action_id} is '{action.status}', not PENDING_APPROVAL"
            )

        action.status = "REJECTED"
        action.error_message = reason
        await db.commit()
        await db.refresh(action)

        await AuditLogger.log_event(
            action_id=action.id,
            user_id=user_id,
            event_type="ACTION_REJECTED",
            detail=f"Rejected: {reason}",
            ip_address=ip_address,
            db=db,
        )

        logger.info("Action %s REJECTED by %s — %s", action_id, user_id, reason)
        return action

    @staticmethod
    def is_expired(action: Action) -> bool:
        """Return True if the action is older than 30 minutes."""
        if action.created_at is None:
            return False
        now = datetime.now(timezone.utc)
        created = action.created_at
        # Make created_at timezone-aware if it isn't
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return (now - created) > timedelta(minutes=APPROVAL_TIMEOUT_MINUTES)
