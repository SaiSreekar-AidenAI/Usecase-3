import asyncio
import logging

from google import genai
from google.genai import types

from .config import get_settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def init_client() -> None:
    global _client
    settings = get_settings()
    _client = genai.Client(
        vertexai=True,
        project=settings.gcp_project_id,
        location=settings.embedding_location,
    )


def _parse_delimited(text: str) -> tuple[str, str]:
    """Parse response and reasoning from delimiter-formatted output."""
    response_part = text
    reasoning_part = ""

    if "---RESPONSE---" in text:
        after_response = text.split("---RESPONSE---", 1)[1]
        if "---REASONING---" in after_response:
            response_part = after_response.split("---REASONING---", 1)[0].strip()
            reasoning_part = after_response.split("---REASONING---", 1)[1].strip()
        else:
            response_part = after_response.strip()
    elif "---REASONING---" in text:
        response_part = text.split("---REASONING---", 1)[0].strip()
        reasoning_part = text.split("---REASONING---", 1)[1].strip()

    return response_part, reasoning_part


def _generate_sync(system_prompt: str, context: str, query: str) -> tuple[str, str, dict]:
    settings = get_settings()

    user_message = f"{context}\n\nCustomer Query:\n{query}"

    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        thinking_config=types.ThinkingConfig(thinking_budget=2048),
    )

    result = _client.models.generate_content(
        model=settings.gemini_model,
        contents=user_message,
        config=config,
    )

    # Extract token usage metadata
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "thinking_tokens": 0}
    if hasattr(result, "usage_metadata") and result.usage_metadata:
        um = result.usage_metadata
        usage["prompt_tokens"] = getattr(um, "prompt_token_count", 0) or 0
        usage["completion_tokens"] = getattr(um, "candidates_token_count", 0) or 0
        usage["total_tokens"] = getattr(um, "total_token_count", 0) or 0
        usage["thinking_tokens"] = getattr(um, "thoughts_token_count", 0) or 0

    # Extract thinking parts as fallback reasoning
    thinking_text = ""
    response_text = ""
    for part in result.candidates[0].content.parts:
        if part.thought:
            thinking_text += part.text + "\n"
        else:
            response_text += part.text

    # Parse delimited output
    response, reasoning = _parse_delimited(response_text)

    # Use thinking as fallback if no delimiter-based reasoning
    if not reasoning and thinking_text:
        reasoning = thinking_text.strip()

    return response, reasoning, usage


async def generate(system_prompt: str, context: str, query: str) -> tuple[str, str, dict]:
    return await asyncio.to_thread(_generate_sync, system_prompt, context, query)
