"""
src/rag/retriever.py — High-level retriever that searches for similar past incidents
and formats them as readable context for the LLM prompt.
"""

import logging
from datetime import datetime

from src.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)


class Retriever:
    """Fetches similar past incidents from Pinecone and formats them for the LLM."""

    def __init__(self, vector_store: VectorStore):
        self._vs = vector_store

    async def get_similar_incidents(self, alert_data: dict, user_id: str) -> str:
        """
        Builds a query from the current alert, searches Pinecone, and
        returns a human-readable summary string to inject into the LLM prompt.

        Args:
            alert_data: dict with keys like alert_type, service_name, cpu_percent, etc.
            user_id: UUID string to filter results by tenant.

        Returns:
            Formatted string or "No similar past incidents found."
        """
        # Build search query from alert context
        query_parts = []
        if alert_data.get("alert_type"):
            query_parts.append(alert_data["alert_type"])
        if alert_data.get("service_name"):
            query_parts.append(f"on {alert_data['service_name']}")
        if alert_data.get("cpu_percent") is not None:
            query_parts.append(f"CPU: {alert_data['cpu_percent']}%")
        if alert_data.get("ram_percent") is not None:
            query_parts.append(f"RAM: {alert_data['ram_percent']}%")
        if alert_data.get("log_excerpt"):
            query_parts.append(alert_data["log_excerpt"][:200])

        query_text = " ".join(query_parts) if query_parts else "infrastructure incident"

        matches = await self._vs.search_similar(query_text, user_id, top_k=3)

        if not matches:
            return "No similar past incidents found."

        lines = []
        for i, match in enumerate(matches, 1):
            meta = match.get("metadata", {})
            score = match.get("score", 0)
            resolved_at = meta.get("resolved_at", "unknown date")
            service = meta.get("service_name", "unknown service")
            alert_type = meta.get("alert_type", "unknown alert")
            resolution = meta.get("resolution", "no resolution recorded")
            severity = meta.get("severity", "unknown")

            # Try to compute "X days ago" if resolved_at is parseable
            time_ago = ""
            try:
                dt = datetime.fromisoformat(resolved_at)
                delta = datetime.now(dt.tzinfo) - dt
                if delta.days == 0:
                    time_ago = "today"
                elif delta.days == 1:
                    time_ago = "1 day ago"
                else:
                    time_ago = f"{delta.days} days ago"
            except (ValueError, TypeError):
                time_ago = resolved_at

            lines.append(
                f"Past similar incident {i} ({time_ago}, similarity: {score:.0%}):\n"
                f"  Alert: {alert_type} on {service} (severity: {severity})\n"
                f"  Resolution: {resolution}"
            )

        return "\n\n".join(lines)
