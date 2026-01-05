"""
Chat API Endpoints - Modified to accept client-generated IDs
"""
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.redis_chat import redis_chat_service
from app.api.deps import get_current_user
from app.models.admin import Admin
from app.models.guest import Guest

router = APIRouter()


class SendMessageRequest(BaseModel):
    """Request body for sending a message"""
    message: str = Field(..., min_length=1, max_length=1000)
    reply_to_id: str | None = None
    message_id: str | None = None  # ← NEW: Accept pre-generated ID
    timestamp: str | None = None   # ← NEW: Accept pre-generated timestamp


class MessageResponse(BaseModel):
    """Single message response"""
    id: str
    user_id: str
    username: str
    message: str
    timestamp: str
    reply_to_id: str | None


class ChatHistoryResponse(BaseModel):
    """Chat history response with messages and reactions"""
    messages: List[MessageResponse]
    reactions: Dict[str, Dict[str, List[str]]]


@router.get(
    "/{room_id}/chat/history",
    response_model=ChatHistoryResponse,
    summary="Get chat history",
)
async def get_chat_history(
    room_id: str,
    current_user: Admin | Guest = Depends(get_current_user)
):
    """Get chat history for a room"""
    # Verify user has access
    if isinstance(current_user, Guest):
        if str(current_user.room_id) != room_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this room"
            )
    
    # Get messages and reactions
    messages = await redis_chat_service.get_messages(room_id, limit=200)
    message_ids = [msg["id"] for msg in messages]
    reactions = await redis_chat_service.get_all_reactions_for_room(room_id, message_ids)
    
    return ChatHistoryResponse(
        messages=messages,
        reactions=reactions
    )


@router.post(
    "/{room_id}/chat/message",
    response_model=MessageResponse,
    summary="Send/save chat message",
)
async def send_chat_message(
    room_id: str,
    request: SendMessageRequest,
    current_user: Admin | Guest = Depends(get_current_user)
):
    """
    Send/save a chat message
    
    This endpoint serves dual purpose:
    1. Fallback if LiveKit Data Channel fails
    2. Save messages to Redis for persistence (called by frontend after LiveKit send)
    """
    # Verify user has access
    if isinstance(current_user, Guest):
        if str(current_user.room_id) != room_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this room"
            )
        
        # Check chat permission
        if not current_user.permissions.get("can_chat", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to send messages"
            )
        
        user_id = str(current_user.id)
        username = current_user.username
    else:
        # Admin
        user_id = f"admin_{current_user.id}"
        username = current_user.username or "Admin"
    
    # ✅ Use client-provided ID and timestamp if available
    # This prevents duplicates when message is sent via LiveKit AND saved via API
    message_id = request.message_id
    timestamp = request.timestamp
    
    if timestamp:
        # Validate timestamp format
        try:
            datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            timestamp = None  # Invalid format, let Redis generate new one
    
    # Add message to Redis
    message_obj = await redis_chat_service.add_message(
        room_id=room_id,
        user_id=user_id,
        username=username,
        message=request.message,
        reply_to_id=request.reply_to_id,
        message_id=message_id,    # ← Pass the ID
        timestamp=timestamp,       # ← Pass the timestamp
    )
    
    if not message_obj:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store message"
        )
    
    return MessageResponse(**message_obj)