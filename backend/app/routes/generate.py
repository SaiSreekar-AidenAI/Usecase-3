import logging
import time
import uuid

from fastapi import APIRouter, HTTPException, Request

from ..audit.emitter import emit_generate
from ..config import get_settings
from ..database import save_conversation, save_token_usage
from ..llm import generate
from ..models import GenerateRequest, GenerateResponse, RetrievedSource, ConversationResponse
from ..prompts import build_prompt
from ..rag import build_rag_context

logger = logging.getLogger(__name__)

router = APIRouter()


def _search(query: str, n_results: int = 3) -> list[dict]:
    settings = get_settings()
    if settings.is_local:
        from ..chroma import search_canned_responses
    else:
        from ..vector_store import search_canned_responses
    return search_canned_responses(query, n_results=n_results)


@router.post("/api/generate", response_model=GenerateResponse)
async def generate_response(req: GenerateRequest, request: Request):
    try:
        user = request.state.user
        settings = get_settings()

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
        )

        # 6. Record token usage
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

        # 7. Emit audit event
        await emit_generate(user, request, conv["id"], token_data)

        # 8. Return response
        return GenerateResponse(
            response=response_text,
            reasoning=reasoning,
            sources=[RetrievedSource(**s) for s in sources],
            conversation=ConversationResponse(**conv),
        )
    except Exception as e:
        logger.exception("Error generating response")
        raise HTTPException(status_code=500, detail=str(e))
