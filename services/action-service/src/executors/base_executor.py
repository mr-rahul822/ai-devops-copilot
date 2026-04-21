"""
src/executors/base_executor.py — Abstract base class for all executors.

Every executor (Docker, AWS, etc.) must implement:
  - execute(action) → dict
  - validate(action) → bool
  - executor_type property
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any


class BaseExecutor(ABC):
    """Abstract base for infrastructure executors."""

    @property
    @abstractmethod
    def executor_type(self) -> str:
        """Return the executor type identifier, e.g. 'docker' or 'aws'."""
        ...

    @abstractmethod
    async def execute(self, action: dict) -> dict:
        """
        Execute the infrastructure action.

        Args:
            action: dict with keys action_type, target_service, params, etc.

        Returns:
            Result dict with at least: success, message, details, executed_at
        """
        ...

    @abstractmethod
    def validate(self, action: dict) -> bool:
        """
        Validate that the action can be executed.

        Args:
            action: dict with keys action_type, target_service, params, etc.

        Returns:
            True if valid, False otherwise.
        """
        ...

    @staticmethod
    def build_result(
        success: bool,
        message: str,
        details: dict | None = None,
    ) -> dict:
        """
        Build a standardised result dict.

        Returns:
            { success, message, details, executed_at }
        """
        return {
            "success": success,
            "message": message,
            "details": details or {},
            "executed_at": datetime.now(timezone.utc).isoformat(),
        }
