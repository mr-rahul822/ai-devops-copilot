import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db
from src.models import Metric
from src.schemas import MetricResponse, HealthResponse, ServicesResponse
from src.scheduler import scheduler, run_once

router = APIRouter(prefix="/metrics", tags=["metrics"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helper — JWT verification via auth-service
# ---------------------------------------------------------------------------

async def _verify_token(authorization: str) -> dict:
    """
    Calls auth-service GET /auth/me to validate the Bearer token.
    Returns the user payload or raises HTTPException.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.auth_service_url}/auth/me",
                headers={"Authorization": authorization},
            )
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Auth service is unreachable.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Auth service timed out.")

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Auth service returned an unexpected error.")

    return response.json()


# ---------------------------------------------------------------------------
# Dependency: resolves + validates JWT from Authorization header
# ---------------------------------------------------------------------------

async def require_auth(authorization: Optional[str] = Header(default=None)) -> dict:
    return await _verify_token(authorization)


# ---------------------------------------------------------------------------
# GET /metrics/health
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse)
async def health():
    """Returns service health and scheduler status."""
    scheduler_status = "running" if scheduler.running else "stopped"
    return HealthResponse(status="ok", scheduler=scheduler_status)


# ---------------------------------------------------------------------------
# GET /metrics/latest
# ---------------------------------------------------------------------------

@router.get("/latest", response_model=MetricResponse)
async def get_latest(
    user_id: str = Query(..., description="UUID of the user"),
    service_name: str = Query(..., description="Name of the monitored service"),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """Returns the single most recent metric for the given user + service."""
    result = await db.execute(
        select(Metric)
        .where(Metric.user_id == user_id, Metric.service_name == service_name)
        .order_by(Metric.timestamp.desc())
        .limit(1)
    )
    row = result.scalars().first()
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No metrics found for service '{service_name}'.",
        )
    return row


# ---------------------------------------------------------------------------
# GET /metrics/history
# ---------------------------------------------------------------------------

@router.get("/history", response_model=list[MetricResponse])
async def get_history(
    user_id: str = Query(..., description="UUID of the user"),
    service_name: str = Query(..., description="Name of the monitored service"),
    hours: int = Query(default=1, ge=1, le=24, description="How many hours of history (1–24)"),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """Returns all metric readings for the last N hours (default 1, max 24)."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    result = await db.execute(
        select(Metric)
        .where(
            Metric.user_id == user_id,
            Metric.service_name == service_name,
            Metric.timestamp >= since,
        )
        .order_by(Metric.timestamp.asc())
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No metrics found for service '{service_name}' in the last {hours}h.",
        )
    return rows


# ---------------------------------------------------------------------------
# GET /metrics/services
# ---------------------------------------------------------------------------

@router.get("/services", response_model=ServicesResponse)
async def get_services(
    user_id: str = Query(..., description="UUID of the user"),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """Returns a distinct list of service names being monitored for a user."""
    result = await db.execute(
        select(distinct(Metric.service_name)).where(Metric.user_id == user_id)
    )
    services = [row for row in result.scalars().all()]
    return ServicesResponse(services=services)


# ---------------------------------------------------------------------------
# POST /metrics/collect  (manual trigger)
# ---------------------------------------------------------------------------

@router.post("/collect", response_model=MetricResponse)
async def collect_now(_auth: dict = Depends(require_auth)):
    """
    Manually triggers one collection cycle immediately.
    Useful for testing without waiting for the 60-second interval.
    """
    try:
        row = await run_once()
        return row
    except Exception as exc:
        logger.error("Manual collection failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
