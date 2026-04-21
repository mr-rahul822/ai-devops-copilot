"""
src/routes/actions.py — All REST endpoints for the Action Service.

Endpoints:
  POST   /actions/execute           — request an infrastructure action
  POST   /actions/{id}/approve      — approve a pending action → execute
  POST   /actions/{id}/reject       — reject a pending action
  GET    /actions                   — list actions with filters
  GET    /actions/health            — health check
  GET    /actions/{id}              — single action + full audit trail
  GET    /actions/{id}/logs         — container log content
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Action, AuditLog
from src.schemas import (
    ActionExecuteRequest,
    ActionRejectRequest,
    ActionExecuteResponse,
    ActionDetailResponse,
    ActionResponse,
    AuditLogResponse,
    HealthResponse,
    ALLOWED_ACTION_TYPES,
    ALLOWED_EXECUTOR_TYPES,
    LOW_RISK_ACTIONS,
)
from src.approval_gate import ApprovalGate
from src.audit_logger import AuditLogger
from src.executors import get_executor
from src.middleware.verify_token import verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/actions", tags=["actions"])


# ── Helper: serialize UUIDs for JSON responses ────────────────────────────────

def _action_to_dict(action: Action) -> dict:
    """Convert an Action ORM object to a JSON-safe dict."""
    return {
        "id": str(action.id),
        "user_id": str(action.user_id),
        "action_type": action.action_type,
        "target_service": action.target_service,
        "executor_type": action.executor_type,
        "params": action.params or {},
        "status": action.status,
        "risk_level": action.risk_level,
        "requires_approval": action.requires_approval,
        "approved_by": str(action.approved_by) if action.approved_by else None,
        "approved_at": action.approved_at,
        "executed_at": action.executed_at,
        "completed_at": action.completed_at,
        "result": action.result,
        "error_message": action.error_message,
        "incident_id": str(action.incident_id) if action.incident_id else None,
        "created_at": action.created_at,
    }


def _audit_to_dict(log: AuditLog) -> dict:
    """Convert an AuditLog ORM object to a JSON-safe dict."""
    return {
        "id": str(log.id),
        "action_id": str(log.action_id),
        "user_id": str(log.user_id),
        "event_type": log.event_type,
        "event_detail": log.event_detail,
        "ip_address": log.ip_address,
        "timestamp": log.timestamp,
    }


# ── Helper: run the actual executor ──────────────────────────────────────────

async def _execute_action(action: Action, db: AsyncSession) -> dict:
    """
    Run the executor for the given action, update status + result in DB,
    and log audit events.

    Returns:
        The executor result dict.
    """
    # Mark EXECUTING
    action.status = "EXECUTING"
    action.executed_at = datetime.now(timezone.utc)
    await db.commit()

    await AuditLogger.log_event(
        action_id=action.id,
        user_id=action.user_id,
        event_type="ACTION_EXECUTING",
        detail=f"Executing {action.action_type} on {action.target_service}",
        db=db,
    )

    try:
        executor = get_executor(action.executor_type)
        result = await executor.execute({
            "action_type": action.action_type,
            "target_service": action.target_service,
            "params": action.params or {},
        })

        if result.get("success"):
            action.status = "COMPLETED"
            action.result = result
            action.completed_at = datetime.now(timezone.utc)
            await db.commit()

            await AuditLogger.log_event(
                action_id=action.id,
                user_id=action.user_id,
                event_type="ACTION_COMPLETED",
                detail=result.get("message", "Action completed"),
                db=db,
            )
        else:
            action.status = "FAILED"
            action.error_message = result.get("message", "Unknown error")
            action.result = result
            await db.commit()

            await AuditLogger.log_event(
                action_id=action.id,
                user_id=action.user_id,
                event_type="ACTION_FAILED",
                detail=result.get("message", "Action failed"),
                db=db,
            )

        return result

    except Exception as e:
        action.status = "FAILED"
        action.error_message = str(e)
        await db.commit()

        await AuditLogger.log_event(
            action_id=action.id,
            user_id=action.user_id,
            event_type="ACTION_FAILED",
            detail=f"Exception: {str(e)}",
            db=db,
        )
        raise


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 7 — GET /actions/health  (must be BEFORE /{action_id} to avoid clash)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check — report Docker/AWS connectivity + pending action count."""
    # Docker status
    try:
        from src.executors.docker_executor import DockerExecutor
        docker_exec = DockerExecutor()
        docker_status = "connected" if docker_exec.is_connected else "disconnected"
    except Exception:
        docker_status = "disconnected"

    # AWS status
    try:
        from src.executors.aws_executor import AWSExecutor
        aws_exec = AWSExecutor()
        aws_status = "configured" if aws_exec.is_configured else "not_configured"
    except Exception:
        aws_status = "not_configured"

    # Pending actions count
    result = await db.execute(
        select(Action).where(Action.status == "PENDING_APPROVAL")
    )
    pending = len(result.scalars().all())

    return {
        "status": "ok",
        "docker": docker_status,
        "aws": aws_status,
        "pending_actions": pending,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 1 — POST /actions/execute
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/execute")
async def execute_action(
    body: ActionExecuteRequest,
    request: Request,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Request an infrastructure action.

    If requires_approval is True  → creates PENDING_APPROVAL, returns action_id.
    If requires_approval is False → executes immediately (LOW risk actions only).
    """
    # Validate action_type
    if body.action_type not in ALLOWED_ACTION_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action_type '{body.action_type}'. "
                   f"Allowed: {ALLOWED_ACTION_TYPES}",
        )

    # Validate executor_type
    if body.executor_type not in ALLOWED_EXECUTOR_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid executor_type '{body.executor_type}'. "
                   f"Allowed: {ALLOWED_EXECUTOR_TYPES}",
        )

    # Safety: force approval for non-LOW risk actions
    if body.action_type not in LOW_RISK_ACTIONS and body.risk_level != "LOW":
        body.requires_approval = True

    ip_address = request.client.host if request.client else None

    # Create the action record
    action = await ApprovalGate.create_pending_action(
        action_data=body.model_dump(),
        db=db,
        ip_address=ip_address,
    )

    # If no approval needed (LOW risk / read-only) → execute immediately
    if not body.requires_approval:
        # Auto-approve
        action.status = "APPROVED"
        action.approved_by = action.user_id
        action.approved_at = datetime.now(timezone.utc)
        await db.commit()

        await AuditLogger.log_event(
            action_id=action.id,
            user_id=action.user_id,
            event_type="ACTION_APPROVED",
            detail="Auto-approved (low risk, no approval required)",
            ip_address=ip_address,
            db=db,
        )

        try:
            result = await _execute_action(action, db)
            return {
                "action_id": str(action.id),
                "status": action.status,
                "message": result.get("message", "Action executed"),
                "result": result,
                "executed_at": action.executed_at,
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Approval required → return pending
    return {
        "action_id": str(action.id),
        "status": "PENDING_APPROVAL",
        "message": (
            f"Action created. Approve at POST /actions/{action.id}/approve "
            f"or reject at POST /actions/{action.id}/reject"
        ),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 2 — POST /actions/{action_id}/approve
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{action_id}/approve")
async def approve_action(
    action_id: str,
    request: Request,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    """Approve a pending action and execute it immediately."""
    try:
        aid = uuid.UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid action_id format")

    # Resolve user_id from the authenticated user
    user_id_str = user.get("id") or user.get("userId") or user.get("user_id", "")
    try:
        user_id = uuid.UUID(str(user_id_str))
    except ValueError:
        raise HTTPException(status_code=400, detail="Cannot resolve user ID from token")

    ip_address = request.client.host if request.client else None

    # Approve
    try:
        action = await ApprovalGate.approve_action(
            action_id=aid,
            user_id=user_id,
            db=db,
            ip_address=ip_address,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Execute immediately
    try:
        result = await _execute_action(action, db)
        return {
            "action_id": str(action.id),
            "status": action.status,
            "result": result,
            "executed_at": action.executed_at,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Execution failed: {str(e)}",
        )


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 3 — POST /actions/{action_id}/reject
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/{action_id}/reject")
async def reject_action(
    action_id: str,
    body: ActionRejectRequest = ActionRejectRequest(),
    request: Request = None,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    """Reject a pending action."""
    try:
        aid = uuid.UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid action_id format")

    user_id_str = user.get("id") or user.get("userId") or user.get("user_id", "")
    try:
        user_id = uuid.UUID(str(user_id_str))
    except ValueError:
        raise HTTPException(status_code=400, detail="Cannot resolve user ID from token")

    ip_address = request.client.host if request.client else None

    try:
        action = await ApprovalGate.reject_action(
            action_id=aid,
            user_id=user_id,
            reason=body.reason or "Rejected by user",
            db=db,
            ip_address=ip_address,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "action_id": str(action.id),
        "status": "REJECTED",
        "message": f"Action rejected: {body.reason}",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 4 — GET /actions
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("")
async def list_actions(
    user_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    target_service: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    """List actions with optional filters, newest first."""
    query = select(Action).order_by(desc(Action.created_at)).limit(limit)

    if user_id:
        query = query.where(Action.user_id == uuid.UUID(user_id))
    if status:
        query = query.where(Action.status == status)
    if target_service:
        query = query.where(Action.target_service == target_service)

    result = await db.execute(query)
    actions = result.scalars().all()

    return {
        "count": len(actions),
        "actions": [_action_to_dict(a) for a in actions],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 5 — GET /actions/{action_id}
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{action_id}")
async def get_action(
    action_id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    """Get single action with full audit trail."""
    try:
        aid = uuid.UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid action_id format")

    action = await db.get(Action, aid)
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")

    audit_trail = await AuditLogger.get_action_history(aid, db)

    return {
        "action": _action_to_dict(action),
        "audit_trail": [_audit_to_dict(log) for log in audit_trail],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINT 6 — GET /actions/{action_id}/logs
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/{action_id}/logs")
async def get_action_logs(
    action_id: str,
    user: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve container log content from a fetch_container_logs action result.
    Only valid when the action was fetch_container_logs.
    """
    try:
        aid = uuid.UUID(action_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid action_id format")

    action = await db.get(Action, aid)
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")

    if action.action_type != "fetch_container_logs":
        raise HTTPException(
            status_code=400,
            detail=f"Action {action_id} is '{action.action_type}', not 'fetch_container_logs'",
        )

    if action.status != "COMPLETED" or not action.result:
        raise HTTPException(
            status_code=400,
            detail=f"Action has no result yet (status: {action.status})",
        )

    details = action.result.get("details", {})
    return {
        "action_id": str(action.id),
        "target_service": action.target_service,
        "logs": details.get("logs", ""),
        "line_count": details.get("line_count", 0),
    }
