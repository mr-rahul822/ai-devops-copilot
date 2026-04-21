"""
src/agents/base_agent.py — Abstract base class for all pipeline agents.

Every agent inherits from BaseAgent and implements `async run(input_data) -> dict`.
The base provides input validation, structured logging, and graceful error handling
so a single agent failure does not crash the whole pipeline.
"""

import logging
import time
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Abstract base class for every agent in the multi-agent pipeline."""

    # Subclasses MUST set this to a human-readable name.
    agent_name: str = "BaseAgent"

    # ── Abstract method — every agent implements this ─────────────────────

    @abstractmethod
    async def run(self, input_data: dict) -> dict:
        """Execute the agent's logic and return a result dict."""
        ...

    # ── Input validation ─────────────────────────────────────────────────

    def validate_input(self, data: dict, required_keys: list[str]) -> None:
        """
        Raise ValueError if any required key is missing from *data*.
        Called at the start of run() by each concrete agent.
        """
        missing = [k for k in required_keys if k not in data]
        if missing:
            raise ValueError(
                f"{self.agent_name}: missing required input keys: {missing}"
            )

    # ── Logging helpers ──────────────────────────────────────────────────

    def log_start(self) -> None:
        """Log that the agent is beginning work."""
        logger.info("Starting %s...", self.agent_name)

    def log_complete(self, output: dict) -> None:
        """Log that the agent finished, including a few key metrics."""
        summary_keys = list(output.keys())[:5]
        logger.info(
            "%s complete — keys returned: %s",
            self.agent_name,
            summary_keys,
        )

    # ── Safe execution wrapper ───────────────────────────────────────────

    async def safe_run(self, input_data: dict) -> dict:
        """
        Execute run() wrapped in error handling.
        If the agent raises, return a structured error dict instead of
        crashing the entire pipeline.
        """
        self.log_start()
        start = time.time()
        try:
            output = await self.run(input_data)
            self.log_complete(output)
            output["_agent"] = self.agent_name
            output["_elapsed_ms"] = round((time.time() - start) * 1000)
            return output
        except Exception as exc:
            elapsed = round((time.time() - start) * 1000)
            logger.error(
                "%s failed after %d ms: %s", self.agent_name, elapsed, exc,
                exc_info=True,
            )
            return {
                "error": f"{self.agent_name} failed: {exc}",
                "agent": self.agent_name,
                "fallback": True,
                "_agent": self.agent_name,
                "_elapsed_ms": elapsed,
            }
