"""
src/agents/orchestrator.py — Multi-Agent Pipeline Orchestrator.

Runs the four agents:
  1. LogAnalyzerAgent      (regex + LLM)       ┐ parallel
  2. MetricsAnalyzerAgent  (statistics)        ┘
  3. DecisionAgent         (Claude LLM — critical)  sequential
  4. ExecutorAgent         (planning)                sequential

Agent 1 and Agent 2 run concurrently via asyncio.gather() since they
are independent information-gathering steps.  Agent 3 and 4 must run
sequentially because each depends on the previous output.

If the DecisionAgent (LLM) fails, the pipeline returns a partial
diagnosis with log/metrics data and a manual-review flag instead of
crashing.

Saves the final result to PostgreSQL via existing database/models code.

Reuses existing Phase 4 code:
  - src/llm/client.py      → ClaudeClient
  - src/rag/retriever.py   → Retriever
  - src/database.py        → AsyncSessionLocal
  - src/models.py          → Incident
"""

import asyncio
import json
import logging
import time
import uuid
import os
import httpx
import base64

def _extract_user_id_from_jwt(token: str) -> str:
    try:
        parts = token.split(".")
        if len(parts) >= 2:
            payload_b64 = parts[1]
            payload_b64 += "=" * (4 - len(payload_b64) % 4)
            payload_bytes = base64.b64decode(payload_b64.replace("-", "+").replace("_", "/"))
            payload = json.loads(payload_bytes.decode("utf-8"))
            return payload.get("userId") or payload.get("user_id") or payload.get("sub") or ""
    except Exception:
        pass
    return ""

