from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from app.services import conversation_service

router = APIRouter()

class ConversationCreate(BaseModel):
    lead_id: str = Field(..., description="Lead ID or unique lead identifier")
    date: str = Field(..., description="Date of the conversation in YYYY-MM-DD")
    conversation_type: str = Field(..., description="Type of conversation: Call, WhatsApp, Email, Meeting")
    message: str = Field(..., description="Conversation notes / message content")
    lead_key: Optional[str] = Field(None, description="Optional secondary company or lead key")
    author: Optional[str] = Field(None, description="Optional author / user who recorded the conversation")

@router.get("/")
def list_conversations(
    lead_id: Optional[str] = Query(None, description="Filter by Lead ID"),
    date: Optional[str] = Query(None, description="Filter by Date (YYYY-MM-DD)")
):
    try:
        return conversation_service.get_conversations(lead_id=lead_id, date=date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch conversations: {str(e)}")

@router.post("/")
def create_conversation(payload: ConversationCreate):
    if not payload.lead_id.strip():
        raise HTTPException(status_code=400, detail="lead_id cannot be empty")
    if not payload.date.strip():
        raise HTTPException(status_code=400, detail="date cannot be empty")
    if not payload.conversation_type.strip():
        raise HTTPException(status_code=400, detail="conversation_type cannot be empty")
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")

    try:
        created = conversation_service.add_conversation(
            lead_id=payload.lead_id,
            date=payload.date,
            conversation_type=payload.conversation_type,
            message=payload.message,
            lead_key=payload.lead_key,
            author=payload.author
        )
        return created
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save conversation: {str(e)}")

@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: int):
    try:
        success = conversation_service.delete_conversation(conversation_id)
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {"ok": True, "id": conversation_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete conversation: {str(e)}")
