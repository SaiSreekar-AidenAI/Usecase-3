from fastapi import APIRouter, HTTPException, Request

from ..audit.emitter import emit_history_clear, emit_history_delete, emit_history_edit, emit_history_view
from ..database import get_all_conversations, update_conversation_response, delete_conversation, delete_all_conversations
from ..models import ConversationResponse, UpdateConversationRequest

router = APIRouter()


@router.get("/api/history", response_model=list[ConversationResponse])
async def get_history(request: Request):
    rows = await get_all_conversations()
    await emit_history_view(request.state.user, request)
    return [ConversationResponse(**r) for r in rows]


@router.patch("/api/history/{conv_id}")
async def update_one(conv_id: str, req: UpdateConversationRequest, request: Request):
    updated = await update_conversation_response(conv_id, req.response)
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await emit_history_edit(request.state.user, request, conv_id)
    return {"updated": True}


@router.delete("/api/history/{conv_id}")
async def delete_one(conv_id: str, request: Request):
    deleted = await delete_conversation(conv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await emit_history_delete(request.state.user, request, conv_id)
    return {"deleted": True}


@router.delete("/api/history")
async def clear_all(request: Request):
    count = await delete_all_conversations()
    await emit_history_clear(request.state.user, request, count)
    return {"deleted": count}
