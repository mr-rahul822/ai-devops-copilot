"""
src/agents/decision_agent.py — Agent 3: Decision Agent.

THIS IS THE ONLY AGENT THAT CALLS THE LLM.
It takes pre-processed output from Agent 1 (logs) and Agent 2 (metrics),
fetches similar past incidents via RAG, calls Claude, and returns a
structured decision with root cause, recommended action, and confidence.

Reuses existing code:
  - src/llm/client.py     → ClaudeClient
  - src/rag/retriever.py  → Retriever
  - src/llm/prompts.py    → MULTI_AGENT_DECISION_PROMPT
"""

import json
import logging
from src.agents.base_agent import BaseAgent
from src.llm.client import ClaudeClient
from src.rag.retriever import Retriever
from src.llm.prompts import MULTI_AGENT_DECISION_PROMPT

logger = logging.getLogger(__name__)


class DecisionAgent(BaseAgent):
    """Agent 3 — the only agent that calls Claude via the LLM client."""

    agent_name = "DecisionAgent"

    def __init__(self, claude_client: ClaudeClient, retriever: Retriever):
        self._claude = claude_client
        self._retriever = retriever

    async def run(self, input_data: dict) -> dict:
        self.validate_input(input_data, ["log_analysis", "metrics_analysis"])

        log_analysis: dict = input_data["log_analysis"]
        metrics_analysis: dict = input_data["metrics_analysis"]
        alert_type: str = input_data.get("alert_type", "UNKNOWN")
        service_name: str = input_data.get("service_name", "unknown-service")
        user_id: str = input_data.get("user_id", "")

        # ── 1. Build human-readable summaries for the prompt ──────────────
        log_summary = self._summarise_logs(log_analysis)
        metrics_summary = self._summarise_metrics(metrics_analysis)

        # ── 2. Fetch similar past incidents via RAG ───────────────────────
        similar_text = await self._fetch_similar(
            alert_type, service_name, user_id, log_analysis
        )

        # ── 3. Build the system prompt (slot in summaries) ────────────────
        system_prompt = MULTI_AGENT_DECISION_PROMPT.format(
            log_analysis_summary=log_summary,
            metrics_analysis_summary=metrics_summary,
            similar_incidents=similar_text,
        )

        # ── 4. Build the user message ────────────────────────────────────
        user_msg = (
            f"Alert type: {alert_type}\n"
            f"Service: {service_name}\n\n"
            f"Full log analysis JSON:\n{json.dumps(log_analysis, indent=2)}\n\n"
            f"Full metrics analysis JSON:\n{json.dumps(metrics_analysis, indent=2)}"
        )

        # ── 5. Call Claude API ────────────────────────────────────────────
        decision = await self._claude.diagnose(system_prompt, user_msg)

        # Ensure required keys have defaults
        decision.setdefault("root_cause", "Unable to determine root cause")
        decision.setdefault("simple_explanation", "")
        decision.setdefault("recommended_action", "investigate_logs")
        decision.setdefault("action_target", service_name)
        decision.setdefault("fix_steps", [])
        decision.setdefault("severity", "MEDIUM")
        decision.setdefault("confidence", 0.5)
        decision.setdefault("time_to_fix", "5-30 min")
        decision.setdefault("reasoning", "")

        return decision

    # ── Internal helpers ──────────────────────────────────────────────────

    @staticmethod
    def _summarise_logs(la: dict) -> str:
        """Build a one-paragraph summary of the log analysis for the prompt."""
        if la.get("fallback") or la.get("error"):
            return "Log analysis was not available (empty or failed)."
        parts = [
            f"{la.get('error_count', 0)} errors, {la.get('warn_count', 0)} warnings",
            f"error rate {la.get('error_rate', 0):.0%}",
            f"severity {la.get('log_severity', 'UNKNOWN')}",
        ]
        patterns = la.get("detected_patterns", [])
        if patterns:
            parts.append(f"detected patterns: {', '.join(patterns)}")
        samples = la.get("sample_errors", [])
        if samples:
            parts.append(f"sample: \"{samples[0]}\"")
        return "; ".join(parts)

    @staticmethod
    def _summarise_metrics(ma: dict) -> str:
        """Build a one-paragraph summary of the metrics analysis for the prompt."""
        if ma.get("fallback") or ma.get("error"):
            return "Metrics analysis was not available (empty or failed)."
        parts = [
            f"avg CPU {ma.get('avg_cpu', 0)}%, max {ma.get('max_cpu', 0)}%",
            f"avg RAM {ma.get('avg_ram', 0)}%, max {ma.get('max_ram', 0)}%",
            f"CPU trend: {ma.get('cpu_trend', 'STABLE')}",
            f"anomaly score: {ma.get('anomaly_score', 0)} ({ma.get('anomaly_level', 'LOW')})",
        ]
        if ma.get("spike_detected"):
            parts.append(f"spike detected (magnitude {ma.get('spike_magnitude', 0)})")
        if ma.get("consecutive_high_readings", 0) > 0:
            parts.append(f"{ma['consecutive_high_readings']} consecutive high readings")
        return "; ".join(parts)

    async def _fetch_similar(
        self, alert_type: str, service_name: str, user_id: str, log_analysis: dict
    ) -> str:
        """Delegate to the existing Retriever to search Pinecone."""
        try:
            return await self._retriever.get_similar_incidents(
                {
                    "alert_type": alert_type,
                    "service_name": service_name,
                    "log_excerpt": "; ".join(log_analysis.get("sample_errors", [])[:2]),
                },
                user_id,
            )
        except Exception as exc:
            logger.warning("RAG retrieval failed: %s", exc)
            return "No similar past incidents found (retrieval error)."