from src.agents.log_analyzer_agent import LogAnalyzerAgent
from src.agents.metrics_analyzer_agent import MetricsAnalyzerAgent
from src.agents.decision_agent import DecisionAgent
from src.agents.executor_agent import ExecutorAgent
from src.database import AsyncSessionLocal
from src.models import Incident
from src.llm.client import ClaudeClient
from src.rag.retriever import Retriever

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """Coordinates the 4-agent pipeline and persists the result."""

    PIPELINE_VERSION = "multi-agent-v2"

    def __init__(self, claude_client: ClaudeClient, retriever: Retriever):
        self._claude = claude_client
        self._retriever = retriever

        # Instantiate agents — LogAnalyzerAgent now gets the LLM client
        self._log_agent = LogAnalyzerAgent(claude_client)
        self._metrics_agent = MetricsAnalyzerAgent()
        self._decision_agent = DecisionAgent(claude_client, retriever)
        self._executor_agent = ExecutorAgent()

    async def run(self, input_data: dict, token: str | None = None) -> dict:
        """
        Execute the full 4-agent pipeline.

        Required input_data keys:
            user_id, service_name, raw_logs, current_cpu, current_ram
        Optional:
            alert_id, alert_type, metrics_history
        """
        pipeline_start = time.time()
        agents_completed = 0

        user_id = input_data.get("user_id", "")
        service_name = input_data.get("service_name", "unknown")

        # ── PHASE 1: Parallel information gathering (Agent 1 + Agent 2) ───
        parallel_start = time.time()

        log_analysis, metrics_analysis = await asyncio.gather(
            self._log_agent.safe_run({
                "raw_logs": input_data.get("raw_logs", ""),
                "service_name": service_name,
            }),
            self._metrics_agent.safe_run({
                "metrics_history": input_data.get("metrics_history", []),
                "current_cpu": input_data.get("current_cpu", 0.0),
                "current_ram": input_data.get("current_ram", 0.0),
            }),
        )

        parallel_elapsed = time.time() - parallel_start
        agents_completed += 2
        logger.info(
            "[Pipeline] Parallel agents completed in %.2fs — "
            "log_severity=%s, anomaly_score=%s",
            parallel_elapsed,
            log_analysis.get("log_severity") or log_analysis.get("severity", "?"),
            metrics_analysis.get("anomaly_score", "?"),
        )

        # ── PHASE 2: Decision + Execution (sequential, LLM-dependent) ────
        try:
            # ── AGENT 3: Decision (LLM — CRITICAL) ───────────────────────
            decision = await self._decision_agent.safe_run({
                "log_analysis": log_analysis,
                "metrics_analysis": metrics_analysis,
                "alert_type": input_data.get("alert_type", "UNKNOWN"),
                "service_name": service_name,
                "user_id": user_id,
            })

            # If DecisionAgent returned a fallback (internal failure)
            if decision.get("fallback"):
                raise RuntimeError(
                    decision.get("error", "DecisionAgent returned fallback")
                )

            agents_completed += 1
            logger.info(
                "Agent 3 complete: action=%s, confidence=%s",
                decision.get("recommended_action", "?"),
                decision.get("confidence", "?"),
            )

            # ── AGENT 4: Executor (planning) ─────────────────────────────
            action_plan = await self._executor_agent.safe_run({
                "decision": decision,
                "user_id": user_id,
                "service_name": service_name,
            })
            agents_completed += 1
            logger.info(
                "Agent 4 complete: risk=%s, approval_needed=%s",
                action_plan.get("risk_level", "?"),
                action_plan.get("requires_approval", "?"),
            )

        except Exception as e:
            # ── Graceful fallback when LLM fails ─────────────────────────
            total_elapsed = round((time.time() - pipeline_start) * 1000)
            logger.error("Pipeline DecisionAgent failed: %s", e)
            logger.info(
                "[Pipeline] Total diagnosis completed in %.2fs (partial — LLM failed)",
                (time.time() - pipeline_start),
            )

            # Still save a partial incident so the alert isn't lost
            incident_id = await self._save_incident(
                user_id=user_id,
                service_name=service_name,
                alert_id=input_data.get("alert_id"),
                alert_type=input_data.get("alert_type"),
                current_cpu=input_data.get("current_cpu"),
                current_ram=input_data.get("current_ram"),
                raw_logs=input_data.get("raw_logs", ""),
                decision={
                    "root_cause": "AI decision engine unavailable — partial data collected",
                    "severity": "UNKNOWN",
                    "confidence": 0.0,
                },
                full_result={
                    "log_analysis": log_analysis,
                    "metrics_analysis": metrics_analysis,
                },
            )

            return {
                "incident_id": incident_id,
                "status": "partial_diagnosis",
                "pipeline_version": self.PIPELINE_VERSION,
                "agents_completed": agents_completed,
                "root_cause": "AI decision engine unavailable — partial data collected",
                "log_analysis": log_analysis,
                "metrics_analysis": metrics_analysis,
                "action_plan": None,
                "requires_manual_review": True,
                "error": str(e),
                "processing_time_ms": total_elapsed,
            }

        total_elapsed = round((time.time() - pipeline_start) * 1000)
        logger.info(
            "[Pipeline] Total diagnosis completed in %.2fs",
            (time.time() - pipeline_start),
        )

        # ── Persist incident to PostgreSQL ────────────────────────────────
        incident_id = await self._save_incident(
            user_id=user_id,
            service_name=service_name,
            alert_id=input_data.get("alert_id"),
            alert_type=input_data.get("alert_type"),
            current_cpu=input_data.get("current_cpu"),
            current_ram=input_data.get("current_ram"),
            raw_logs=input_data.get("raw_logs", ""),
            decision=decision,
            full_result={
                "log_analysis": log_analysis,
                "metrics_analysis": metrics_analysis,
                "decision": decision,
                "action_plan": action_plan,
            },
        )

        # ── Register Action Plan in Action Service ────────────────────────
        if token and action_plan and action_plan.get("action_plan"):
            plan_details = action_plan["action_plan"]
            executor = plan_details.get("executor")
            if executor in ["docker", "aws"]:
                try:
                    # Extract user_id from JWT or fallback to UUID to avoid 500 error
                    resolved_user_id = _extract_user_id_from_jwt(token) or user_id or str(uuid.uuid4())
                    action_payload = {
                        "user_id": resolved_user_id,
                        "action_type": plan_details.get("command"),
                        "target_service": plan_details.get("target"),
                        "executor_type": executor,
                        "risk_level": action_plan.get("risk_level", "MEDIUM"),
                        "requires_approval": action_plan.get("requires_approval", True),
                        "params": plan_details.get("params", {}),
                        "incident_id": incident_id,
                    }
                    action_service_url = os.getenv("ACTION_SERVICE_URL", "http://action-service:8003")
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post(
                            f"{action_service_url}/actions/execute",
                            json=action_payload,
                            headers={"Authorization": f"Bearer {token}"},
                        )
                        if resp.status_code in [200, 201]:
                            logger.info("Successfully registered action plan with Action Service.")
                        else:
                            logger.warning(
                                "Failed to register action plan. Action service returned status: %d, body: %s",
                                resp.status_code,
                                resp.text,
                            )
                except Exception as exc:
                    logger.warning("Error registering action plan with Action Service: %s", exc)

        # ── Build final result ────────────────────────────────────────────
        return {
            "incident_id": incident_id,
            "pipeline_version": self.PIPELINE_VERSION,
            "agents_completed": agents_completed,
            "log_analysis": log_analysis,
            "metrics_analysis": metrics_analysis,
            "decision": decision,
            "action_plan": action_plan,
            "summary": {
                "root_cause": decision.get("root_cause", ""),
                "severity": decision.get("severity", "UNKNOWN"),
                "recommended_action": decision.get("recommended_action", ""),
                "requires_approval": action_plan.get("requires_approval", True),
                "confidence": decision.get("confidence", 0.0),
            },
            "processing_time_ms": total_elapsed,
        }

    # ── DB persistence ────────────────────────────────────────────────────

    async def _save_incident(
        self,
        user_id: str,
        service_name: str,
        alert_id: str | None,
        alert_type: str | None,
        current_cpu: float | None,
        current_ram: float | None,
        raw_logs: str,
        decision: dict,
        full_result: dict,
    ) -> str:
        """Save the pipeline result as an Incident row.  Returns the incident UUID string."""
        try:
            async with AsyncSessionLocal() as session:
                incident = Incident(
                    user_id=uuid.UUID(user_id) if user_id else uuid.uuid4(),
                    service_name=service_name,
                    alert_id=uuid.UUID(alert_id) if alert_id else None,
                    alert_type=alert_type,
                    severity=decision.get("severity"),
                    cpu_percent=current_cpu,
                    ram_percent=current_ram,
                    log_excerpt=raw_logs[:2000] if raw_logs else None,
                    root_cause=decision.get("root_cause"),
                    simple_explanation=decision.get("simple_explanation"),
                    fix_steps=decision.get("fix_steps"),
                    resolution=None,
                    status="open",
                    confidence=decision.get("confidence"),
                    ai_response=full_result,
                )
                session.add(incident)
                await session.commit()
                await session.refresh(incident)
                logger.info("Incident %s saved to DB (multi-agent pipeline).", incident.id)
                return str(incident.id)
        except Exception as exc:
            logger.error("Failed to save incident: %s", exc, exc_info=True)
            return str(uuid.uuid4())  # return a placeholder UUID so response can still be returned
