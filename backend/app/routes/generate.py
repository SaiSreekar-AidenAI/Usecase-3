import hashlib
import json
import logging
import time
import uuid
from difflib import SequenceMatcher

from fastapi import APIRouter, HTTPException, Request

from ..audit.emitter import emit_generate
from ..config import get_settings
from ..database import (
    save_conversation, save_token_usage,
    get_cache_by_hash, get_all_active_cache_entries,
    update_cache_hit, save_cache_entry,
)
from ..llm import generate
from ..models import GenerateRequest, GenerateResponse, RetrievedSource, ConversationResponse
from ..prompts import build_prompt
from ..rag import build_rag_context

logger = logging.getLogger(__name__)

router = APIRouter()


def _search(query: str, n_results: int = 3) -> list[dict]:
    from ..vector_store import search_canned_responses
    return search_canned_responses(query, n_results=n_results)


def _normalize_query(query: str) -> str:
    return query.strip().lower()


def _hash_query(normalized: str) -> str:
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _find_similar_cache(
    normalized: str, entries: list[dict], threshold: float = 0.9
) -> dict | None:
    best_match = None
    best_ratio = 0.0
    for entry in entries:
        ratio = SequenceMatcher(None, normalized, entry["query_text"]).ratio()
        if ratio >= threshold and ratio > best_ratio:
            best_ratio = ratio
            best_match = entry
    return best_match


@router.post("/api/generate", response_model=GenerateResponse)
async def generate_response(req: GenerateRequest, request: Request):
    try:
        user = request.state.user
        settings = get_settings()

        # ── Cache check ─────────────────────────────────────
        normalized = _normalize_query(req.query)
        query_hash = _hash_query(normalized)

        cache_hit = await get_cache_by_hash(query_hash)

        if not cache_hit:
            all_entries = await get_all_active_cache_entries()
            cache_hit = _find_similar_cache(normalized, all_entries)

        if cache_hit:
            await update_cache_hit(cache_hit["id"])

            sources = json.loads(cache_hit["sources_json"]) if cache_hit["sources_json"] else []
            response_text = cache_hit["response"]
            reasoning = cache_hit["reasoning"]

            conv = await save_conversation(
                query=req.query,
                response=response_text,
                reasoning=reasoning,
                sources=sources,
                custom_prompt=req.customPrompt,
                user_id=user["id"],
            )

            await emit_generate(user, request, conv["id"], None)

            return GenerateResponse(
                response=response_text,
                reasoning=reasoning,
                sources=[RetrievedSource(**s) for s in sources],
                conversation=ConversationResponse(**conv),
            )

        # ── Cache miss — full RAG + LLM pipeline ───────────
        # 1. Semantic search for relevant canned responses
        sources = _search(req.query, n_results=3)

        # 2. Build RAG context
        context = build_rag_context(sources)

        # 3. Build system prompt
        system_prompt = build_prompt(req.customPrompt)

        # 4. Call Gemini (with timing)
        start_time = time.time()
        response_text, reasoning, token_data = await generate(system_prompt, context, req.query)
        latency_ms = int((time.time() - start_time) * 1000)

        # 5. Save to database
        conv = await save_conversation(
            query=req.query,
            response=response_text,
            reasoning=reasoning,
            sources=sources,
            custom_prompt=req.customPrompt,
            user_id=user["id"],
        )

        # 6. Save to query cache
        await save_cache_entry(
            query_hash=query_hash,
            query_text=normalized,
            response=response_text,
            reasoning=reasoning,
            sources_json=json.dumps(sources),
        )

        # 7. Record token usage
        await save_token_usage({
            "id": f"tu-{uuid.uuid4().hex[:10]}",
            "user_id": user["id"],
            "user_email": user["email"],
            "conversation_id": conv["id"],
            "model": settings.gemini_model,
            "prompt_tokens": token_data.get("prompt_tokens", 0),
            "completion_tokens": token_data.get("completion_tokens", 0),
            "total_tokens": token_data.get("total_tokens", 0),
            "thinking_tokens": token_data.get("thinking_tokens", 0),
            "latency_ms": latency_ms,
            "timestamp": int(time.time() * 1000),
        })

        # 8. Emit audit event
        await emit_generate(user, request, conv["id"], token_data)

        # 9. Return response
        return GenerateResponse(
            response=response_text,
            reasoning=reasoning,
            sources=[RetrievedSource(**s) for s in sources],
            conversation=ConversationResponse(**conv),
        )
    except Exception as e:
        logger.exception("Error generating response")
        raise HTTPException(status_code=500, detail=str(e))
