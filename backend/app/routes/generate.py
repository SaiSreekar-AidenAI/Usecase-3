import logging

from fastapi import APIRouter, HTTPException

from ..config import get_settings
from ..models import GenerateRequest, GenerateResponse, RetrievedSource, ConversationResponse
from ..rag import build_rag_context
from ..prompts import build_prompt
from ..llm import generate
from ..database import save_conversation

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
async def generate_response(req: GenerateRequest):
    try:
        # 1. Semantic search for relevant canned responses
        sources = _search(req.query, n_results=3)

        # 2. Build RAG context
        context = build_rag_context(sources)

        # 3. Build system prompt
        system_prompt = build_prompt(req.customPrompt)

        # 4. Call Gemini
        response_text, reasoning = await generate(system_prompt, context, req.query)

        # 5. Save to database
        conv = await save_conversation(
            query=req.query,
            response=response_text,
            reasoning=reasoning,
            sources=sources,
            custom_prompt=req.customPrompt,
        )

        # 6. Return response
        return GenerateResponse(
            response=response_text,
            reasoning=reasoning,
            sources=[RetrievedSource(**s) for s in sources],
            conversation=ConversationResponse(**conv),
        )
    except Exception as e:
        logger.exception("Error generating response")
        raise HTTPException(status_code=500, detail=str(e))
