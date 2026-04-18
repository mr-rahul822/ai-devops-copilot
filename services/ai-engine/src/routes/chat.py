"""
src/routes/chat.py — POST /ai/chat endpoint.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from src.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["chat"])


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")
    return authorization.split(" ", 1)[1]


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    authorization: Optional[str] = Header(default=None),
):
    """
    Conversational endpoint — fetches context and calls Claude.
    """
    token = _extract_token(authorization)

    from src.main import chat_service

    try:
        return await chat_service.chat(body, token)
    except Exception as exc:
        logger.error("Chat failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}")
