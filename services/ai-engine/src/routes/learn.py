"""
src/routes/learn.py — POST /ai/learn endpoint.

Called by action-service after an action completes.
Embeds the outcome into Pinecone so future diagnoses
reference real resolved incidents from this platform.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["learn"])


class LearnRequest(BaseModel):
    incident_id: Optional[str] = None
    service_name: str
    alert_type: str
    root_cause: Optional[str] = None
    action_taken: str           # e.g. "restart_container", "scale_up"
    action_target: Optional[str] = None  # e.g. container name, instance id
    success: bool               # did the action fix the issue?
    outcome_message: Optional[str] = None  # result from executor
    user_id: str = "00000000-0000-0000-0000-000000000001"


@router.post("/learn")
async def learn_from_action(
    body: LearnRequest,
    x_internal_secret: Optional[str] = Header(default=None),
):
    """
    Called by action-service after action completes.
    Embeds the resolution into Pinecone for RAG learning.
    """
    # Verify internal secret (service-to-service call)
    from src.config import settings
    if x_internal_secret != settings.internal_secret:
        raise HTTPException(status_code=403, detail="Forbidden — invalid internal secret.")

    from src.main import vector_store
    if vector_store is None:
        raise HTTPException(status_code=503, detail="Vector store not initialized.")

    # Build a rich text description for embedding
    status_word = "successfully resolved" if body.success else "attempted but failed to resolve"
    resolution_text = (
        f"Incident on {body.service_name}: {body.alert_type}. "
        f"Root cause: {body.root_cause or 'unknown'}. "
        f"Action '{body.action_taken}' on '{body.action_target or body.service_name}' "
        f"{status_word}. "
        f"Outcome: {body.outcome_message or 'no details'}."
    )

    # Generate unique ID for this learned incident
    learn_id = f"learned-{body.service_name}-{body.alert_type}-{uuid.uuid4().hex[:8]}"

    try:
        await vector_store.upsert_incident(
            incident_id=learn_id,
            text=resolution_text,
            metadata={
                "user_id": body.user_id,
                "service_name": body.service_name,
                "alert_type": body.alert_type,
                "severity": "HIGH" if not body.success else "RESOLVED",
                "resolution": resolution_text,
                "action_taken": body.action_taken,
                "success": str(body.success),
                "resolved_at": datetime.utcnow().isoformat(),
                "source": "learned"  # distinguish from seeded incidents
            }
        )
        logger.info(
            "Learned from action: %s on %s → success=%s → embedded as %s",
            body.action_taken, body.service_name, body.success, learn_id
        )
        return {
            "status": "learned",
            "incident_id": learn_id,
            "embedded": True,
            "message": "Action outcome embedded into RAG index — future diagnoses will reference this."
        }
    except Exception as exc:
        logger.error("Failed to embed learning: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to embed learning: {exc}")
