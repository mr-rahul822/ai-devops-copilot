"""
src/llm/client.py — Anthropic Claude API wrapper with retry + logging.
"""

import asyncio
import json
import logging
import re

import anthropic

from src.config import settings

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_RETRIES = 3


class ClaudeClient:
    """Async wrapper around the Anthropic Messages API."""

    def __init__(self):
        if not settings.anthropic_api_key:
            logger.warning("ANTHROPIC_API_KEY not set — LLM calls will fail.")
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    # ── Diagnosis call (expects JSON response) ───────────────────────────

    async def diagnose(self, system_prompt: str, user_message: str) -> dict:
        """
        Sends a diagnosis request to Claude and parses the JSON response.
        Handles markdown-wrapped JSON (```json ... ```) gracefully.
        Returns a parsed dict.
        """
        raw = await self._call(system_prompt, [{"role": "user", "content": user_message}])
        return self._parse_json(raw)

    # ── Chat call (returns plain text) ───────────────────────────────────

    async def chat(self, messages_history: list[dict], system_prompt: str) -> str:
        """
        Sends a multi-turn conversation to Claude.
        messages_history: list of {"role": "user"|"assistant", "content": "..."}
        Returns the assistant's reply as a plain string.
        """
        return await self._call(system_prompt, messages_history)

    # ── Internal: API call with exponential backoff retry ─────────────────

    async def _call(self, system: str, messages: list[dict]) -> str:
        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = await self._client.messages.create(
                    model=MODEL,
                    max_tokens=2048,
                    system=system,
                    messages=messages,
                )
                input_tokens = response.usage.input_tokens
                output_tokens = response.usage.output_tokens
                logger.info(
                    "Claude API called — input tokens: %d, output tokens: %d",
                    input_tokens,
                    output_tokens,
                )
                return response.content[0].text

            except anthropic.RateLimitError as exc:
                last_error = exc
                wait = 2 ** attempt
                logger.warning(
                    "Rate limited (attempt %d/%d). Retrying in %ds...",
                    attempt, MAX_RETRIES, wait,
                )
                await asyncio.sleep(wait)

            except anthropic.APIConnectionError as exc:
                last_error = exc
                wait = 2 ** attempt
                logger.warning(
                    "API connection error (attempt %d/%d): %s. Retrying in %ds...",
                    attempt, MAX_RETRIES, exc, wait,
                )
                await asyncio.sleep(wait)

        raise RuntimeError(f"Claude API failed after {MAX_RETRIES} retries: {last_error}")

    # ── Internal: robust JSON parser ─────────────────────────────────────

    @staticmethod
    def _parse_json(text: str) -> dict:
        """
        Parses JSON from Claude's response.
        Handles cases where Claude wraps JSON in ```json ... ``` code blocks.
        """
        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code block
        pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Last resort: find first { ... } block
        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except json.JSONDecodeError:
                pass

        logger.error("Failed to parse JSON from Claude response: %s", text[:200])
        return {
            "root_cause": "Unable to parse AI response",
            "simple_explanation": "The AI returned a non-JSON response. Please try again.",
            "fix_steps": ["Retry the diagnosis request"],
            "severity": "MEDIUM",
            "time_to_fix": "< 5 min",
            "confidence": 0.0,
            "similar_past_incident": None,
        }
