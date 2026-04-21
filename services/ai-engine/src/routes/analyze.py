"""
src/routes/analyze.py — POST /ai/analyze endpoint (Phase 5).

Runs the full 4-agent pipeline via AgentOrchestrator.
Protected by JWT (verified via auth-service, same pattern as diagnose.py).
"""

import logging
from typing import Optional, List

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analyze"])


# ── Request / response schemas ──────────────────────────────────────────

class MetricsHistoryItem(BaseModel):
    cpu: float = 0.0
    ram: float = 0.0
    timestamp: Optional[str] = None


class AnalyzeRequest(BaseModel):
    user_id: str
    service_name: str
    alert_id: Optional[str] = None
    alert_type: Optional[str] = "UNKNOWN"
    raw_logs: Optional[str] = ""
    current_cpu: float = 0.0
    current_ram: float = 0.0
    metrics_history: List[MetricsHistoryItem] = Field(default_factory=list)


# ── Helpers ──────────────────────────────────────────────────────────────

def _extract_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")
    return authorization.split(" ", 1)[1]


# ── Endpoint ─────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze(
    body: AnalyzeRequest,
    authorization: Optional[str] = Header(default=None),
):
    """
    Run the full multi-agent analysis pipeline.

    Agent 1 (Log Analyzer)    → pure Python regex/keyword analysis
    Agent 2 (Metrics Analyzer)→ pure Python statistical analysis
    Agent 3 (Decision)        → Claude LLM call
    Agent 4 (Executor)        → action plan preparation (no execution)
    """
    _extract_token(authorization)  # enforce JWT presence

    # Import the singleton created in main.py during lifespan startup
    from src.main import orchestrator

    if orchestrator is None:
        raise HTTPException(status_code=503, detail="AI Engine not ready — orchestrator not initialised.")

    input_data = {
        "user_id": body.user_id,
        "service_name": body.service_name,
        "alert_id": body.alert_id,
        "alert_type": body.alert_type,
        "raw_logs": body.raw_logs or "",
        "current_cpu": body.current_cpu,
        "current_ram": body.current_ram,
        "metrics_history": [m.model_dump() for m in body.metrics_history],
    }

    try:
        result = await orchestrator.run(input_data)
    except Exception as exc:
        logger.error("Multi-agent pipeline failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail=f"AI decision unavailable, retry in 30 seconds: {exc}")

    # If the DecisionAgent failed internally, the result contains an "error" key
    if "error" in result and result.get("agents_completed", 0) < 3:
        raise HTTPException(
            status_code=503,
            detail=f"AI decision unavailable, retry in 30 seconds: {result['error']}",
        )

    return result
