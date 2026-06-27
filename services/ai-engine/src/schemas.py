"""
src/schemas.py — Pydantic request/response schemas for the AI Engine API.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Diagnose ─────────────────────────────────────────────────────────────────

class DiagnoseRequest(BaseModel):
    user_id: Optional[str] = ""
    service_name: str
    alert_id: Optional[str] = None
    alert_type: Optional[str] = "UNKNOWN"
    log_excerpt: Optional[str] = None


class DiagnoseResponse(BaseModel):
    incident_id: str
    root_cause: str
    simple_explanation: str
    fix_steps: list[str]
    severity: str
    time_to_fix: str
    confidence: float
    similar_past_incident: Optional[str] = None


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    user_id: Optional[str] = ""
    message: str
    service_name: Optional[str] = None
    conversation_history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    context_used: list[str] = Field(default_factory=list)


# ── Incidents ────────────────────────────────────────────────────────────────

class IncidentOut(BaseModel):
    id: str
    user_id: str
    service_name: str
    alert_id: Optional[str] = None
    alert_type: Optional[str] = None
    severity: Optional[str] = None
    cpu_percent: Optional[float] = None
    ram_percent: Optional[float] = None
    disk_percent: Optional[float] = None
    log_excerpt: Optional[str] = None
    root_cause: Optional[str] = None
    simple_explanation: Optional[str] = None
    fix_steps: Optional[list] = None
    resolution: Optional[str] = None
    status: str = "open"
    confidence: Optional[float] = None
    ai_response: Optional[dict] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ResolveRequest(BaseModel):
    resolution: str


# ── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    pinecone: str
    llm: str
