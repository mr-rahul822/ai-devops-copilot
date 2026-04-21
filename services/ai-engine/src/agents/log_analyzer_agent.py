"""
src/agents/log_analyzer_agent.py — Agent 1: Log Analyzer.

Pure Python pattern-matching — NO LLM calls.
Scans raw log text for error keywords, detects common failure patterns
(connection, memory, timeout, crash), computes error rate, and returns
a structured analysis dict.
"""

import re
import logging
from src.agents.base_agent import BaseAgent

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

# Regex to detect common log timestamp formats:
#   2024-04-19T12:34:56  |  2024-04-19 12:34:56  |  Apr 19 12:34:56
_TIMESTAMP_RE = re.compile(
    r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}"
    r"|[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}"
)


class LogAnalyzerAgent(BaseAgent):
    """Agent 1 — analyses raw log text with regex, no LLM."""

    agent_name = "LogAnalyzerAgent"

    async def run(self, input_data: dict) -> dict:
        raw_logs: str = input_data.get("raw_logs", "")

        # Edge case: empty / whitespace-only logs → fallback
        if not raw_logs or not raw_logs.strip():
            logger.warning("LogAnalyzerAgent received empty logs — using fallback.")
            return self._fallback()

        lines = raw_logs.strip().splitlines()
        total_lines = len(lines)

        # ── Keyword counts ────────────────────────────────────────────────
        error_count = self._count_keywords(raw_logs, _ERROR_KEYWORDS)
        warn_count = self._count_keywords(raw_logs, _WARN_KEYWORDS)

        # ── Error lines & error rate ──────────────────────────────────────
        error_lines: list[str] = []
        for idx, line in enumerate(lines, 1):
            upper = line.upper()
            if any(kw.upper() in upper for kw in _ERROR_KEYWORDS):
                error_lines.append(f"{line.strip()} (line {idx})")
        error_rate = round(len(error_lines) / total_lines, 2) if total_lines else 0.0

        # ── Pattern detection ─────────────────────────────────────────────
        detected_patterns: list[str] = []
        for name, compiled_list in _COMPILED_PATTERNS.items():
            for pat in compiled_list:
                if pat.search(raw_logs):
                    detected_patterns.append(name)
                    break  # one match per pattern category is enough

        primary_error_type = detected_patterns[0] if detected_patterns else "unknown"

        # ── Sample errors (max 5) ─────────────────────────────────────────
        sample_errors = error_lines[:5]

        # ── First timestamp ───────────────────────────────────────────────
        ts_match = _TIMESTAMP_RE.search(raw_logs)
        first_timestamp = ts_match.group(0) if ts_match else None

        # ── Severity classification ───────────────────────────────────────
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
            "sample_errors": sample_errors,
            "log_severity": severity,
            "first_timestamp": first_timestamp,
            "total_lines": total_lines,
            "analysis_method": "pattern_matching",
        }

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _count_keywords(text: str, keywords: list[str]) -> int:
        """Count how many times any of the keywords appear (case-insensitive)."""
        upper = text.upper()
        return sum(upper.count(kw.upper()) for kw in keywords)

    @staticmethod
    def _fallback() -> dict:
        """Return a safe default when logs are empty or unreadable."""
        return {
            "error_count": 0,
            "warn_count": 0,
            "error_rate": 0.0,
            "detected_patterns": [],
            "primary_error_type": "unknown",
            "sample_errors": [],
            "log_severity": "UNKNOWN",
            "first_timestamp": None,
            "total_lines": 0,
            "analysis_method": "pattern_matching",
            "fallback": True,
        }
