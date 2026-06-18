import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select, distinct, func
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
    Verifies the JWT token locally using the configured secret key.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")

    token = authorization.split(" ", 1)[1]
    import jwt
    try:
        decoded = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user_id = decoded.get("userId")
    email = decoded.get("email")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    return {
        "user": {
            "id": user_id,
            "email": email
        }
    }


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

@router.get("/latest", response_model=list[MetricResponse])
async def get_latest(
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """Returns the single most recent metric for all services."""
    user_id = _auth.get("user", {}).get("id", settings.default_user_id)
    
    result = await db.execute(
        select(Metric)
        .distinct(Metric.service_name)
        .order_by(Metric.service_name, Metric.timestamp.desc())
    )
    rows = result.scalars().all()
    return rows


# ---------------------------------------------------------------------------
# GET /metrics/history
# ---------------------------------------------------------------------------

@router.get("/history", response_model=list[MetricResponse])
async def get_history(
    user_id: Optional[str] = Query(default=None, description="UUID of the user"),
    service_name: Optional[str] = Query(default=None, description="Name of the monitored service"),
    hours: int = Query(default=1, ge=1, le=24, description="How many hours of history (1–24)"),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """Returns all metric readings for the last N hours (default 1, max 24)."""
    since = datetime.utcnow() - timedelta(hours=hours)

    query = select(Metric).where(Metric.timestamp >= since)
    if service_name:
        query = query.where(Metric.service_name == service_name)
    
    query = query.order_by(Metric.timestamp.asc())
    
    result = await db.execute(query)
    rows = result.scalars().all()
    if not rows and service_name:
        raise HTTPException(
            status_code=404,
            detail=f"No metrics found for service '{service_name}' in the last {hours}h.",
        )
    return rows


# ---------------------------------------------------------------------------
# GET /metrics  (alias for /metrics/history — used by React dashboard)
# ---------------------------------------------------------------------------

@router.get("", response_model=list[MetricResponse])
async def get_metrics_root(
    user_id: Optional[str] = Query(default=None, description="UUID of the user"),
    service_name: Optional[str] = Query(default=None, description="Name of the monitored service"),
    hours: int = Query(default=1, ge=1, le=24, description="How many hours of history (1–24)"),
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """Alias for /metrics/history — the React frontend calls GET /metrics."""
    return await get_history(
        user_id=user_id, service_name=service_name, hours=hours, db=db, _auth=_auth
    )


# ---------------------------------------------------------------------------
# GET /metrics/summary  (stat cards for the React dashboard)
# ---------------------------------------------------------------------------

@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """
    Returns aggregated metrics for the dashboard stat cards.

    Response shape:
    {
        "active_services": int,
        "avg_cpu": float,
        "avg_ram": float,
        "peak_cpu": float,
        "total_readings": int,
        "status": "healthy" | "warning" | "critical"
    }

    Calculated from the last 5 minutes of metric data.
    """
    since = datetime.utcnow() - timedelta(minutes=5)

    result = await db.execute(
        select(
            func.count(distinct(Metric.service_name)).label("active_services"),
            func.avg(Metric.cpu_percent).label("avg_cpu"),
            func.avg(Metric.ram_percent).label("avg_ram"),
            func.max(Metric.cpu_percent).label("peak_cpu"),
            func.count(Metric.id).label("total_readings"),
        ).where(Metric.timestamp >= since)
    )
    row = result.one()

    avg_cpu = round(float(row.avg_cpu or 0), 1)
    avg_ram = round(float(row.avg_ram or 0), 1)
    peak_cpu = round(float(row.peak_cpu or 0), 1)

    # Determine overall status
    if avg_cpu > 90 or avg_ram > 90:
        status = "critical"
    elif avg_cpu > 70 or avg_ram > 70:
        status = "warning"
    else:
        status = "healthy"

    return {
        "active_services": int(row.active_services or 0),
        "avg_cpu": avg_cpu,
        "avg_ram": avg_ram,
        "peak_cpu": peak_cpu,
        "total_readings": int(row.total_readings or 0),
        "status": status,
    }


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

@router.post("/collect", response_model=list[MetricResponse])
async def collect_now(_auth: dict = Depends(require_auth)):
    """
    Manually triggers one collection cycle immediately.
    Useful for testing without waiting for the 60-second interval.
    """
    try:
        rows = await run_once()
        return rows
    except Exception as exc:
        logger.error("Manual collection failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
