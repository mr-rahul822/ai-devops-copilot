"""
src/routes/diagnose.py — POST /ai/diagnose endpoint.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas import DiagnoseRequest, DiagnoseResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["diagnose"])


def _extract_token(authorization: Optional[str]) -> str:
    """Pull the raw JWT out of the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")
    return authorization.split(" ", 1)[1]


@router.post("/diagnose", response_model=DiagnoseResponse)
async def diagnose(
    body: DiagnoseRequest,
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Runs the full diagnosis pipeline:
    metrics → alerts → RAG → Claude → save → respond.
    """
    token = _extract_token(authorization)

    # Import here to access the singleton created in main.py
    from src.main import diagnosis_service

    try:
        return await diagnosis_service.diagnose(body, db, token)
    except Exception as exc:
        logger.error("Diagnosis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Diagnosis failed: {exc}")
