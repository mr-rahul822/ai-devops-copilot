"""
src/agents/executor_agent.py — Agent 4: Executor (planning only).

THIS AGENT NEVER EXECUTES ANYTHING.
It maps the DecisionAgent's recommended_action to a concrete but
dormant action plan, assesses risk, and determines whether human
approval is required.  Actual execution is deferred to Phase 6.
"""

import logging
from src.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

# ── Action → command mapping ──────────────────────────────────────────────

_ACTION_COMMANDS: dict[str, dict] = {
    "restart_container": {
        "executor": "docker",
        "command": "restart",
    },
    "rollback_deployment": {
        "executor": "aws",
        "command": "rollback",
    },
    "scale_up": {
        "executor": "aws",
        "command": "scale",
        "params": {"desired_count": 3},
    },
    "investigate_logs": {
        "executor": "none",
        "command": "fetch_logs",
    },
    "no_action": {
        "executor": "none",
        "command": "monitor_only",
    },
}

# ── Risk levels ───────────────────────────────────────────────────────────

_RISK_MAP: dict[str, str] = {
    "restart_container": "MEDIUM",
    "rollback_deployment": "HIGH",
    "scale_up": "MEDIUM",
    "investigate_logs": "LOW",
    "no_action": "LOW",
}

# ── Downtime estimates ────────────────────────────────────────────────────

_DOWNTIME_MAP: dict[str, str] = {
    "restart_container": "10-30 seconds",
    "rollback_deployment": "30 seconds",
    "scale_up": "1-2 minutes",
    "investigate_logs": "none",
    "no_action": "none",
}

# ── Approval messages ────────────────────────────────────────────────────

_APPROVAL_MESSAGES: dict[str, str] = {
    "restart_container": (
        "This will restart the {target} container, causing ~10-30 seconds of downtime."
    ),
    "rollback_deployment": (
        "This will rollback {target} to its previous deployment version "
        "causing ~30 seconds of downtime."
    ),
    "scale_up": (
        "This will scale {target} to 3 instances. No downtime expected, "
        "but additional cost will be incurred."
    ),
    "investigate_logs": (
        "This will fetch the latest logs from {target} for manual review. "
        "No risk involved."
    ),
    "no_action": (
        "No action will be taken. The system will continue to monitor {target}."
    ),
}


class ExecutorAgent(BaseAgent):
    """Agent 4 — prepares a safe, reviewable action plan.  Never executes."""

    agent_name = "ExecutorAgent"

    async def run(self, input_data: dict) -> dict:
        self.validate_input(input_data, ["decision"])

        decision: dict = input_data["decision"]
        service_name: str = input_data.get("service_name", "unknown-service")
        user_id: str = input_data.get("user_id", "")

        action_key: str = decision.get("recommended_action", "investigate_logs")
        confidence: float = decision.get("confidence", 0.0)

        # ── Build action plan ─────────────────────────────────────────────
        cmd_template = _ACTION_COMMANDS.get(action_key, _ACTION_COMMANDS["investigate_logs"])
        action_plan = {
            "executor": cmd_template["executor"],
            "command": cmd_template["command"],
            "target": service_name,
            "params": cmd_template.get("params", {}),
        }

        # ── Risk assessment ───────────────────────────────────────────────
        risk_level = _RISK_MAP.get(action_key, "MEDIUM")

        # ── Approval requirement ──────────────────────────────────────────
        requires_approval = self._needs_approval(risk_level, confidence)

        # ── Human-readable messages ───────────────────────────────────────
        approval_msg_template = _APPROVAL_MESSAGES.get(action_key, "Action: {target}")
        approval_message = approval_msg_template.format(target=service_name)

        estimated_downtime = _DOWNTIME_MAP.get(action_key, "unknown")
        rollback_possible = action_key in ("restart_container", "rollback_deployment", "scale_up")

        # ── Friendly summary ──────────────────────────────────────────────
        action_summary = self._action_summary(action_key, service_name)

        return {
            "action_plan": action_plan,
            "risk_level": risk_level,
            "requires_approval": requires_approval,
            "approval_message": approval_message,
            "estimated_downtime": estimated_downtime,
            "rollback_possible": rollback_possible,
            "action_summary": action_summary,
            "ready_to_execute": False,  # always False — Phase 6 handles execution
        }

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _needs_approval(risk_level: str, confidence: float) -> bool:
        """Determine whether human approval is required."""
        if risk_level == "HIGH":
            return True
        if risk_level == "MEDIUM" and confidence < 0.80:
            return True
        return False

    @staticmethod
    def _action_summary(action_key: str, target: str) -> str:
        summaries = {
            "restart_container": f"Restart {target} container",
            "rollback_deployment": f"Rollback {target} deployment",
            "scale_up": f"Scale up {target} to 3 instances",
            "investigate_logs": f"Fetch and review {target} logs",
            "no_action": f"Continue monitoring {target}",
        }
        return summaries.get(action_key, f"Unknown action on {target}")
