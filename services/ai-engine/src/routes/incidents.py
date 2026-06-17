"""
src/routes/incidents.py — CRUD endpoints for incident management.

GET  /ai/incidents          — list incidents (filtered by user_id, status)
GET  /ai/incidents/:id      — single incident detail
POST /ai/incidents/:id/resolve — resolve + embed into Pinecone for RAG
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Incident
from src.schemas import IncidentOut, ResolveRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["incidents"])


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")
    return authorization.split(" ", 1)[1]


# ── Serialiser helper ────────────────────────────────────────────────────

def _to_out(row: Incident) -> IncidentOut:
    return IncidentOut(
        id=str(row.id),
        user_id=str(row.user_id),
        service_name=row.service_name,
        alert_id=str(row.alert_id) if row.alert_id else None,
        alert_type=row.alert_type,
        severity=row.severity,
        cpu_percent=row.cpu_percent,
        ram_percent=row.ram_percent,
        disk_percent=row.disk_percent,
        log_excerpt=row.log_excerpt,
        root_cause=row.root_cause,
        simple_explanation=row.simple_explanation,
        fix_steps=row.fix_steps,
        resolution=row.resolution,
        status=row.status,
        confidence=row.confidence,
        ai_response=row.ai_response,
        created_at=row.created_at,
        resolved_at=row.resolved_at,
    )


# ── GET /ai/incidents ────────────────────────────────────────────────────

@router.get("/incidents", response_model=list[IncidentOut])
async def list_incidents(
    user_id: str = Query(default="00000000-0000-0000-0000-000000000001"),
    status: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _extract_token(authorization)  # verify JWT present

    stmt = select(Incident).where(Incident.user_id == uuid.UUID(user_id))
    if status:
        stmt = stmt.where(Incident.status == status)
    stmt = stmt.order_by(Incident.created_at.desc())

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [_to_out(r) for r in rows]


# ── GET /ai/incidents/:id ────────────────────────────────────────────────

@router.get("/incidents/{incident_id}", response_model=IncidentOut)
async def get_incident(
    incident_id: str,
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    _extract_token(authorization)

    result = await db.execute(
        select(Incident).where(Incident.id == uuid.UUID(incident_id))
    )
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")
    return _to_out(row)


# ── POST /ai/incidents/:id/resolve ───────────────────────────────────────

@router.post("/incidents/{incident_id}/resolve", response_model=IncidentOut)
async def resolve_incident(
    incident_id: str,
    body: ResolveRequest,
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Marks an incident as resolved and embeds it into Pinecone.
    THIS IS HOW THE AI LEARNS — every resolved incident becomes
    a vector in Pinecone for future RAG lookups.
    """
    _extract_token(authorization)

    result = await db.execute(
        select(Incident).where(Incident.id == uuid.UUID(incident_id))
    )
    row = result.scalars().first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")

    # Update DB record
    row.status = "resolved"
    row.resolution = body.resolution
    row.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)

    # Embed into Pinecone for RAG
    from src.main import vector_store

    embed_text = (
        f"{row.alert_type} on {row.service_name}. "
        f"CPU: {row.cpu_percent}% RAM: {row.ram_percent}%. "
        f"Root cause: {row.root_cause}. "
        f"Resolution: {body.resolution}"
    )

    metadata = {
        "user_id": str(row.user_id),
        "service_name": row.service_name,
        "alert_type": row.alert_type or "",
        "resolution": body.resolution,
        "severity": row.severity or "",
        "resolved_at": row.resolved_at.isoformat() if row.resolved_at else "",
        "source": "user_resolved",
    }

    await vector_store.upsert_incident(str(row.id), embed_text, metadata)
    logger.info("Resolved incident %s embedded into Pinecone for RAG.", row.id)

    return _to_out(row)
