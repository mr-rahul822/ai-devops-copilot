"""
src/services/diagnosis_service.py — Core orchestrator for the /ai/diagnose endpoint.

Flow:
  1. Fetch recent metrics from metrics-service
  2. Fetch recent open alerts from alert-service
  3. Retrieve similar past incidents from Pinecone (RAG)
  4. Build a structured prompt combining all context
  5. Call Claude API for diagnosis
  6. Save incident to PostgreSQL
  7. Return the diagnosis
"""

import json
import logging
import uuid
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.llm.client import ClaudeClient
from src.llm.prompts import DIAGNOSIS_PROMPT
from src.models import Incident
from src.rag.retriever import Retriever
from src.schemas import DiagnoseRequest, DiagnoseResponse

logger = logging.getLogger(__name__)


class DiagnosisService:
    """Ties together metrics, alerts, RAG, LLM, and DB to produce a diagnosis."""

    def __init__(
        self,
        claude: ClaudeClient,
        retriever: Retriever,
        http_client: httpx.AsyncClient,
    ):
        self._claude = claude
        self._retriever = retriever
        self._http = http_client

    async def diagnose(
        self, req: DiagnoseRequest, db: AsyncSession, auth_token: str
    ) -> DiagnoseResponse:
        user_id = req.user_id
        service_name = req.service_name
        headers = {"Authorization": f"Bearer {auth_token}"}

        # ── STEP 1: Fetch recent metrics ──────────────────────────────────
        metrics_text = await self._fetch_metrics(user_id, service_name, headers)

        # ── STEP 2: Fetch recent alerts ───────────────────────────────────
        alerts_text = await self._fetch_alerts(user_id, headers)

        # ── STEP 3: RAG — find similar past incidents ─────────────────────
        similar_text = await self._retriever.get_similar_incidents(
            {
                "alert_type": req.alert_type,
                "service_name": service_name,
                "log_excerpt": req.log_excerpt,
            },
            user_id,
        )

        # ── STEP 4: Build LLM prompt ─────────────────────────────────────
        user_message = self._build_prompt(req, metrics_text, alerts_text, similar_text)

        # ── STEP 5: Call Claude API ───────────────────────────────────────
        ai_response = await self._claude.diagnose(DIAGNOSIS_PROMPT, user_message)

        # ── STEP 6: Save incident to PostgreSQL ──────────────────────────
        incident = Incident(
            user_id=uuid.UUID(user_id),
            service_name=service_name,
            alert_id=uuid.UUID(req.alert_id) if req.alert_id else None,
            alert_type=req.alert_type,
            severity=ai_response.get("severity", "UNKNOWN"),
            cpu_percent=None,  # filled from metrics if available
            ram_percent=None,
            disk_percent=None,
            log_excerpt=req.log_excerpt,
            root_cause=ai_response.get("root_cause"),
            simple_explanation=ai_response.get("simple_explanation"),
            fix_steps=ai_response.get("fix_steps"),
            resolution=None,
            status="open",
            confidence=ai_response.get("confidence"),
            ai_response=ai_response,
        )
        db.add(incident)
        await db.commit()
        await db.refresh(incident)

        logger.info("Incident %s created for service %s", incident.id, service_name)

        # ── STEP 7: Return response ──────────────────────────────────────
        return DiagnoseResponse(
            incident_id=str(incident.id),
            root_cause=ai_response.get("root_cause", ""),
            simple_explanation=ai_response.get("simple_explanation", ""),
            fix_steps=ai_response.get("fix_steps", []),
            severity=ai_response.get("severity", "UNKNOWN"),
            time_to_fix=ai_response.get("time_to_fix", "unknown"),
            confidence=ai_response.get("confidence", 0.0),
            similar_past_incident=ai_response.get("similar_past_incident"),
        )

    # ── Internal helpers ─────────────────────────────────────────────────

    async def _fetch_metrics(
        self, user_id: str, service_name: str, headers: dict
    ) -> str:
        """GET metrics/history from metrics-service. Returns formatted text."""
        try:
            resp = await self._http.get(
                f"{settings.metrics_service_url}/metrics/history",
                params={"user_id": user_id, "service_name": service_name, "hours": 1},
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    latest = data[-1]
                    return (
                        f"Latest metrics — CPU: {latest.get('cpu_percent', 'N/A')}%, "
                        f"RAM: {latest.get('ram_percent', 'N/A')}%, "
                        f"Disk: {latest.get('disk_percent', 'N/A')}%\n"
                        f"Total readings in last hour: {len(data)}"
                    )
            return "No recent metrics available."
        except Exception as exc:
            logger.warning("Failed to fetch metrics: %s", exc)
            return "Metrics service unavailable."

    async def _fetch_alerts(self, user_id: str, headers: dict) -> str:
        """GET alerts from alert-service. Returns formatted text."""
        try:
            resp = await self._http.get(
                f"{settings.alert_service_url}/alerts",
                params={"user_id": user_id, "status": "open"},
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                alerts = data.get("alerts", [])
                if alerts:
                    lines = []
                    for a in alerts[:5]:  # limit to 5 most recent
                        lines.append(
                            f"- [{a.get('severity')}] {a.get('alert_type')} "
                            f"on {a.get('service_name')}: {a.get('message', '')}"
                        )
                    return "Active alerts:\n" + "\n".join(lines)
            return "No active alerts."
        except Exception as exc:
            logger.warning("Failed to fetch alerts: %s", exc)
            return "Alert service unavailable."

    @staticmethod
    def _build_prompt(
        req: DiagnoseRequest,
        metrics_text: str,
        alerts_text: str,
        similar_text: str,
    ) -> str:
        sections = [
            f"=== ALERT INFORMATION ===\n"
            f"Service: {req.service_name}\n"
            f"Alert type: {req.alert_type}\n",

            f"=== CURRENT METRICS ===\n{metrics_text}\n",

            f"=== ACTIVE ALERTS ===\n{alerts_text}\n",
        ]

        if req.log_excerpt:
            sections.append(f"=== LOG EXCERPT ===\n{req.log_excerpt}\n")

        sections.append(f"=== SIMILAR PAST INCIDENTS ===\n{similar_text}\n")

        return "\n".join(sections)
