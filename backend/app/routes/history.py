from fastapi import APIRouter, HTTPException

from ..models import ConversationResponse, UpdateConversationRequest
from ..database import get_all_conversations, update_conversation_response, delete_conversation, delete_all_conversations

router = APIRouter()


@router.get("/api/history", response_model=list[ConversationResponse])
async def get_history():
    rows = await get_all_conversations()
    return [ConversationResponse(**r) for r in rows]


@router.patch("/api/history/{conv_id}")
async def update_one(conv_id: str, req: UpdateConversationRequest):
    updated = await update_conversation_response(conv_id, req.response)
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"updated": True}


@router.delete("/api/history/{conv_id}")
async def delete_one(conv_id: str):
    deleted = await delete_conversation(conv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True}


@router.delete("/api/history")
async def clear_all():
    count = await delete_all_conversations()
    return {"deleted": count}
