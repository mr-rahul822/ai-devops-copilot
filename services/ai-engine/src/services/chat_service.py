"""
src/services/chat_service.py — Orchestrator for the /ai/chat endpoint.

Fetches relevant context (metrics + alerts + similar incidents) and
calls Claude with the full conversation history.
"""

import logging

import httpx

from src.config import settings
from src.llm.client import ClaudeClient
from src.llm.prompts import CHAT_PROMPT
from src.rag.retriever import Retriever
from src.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)


class ChatService:
    """Handles conversational AI interactions about infrastructure."""

    def __init__(
        self,
        claude: ClaudeClient,
        retriever: Retriever,
        http_client: httpx.AsyncClient,
    ):
        self._claude = claude
        self._retriever = retriever
        self._http = http_client

    async def chat(self, req: ChatRequest, auth_token: str) -> ChatResponse:
        user_id = req.user_id
        headers = {"Authorization": f"Bearer {auth_token}"}
        context_used: list[str] = []

        # ── Gather context ────────────────────────────────────────────────
        # Metrics context
        metrics_ctx = ""
        if req.service_name:
            try:
                resp = await self._http.get(
                    f"{settings.metrics_service_url}/metrics/latest",
                    params={"user_id": user_id, "service_name": req.service_name},
                    headers=headers,
                )
                if resp.status_code == 200:
                    m = resp.json()
                    metrics_ctx = (
                        f"Current metrics for {req.service_name}: "
                        f"CPU {m.get('cpu_percent', 'N/A')}%, "
                        f"RAM {m.get('ram_percent', 'N/A')}%, "
                        f"Disk {m.get('disk_percent', 'N/A')}%"
                    )
                    context_used.append("metrics")
            except Exception as exc:
                logger.warning("Failed to fetch metrics for chat: %s", exc)

        # Alerts context
        alerts_ctx = ""
        try:
            resp = await self._http.get(
                f"{settings.alert_service_url}/alerts",
                params={"user_id": user_id, "status": "open"},
                headers=headers,
            )
            if resp.status_code == 200:
                alerts = resp.json().get("alerts", [])
                if alerts:
                    lines = [f"- [{a.get('severity')}] {a.get('alert_type')} on {a.get('service_name')}" for a in alerts[:3]]
                    alerts_ctx = "Active alerts:\n" + "\n".join(lines)
                    context_used.append("alerts")
        except Exception as exc:
            logger.warning("Failed to fetch alerts for chat: %s", exc)

        # RAG context
        similar_ctx = await self._retriever.get_similar_incidents(
            {"alert_type": "", "service_name": req.service_name or "", "log_excerpt": req.message},
            user_id,
        )
        if similar_ctx != "No similar past incidents found.":
            context_used.append("past_incidents")

        # ── Build system prompt with context ──────────────────────────────
        context_block = "\n\n".join(
            part for part in [
                f"=== METRICS ===\n{metrics_ctx}" if metrics_ctx else "",
                f"=== ALERTS ===\n{alerts_ctx}" if alerts_ctx else "",
                f"=== PAST INCIDENTS ===\n{similar_ctx}" if similar_ctx else "",
            ]
            if part
        )

        system = CHAT_PROMPT
        if context_block:
            system += f"\n\n--- CURRENT CONTEXT ---\n{context_block}"

        # ── Build messages list ───────────────────────────────────────────
        messages = [{"role": m.role, "content": m.content} for m in req.conversation_history]
        messages.append({"role": "user", "content": req.message})

        # ── Call Claude ───────────────────────────────────────────────────
        reply = await self._claude.chat(messages, system)

        return ChatResponse(reply=reply, context_used=context_used)
