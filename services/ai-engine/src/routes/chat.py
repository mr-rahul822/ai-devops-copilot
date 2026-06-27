"""
src/routes/chat.py — POST /ai/chat endpoint.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from src.schemas import ChatRequest, ChatResponse
from src.middleware.verify_token import verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    authorization: Optional[str] = Header(default=None),
    auth_user_id: str = Depends(verify_token),
):
    """
    Conversational endpoint — fetches context and calls Claude.
    """
    # Enforce tenant isolation — overwrite user_id in the body with the authenticated user ID
    body.user_id = auth_user_id
    token = authorization.split(" ", 1)[1]

    from src.main import chat_service

    try:
        return await chat_service.chat(body, token)
    except Exception as exc:
        logger.error("Chat failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}")
