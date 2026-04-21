"""
src/llm/client.py — Gemini API wrapper using httpx via OpenAI compatibility layer.
Kept named as ClaudeClient to prevent breaking imports across the app.
"""

import asyncio
import json
import logging
import re

import httpx

from src.config import settings

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
MAX_RETRIES = 3

class ClaudeClient:
    """Async wrapper originally for Anthropic, now pointing to Gemini API."""

    def __init__(self):
        self.api_key = settings.anthropic_api_key  # Using the existing config variable
        if not self.api_key:
            logger.warning("API_KEY not set — LLM calls will fail.")
        
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

    # ── Diagnosis call (expects JSON response) ───────────────────────────

    async def diagnose(self, system_prompt: str, user_message: str) -> dict:
        """
        Sends a diagnosis request and parses the JSON response.
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
        raw = await self._call(messages)
        return self._parse_json(raw)

    # ── Chat call (returns plain text) ───────────────────────────────────

    async def chat(self, messages_history: list[dict], system_prompt: str) -> str:
        """
        Sends a multi-turn conversation.
        """
        messages = [{"role": "system", "content": system_prompt}] + messages_history
        return await self._call(messages)

    # ── Internal: API call with exponential backoff retry ─────────────────

    async def _call(self, messages: list[dict]) -> str:
        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": MODEL,
                    "messages": messages,
                    "max_tokens": 2048,
                    "temperature": 0.2
                }
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(self.base_url, headers=headers, json=payload)
                    resp.raise_for_status()
                    
                    data = resp.json()
                    
                    # Extract usage
                    usage = data.get("usage", {})
                    input_tokens = usage.get("prompt_tokens", 0)
                    output_tokens = usage.get("completion_tokens", 0)
                    logger.info(
                        "Gemini API called — input tokens: %d, output tokens: %d",
                        input_tokens,
                        output_tokens,
                    )
                    
                    return data["choices"][0]["message"]["content"]

            except httpx.HTTPStatusError as exc:
                last_error = f"HTTP {exc.response.status_code}: {exc.response.text}"
                logger.warning("API HTTP Error (attempt %d/%d): %s", attempt, MAX_RETRIES, last_error)
                if exc.response.status_code in [400, 401, 403, 404]:
                    # Don't retry client errors like "Invalid API Key"
                    break
            except Exception as exc:
                last_error = str(exc)
                logger.warning("API connection error (attempt %d/%d): %s", attempt, MAX_RETRIES, last_error)

            wait = 2 ** attempt
            logger.warning("Retrying in %ds...", wait)
            await asyncio.sleep(wait)

        raise RuntimeError(f"Gemini API failed after {attempt} attempts: {last_error}")

    # ── Internal: robust JSON parser ─────────────────────────────────────

    @staticmethod
    def _parse_json(text: str) -> dict:
        """
        Parses JSON from response.
        Handles cases where JSON is wrapped in ```json ... ``` code blocks.
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

        logger.error("Failed to parse JSON from AI response: %s", text[:200])
        return {
            "root_cause": "Unable to parse AI response",
            "simple_explanation": "The AI returned a non-JSON response. Please try again.",
            "fix_steps": ["Retry the diagnosis request"],
            "severity": "MEDIUM",
            "time_to_fix": "< 5 min",
            "confidence": 0.0,
            "similar_past_incident": None,
        }
