"""
src/agents/metrics_analyzer_agent.py — Agent 2: Metrics Analyzer.

Pure Python statistics — NO LLM calls.
Analyses CPU/RAM time-series data: averages, max, trend detection,
spike detection via standard deviation, anomaly scoring.
"""

import math
import logging
from src.agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class MetricsAnalyzerAgent(BaseAgent):
    """Agent 2 — statistical analysis on CPU/RAM time-series, no LLM."""

    agent_name = "MetricsAnalyzerAgent"

    async def run(self, input_data: dict) -> dict:
        history: list[dict] = input_data.get("metrics_history", [])
        current_cpu: float = input_data.get("current_cpu", 0.0)
        current_ram: float = input_data.get("current_ram", 0.0)

        # If no history, build a minimal analysis from current values alone
        if not history:
            logger.warning("MetricsAnalyzerAgent received empty history — using current values only.")
            return self._from_current(current_cpu, current_ram)

        cpu_values = [m.get("cpu", 0.0) for m in history]
        ram_values = [m.get("ram", 0.0) for m in history]
        n = len(cpu_values)

        # ── Averages & max ────────────────────────────────────────────────
        avg_cpu = round(self._mean(cpu_values), 1)
        avg_ram = round(self._mean(ram_values), 1)
        max_cpu = round(max(cpu_values), 1)
        max_ram = round(max(ram_values), 1)

        # ── Standard deviation ────────────────────────────────────────────
        std_cpu = self._std(cpu_values)
        std_ram = self._std(ram_values)

        # ── Spike detection (any reading > avg + 2·σ) ─────────────────────
        spike_threshold_cpu = avg_cpu + 2 * std_cpu
        spikes = [v for v in cpu_values if v > spike_threshold_cpu]
        spike_detected = len(spikes) > 0
        spike_magnitude = round(max(spikes) - avg_cpu, 1) if spike_detected else 0.0

        # ── Trend: compare first-half avg vs second-half avg ──────────────
        cpu_trend = self._trend(cpu_values)
        ram_trend = self._trend(ram_values)

        # ── Consecutive high readings (above 85 %) ────────────────────────
        consecutive_high = self._consecutive_high(cpu_values, threshold=85.0)

        # ── Rate of change ────────────────────────────────────────────────
        rate_cpu = round((cpu_values[-1] - cpu_values[0]) / n, 1) if n > 1 else 0.0
        rate_ram = round((ram_values[-1] - ram_values[0]) / n, 1) if n > 1 else 0.0

        # ── Anomaly score (0.0 – 1.0) ────────────────────────────────────
        anomaly_score = self._anomaly_score(
            avg_cpu, max_cpu, std_cpu, spike_detected, consecutive_high, current_cpu
        )
        anomaly_level = self._anomaly_level(anomaly_score)

        return {
            "avg_cpu": avg_cpu,
            "max_cpu": max_cpu,
            "avg_ram": avg_ram,
            "max_ram": max_ram,
            "cpu_trend": cpu_trend,
            "ram_trend": ram_trend,
            "spike_detected": spike_detected,
            "spike_magnitude": spike_magnitude,
            "consecutive_high_readings": consecutive_high,
            "anomaly_score": anomaly_score,
            "anomaly_level": anomaly_level,
            "rate_of_change_cpu": rate_cpu,
            "rate_of_change_ram": rate_ram,
            "readings_count": n,
            "analysis_method": "statistical",
        }

    # ── Internal stats helpers ────────────────────────────────────────────

    @staticmethod
    def _mean(values: list[float]) -> float:
        return sum(values) / len(values) if values else 0.0

    @staticmethod
    def _std(values: list[float]) -> float:
        if len(values) < 2:
            return 0.0
        avg = sum(values) / len(values)
        variance = sum((v - avg) ** 2 for v in values) / len(values)
        return math.sqrt(variance)

    @staticmethod
    def _trend(values: list[float]) -> str:
        """Compare first-half average vs second-half average."""
        if len(values) < 2:
            return "STABLE"
        mid = len(values) // 2
        first_half = sum(values[:mid]) / mid
        second_half = sum(values[mid:]) / (len(values) - mid)
        diff = second_half - first_half
        if diff > 5:
            return "RISING"
        elif diff < -5:
            return "FALLING"
        return "STABLE"

    @staticmethod
    def _consecutive_high(values: list[float], threshold: float = 85.0) -> int:
        """Count the longest streak of consecutive values above threshold (from the end)."""
        count = 0
        for v in reversed(values):
            if v >= threshold:
                count += 1
            else:
                break
        return count

    @staticmethod
    def _anomaly_score(
        avg_cpu: float,
        max_cpu: float,
        std_cpu: float,
        spike_detected: bool,
        consecutive_high: int,
        current_cpu: float,
    ) -> float:
        """Compute a 0.0 – 1.0 anomaly score from multiple signals."""
        score = 0.0

        # High current CPU contributes up to 0.3
        if current_cpu >= 90:
            score += 0.30
        elif current_cpu >= 80:
            score += 0.20
        elif current_cpu >= 70:
            score += 0.10

        # Spike detection contributes 0.2
        if spike_detected:
            score += 0.20

        # High standard deviation (volatile) → up to 0.15
        if std_cpu > 20:
            score += 0.15
        elif std_cpu > 10:
            score += 0.08

        # Sustained high readings → up to 0.25
        if consecutive_high >= 5:
            score += 0.25
        elif consecutive_high >= 3:
            score += 0.15
        elif consecutive_high >= 1:
            score += 0.05

        # Max CPU very high → up to 0.1
        if max_cpu >= 95:
            score += 0.10
        elif max_cpu >= 85:
            score += 0.05

        return round(min(score, 1.0), 2)

    @staticmethod
    def _anomaly_level(score: float) -> str:
        if score >= 0.8:
            return "CRITICAL"
        if score >= 0.5:
            return "HIGH"
        if score >= 0.3:
            return "MEDIUM"
        return "LOW"

    # ── Fallback when no history provided ─────────────────────────────────

    @staticmethod
    def _from_current(cpu: float, ram: float) -> dict:
        """Build a minimal analysis from the current snapshot only."""
        anomaly = 0.0
        if cpu >= 90:
            anomaly = 0.7
        elif cpu >= 80:
            anomaly = 0.5
        elif cpu >= 70:
            anomaly = 0.3

        level = "CRITICAL" if anomaly >= 0.8 else "HIGH" if anomaly >= 0.5 else "MEDIUM" if anomaly >= 0.3 else "LOW"

        return {
            "avg_cpu": cpu,
            "max_cpu": cpu,
            "avg_ram": ram,
            "max_ram": ram,
            "cpu_trend": "STABLE",
            "ram_trend": "STABLE",
            "spike_detected": False,
            "spike_magnitude": 0.0,
            "consecutive_high_readings": 0,
            "anomaly_score": anomaly,
            "anomaly_level": level,
            "rate_of_change_cpu": 0.0,
            "rate_of_change_ram": 0.0,
            "readings_count": 0,
            "analysis_method": "statistical",
            "fallback": True,
        }
