"""
src/routes/diagnose.py — POST /ai/diagnose endpoint.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.schemas import DiagnoseRequest, DiagnoseResponse
from src.middleware.verify_token import verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["diagnose"])


@router.post("/diagnose", response_model=DiagnoseResponse)
async def diagnose(
    body: DiagnoseRequest,
    authorization: Optional[str] = Header(default=None),
    auth_user_id: str = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    """
    Runs the full diagnosis pipeline:
    metrics → alerts → RAG → Claude → save → respond.
    """
    # Enforce tenant isolation — overwrite user_id in the body with the authenticated user ID
    body.user_id = auth_user_id
    token = authorization.split(" ", 1)[1]

    # Import here to access the singleton created in main.py
    from src.main import diagnosis_service

    try:
        return await diagnosis_service.diagnose(body, db, token)
    except Exception as exc:
        logger.error("Diagnosis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Diagnosis failed: {exc}")
