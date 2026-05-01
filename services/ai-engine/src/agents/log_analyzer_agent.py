"""
src/agents/log_analyzer_agent.py — Agent 1: Log Analyzer.

Two-stage analysis:
  1. Fast regex pre-filter to flag obvious keywords (ERROR, OOM, etc.)
  2. LLM-powered semantic analysis via Claude for contextual understanding

Falls back to regex-only results if the LLM is unavailable.
"""

import json
import re
import logging
from src.agents.base_agent import BaseAgent
from src.llm.client import ClaudeClient

logger = logging.getLogger(__name__)

# Keywords to count (case-insensitive search)
_ERROR_KEYWORDS = ["ERROR", "FATAL", "Exception", "Timeout", "refused", "exhausted", "killed", "OOM"]
_WARN_KEYWORDS = ["WARN", "WARNING"]

# Named patterns and their associated regex (all case-insensitive)
_PATTERNS: dict[str, list[str]] = {
    "connection_pool": [
        r"connection\s+refused",
        r"pool\s+exhausted",
        r"too\s+many\s+connections",
    ],
    "memory": [
        r"\bOOM\b",
        r"out\s+of\s+memory",
        r"\bkilled\b",
    ],
    "timeout": [
        r"timed?\s*out",
        r"deadline\s+exceeded",
        r"\btimeout\b",
    ],
    "crash": [
        r"segfault",
        r"\bpanic\b",
        r"fatal\s+error",
    ],
}

# Pre-compile for speed
_COMPILED_PATTERNS: dict[str, list[re.Pattern]] = {
    name: [re.compile(p, re.IGNORECASE) for p in regexes]
    for name, regexes in _PATTERNS.items()
}

# System prompt for LLM log analysis
_LOG_ANALYSIS_SYSTEM_PROMPT = (
    "You are an expert DevOps engineer analyzing container and service logs. "
    "Your job is to identify the root cause of issues, classify their severity, "
    "and suggest what kind of fix is needed. Be concise and specific. "
    "Always respond in valid JSON."
)

# Instruction appended to the user message
_LOG_ANALYSIS_INSTRUCTION = (
    "Analyze these logs and return a JSON object with these exact fields: "
    "{ \"has_error\": boolean, \"severity\": \"critical\" | \"high\" | \"medium\" "
    "| \"low\" | \"none\", \"root_cause\": string (one sentence), \"error_type\": "
    "string (e.g. \"OOM\", \"timeout\", \"crash\", \"connection_pool\", \"none\"), "
    "\"recommended_action\": string (one sentence), \"confidence\": number between 0 and 1 }"
)


