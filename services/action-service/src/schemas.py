"""
src/schemas.py — Pydantic request / response models for the Action Service.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


# ── Allowed values ────────────────────────────────────────────────────────────

ALLOWED_ACTION_TYPES = [
    "restart_container",
    "stop_container",
    "fetch_container_logs",
    "get_container_stats",
    "rollback_deployment",
    "scale_service",
    "get_instance_status",
]

ALLOWED_EXECUTOR_TYPES = ["docker", "aws"]
ALLOWED_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# Actions that are read-only and can skip approval
LOW_RISK_ACTIONS = ["fetch_container_logs", "get_container_stats", "get_instance_status"]


# ── Request schemas ───────────────────────────────────────────────────────────

class ActionExecuteRequest(BaseModel):
    """POST /actions/execute — request body."""
    user_id: str
    action_type: str
    target_service: str
    executor_type: str = "docker"
    risk_level: str = "MEDIUM"
    requires_approval: bool = True
    params: dict = Field(default_factory=dict)
    incident_id: Optional[str] = None


class ActionRejectRequest(BaseModel):
    """POST /actions/{id}/reject — optional reason."""
    reason: Optional[str] = "Rejected by user"


# ── Response schemas ──────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: str
    action_id: str
    user_id: str
    event_type: str
    event_detail: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class ActionResponse(BaseModel):
    id: str
    user_id: str
    action_type: str
    target_service: str
    executor_type: str
    params: dict
    status: str
    risk_level: str
    requires_approval: bool
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[dict] = None
    error_message: Optional[str] = None
    incident_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActionDetailResponse(BaseModel):
    """GET /actions/{id} — full action + audit trail."""
    action: ActionResponse
    audit_trail: list[AuditLogResponse] = []


class ActionExecuteResponse(BaseModel):
    """POST /actions/execute — response."""
    action_id: str
    status: str
    message: str
    result: Optional[dict] = None
    executed_at: Optional[datetime] = None


class HealthResponse(BaseModel):
    status: str
    docker: str
    aws: str
    pending_actions: int
