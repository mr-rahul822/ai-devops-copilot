"""
src/agents/ — Multi-Agent Orchestration System (Phase 5).

Four specialised agents run in a pipeline:
  1. LogAnalyzerAgent     — regex pre-filter + LLM semantic analysis  ┐ parallel
  2. MetricsAnalyzerAgent — statistical analysis on time-series       ┘
  3. DecisionAgent        — synthesises findings via Claude API (LLM)   sequential
  4. ExecutorAgent         — prepares a safe action plan                sequential

The pipeline is coordinated by AgentOrchestrator.
"""

from src.agents.log_analyzer_agent import LogAnalyzerAgent
from src.agents.metrics_analyzer_agent import MetricsAnalyzerAgent
from src.agents.decision_agent import DecisionAgent
from src.agents.executor_agent import ExecutorAgent
from src.agents.orchestrator import AgentOrchestrator

__all__ = [
    "LogAnalyzerAgent",
    "MetricsAnalyzerAgent",
    "DecisionAgent",
    "ExecutorAgent",
    "AgentOrchestrator",
]