class LogAnalyzerAgent(BaseAgent):
    """Agent 1 — regex pre-filter + LLM semantic analysis."""

    agent_name = "LogAnalyzerAgent"

    def __init__(self, claude_client: ClaudeClient | None = None):
        self._claude = claude_client

    async def run(self, input_data: dict) -> dict:
        raw_logs: str = input_data.get("raw_logs", "")
        service_name: str = input_data.get("service_name", "unknown")

        # Edge case: empty / whitespace-only logs → fallback
        if not raw_logs or not raw_logs.strip():
            logger.warning("LogAnalyzerAgent received empty logs — using fallback.")
            return self._empty_fallback()

        # ── Step 1: Regex pre-filter ──────────────────────────────────────
        regex_result = self._regex_prefilter(raw_logs)

        # ── Step 2–4: LLM analysis (if client available) ──────────────────
        if self._claude:
            llm_result = await self._llm_analyze(
                raw_logs, regex_result, service_name
            )
            if llm_result is not None:
                # Merge regex stats into LLM result for completeness
                llm_result["regex_error_count"] = regex_result["error_count"]
                llm_result["regex_warn_count"] = regex_result["warn_count"]
                llm_result["regex_patterns"] = regex_result["detected_patterns"]
                llm_result["analysis_method"] = "llm_with_regex_prefilter"
                return llm_result

        # ── Fallback: regex-only when LLM is unavailable ──────────────────
        logger.warning("LLM unavailable — returning regex-only analysis.")
        regex_result["analysis_method"] = "regex_only"
        return regex_result

    # ── LLM analysis ─────────────────────────────────────────────────────

    async def _llm_analyze(
        self, raw_logs: str, regex_result: dict, service_name: str
    ) -> dict | None:
        """
        Call Claude to semantically analyze the logs.
        Returns the parsed dict, or None if the call fails.
        """
        try:
            # Truncate logs to last 3000 chars for LLM context window
            truncated_logs = raw_logs[-3000:] if len(raw_logs) > 3000 else raw_logs

            # Build hints from regex pre-filter
            hints = regex_result.get("detected_patterns", [])
            hint_text = (
                f"\n\nRegex pre-filter detected these patterns: {', '.join(hints)}"
                if hints
                else "\n\nRegex pre-filter found no obvious keyword matches."
            )

            user_message = (
                f"Service: {service_name}\n\n"
                f"--- LOGS ---\n{truncated_logs}\n--- END LOGS ---\n"
                f"{hint_text}\n\n"
                f"{_LOG_ANALYSIS_INSTRUCTION}"
            )

            result = await self._claude.diagnose(
                _LOG_ANALYSIS_SYSTEM_PROMPT, user_message
            )

            # Ensure required keys exist with defaults
            result.setdefault("has_error", len(hints) > 0)
            result.setdefault("severity", "medium" if hints else "none")
            result.setdefault("root_cause", "Unable to determine")
            result.setdefault("error_type", hints[0] if hints else "none")
            result.setdefault("recommended_action", "Review logs manually")
            result.setdefault("confidence", 0.5)

            return result

        except Exception as exc:
            logger.warning(
                "LLM log analysis failed, falling back to regex: %s", exc
            )
            # Return structured fallback instead of crashing
            regex_matches = regex_result.get("detected_patterns", [])
            return {
                "has_error": len(regex_matches) > 0,
                "severity": "medium" if regex_matches else "none",
                "root_cause": "Log analysis inconclusive — manual review needed",
                "error_type": regex_matches[0] if regex_matches else "none",
                "recommended_action": "Review logs manually",
                "confidence": 0.3,
                "analysis_method": "regex_fallback",
                "llm_error": str(exc),
            }

    # ── Regex pre-filter ─────────────────────────────────────────────────

    def _regex_prefilter(self, raw_logs: str) -> dict:
        """Run fast regex matching to flag obvious keywords and patterns."""
        lines = raw_logs.strip().splitlines()
        total_lines = len(lines)

        error_count = self._count_keywords(raw_logs, _ERROR_KEYWORDS)
        warn_count = self._count_keywords(raw_logs, _WARN_KEYWORDS)

        # Error lines & error rate
        error_lines: list[str] = []
        for idx, line in enumerate(lines, 1):
            upper = line.upper()
            if any(kw.upper() in upper for kw in _ERROR_KEYWORDS):
                error_lines.append(f"{line.strip()} (line {idx})")
        error_rate = round(len(error_lines) / total_lines, 2) if total_lines else 0.0

        # Pattern detection
        detected_patterns: list[str] = []
        for name, compiled_list in _COMPILED_PATTERNS.items():
            for pat in compiled_list:
                if pat.search(raw_logs):
                    detected_patterns.append(name)
                    break

        primary_error_type = detected_patterns[0] if detected_patterns else "unknown"

        # Severity classification
        if error_rate >= 0.6 or error_count >= 50 or "crash" in detected_patterns:
            severity = "CRITICAL"
        elif error_rate >= 0.3 or error_count >= 20:
            severity = "HIGH"
        elif error_rate >= 0.1 or error_count >= 5:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        return {
            "error_count": error_count,
            "warn_count": warn_count,
            "error_rate": error_rate,
            "detected_patterns": detected_patterns,
            "primary_error_type": primary_error_type,
            "sample_errors": error_lines[:5],
            "log_severity": severity,
            "total_lines": total_lines,
        }

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _count_keywords(text: str, keywords: list[str]) -> int:
        upper = text.upper()
        return sum(upper.count(kw.upper()) for kw in keywords)

    @staticmethod
    def _empty_fallback() -> dict:
        return {
            "has_error": False,
            "severity": "none",
            "root_cause": "No logs provided",
            "error_type": "none",
            "recommended_action": "Provide logs for analysis",
            "confidence": 0.0,
            "error_count": 0,
            "warn_count": 0,
            "error_rate": 0.0,
            "detected_patterns": [],
            "primary_error_type": "unknown",
            "sample_errors": [],
            "log_severity": "UNKNOWN",
            "total_lines": 0,
            "analysis_method": "none",
            "fallback": True,
        }
