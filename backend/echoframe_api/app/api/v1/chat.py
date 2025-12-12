import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, get_redis
from app.core.redis_chat import RedisChatService
from app.models.admin import Admin
from app.models.guest import Guest, JoinStatus
from app.models.room import Room
from app.core.redis_client import RedisClient


router = APIRouter(prefix="/rooms", tags=["chat"])


class ChatMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    reply_to_id: Optional[str] = None


class ChatHistoryResponse(BaseModel):
    messages: list[dict]
    reactions: Dict[str, Dict[str, list[str]]]


class ChatSendResponse(BaseModel):
    id: str
    timestamp: str


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_room_or_404(db: AsyncSession, room_id: str) -> Room:
    try:
        room_uuid = uuid.UUID(room_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid room_id format")

    result = await db.execute(select(Room).where(Room.id == room_uuid))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


async def _ensure_room_access(room_id: str, current_user, db: AsyncSession) -> None:
    await _get_room_or_404(db, room_id)

    if isinstance(current_user, Admin):
        return

    if not isinstance(current_user, Guest):
        raise HTTPException(status_code=401, detail="Not authenticated")

    if str(current_user.room_id) != room_id:
        raise HTTPException(status_code=403, detail="Access denied for this room")

    if current_user.join_status != JoinStatus.ACCEPTED or current_user.kicked:
        raise HTTPException(status_code=403, detail="Guest is not allowed in this room")


def _check_can_chat(user) -> None:
    if isinstance(user, Admin):
        return
    if isinstance(user, Guest):
        perms = user.permissions_json or {}
        if perms.get("can_chat"):
            return
    raise HTTPException(status_code=403, detail="Chat permission required")


def _build_message_payload(user, payload: ChatMessageCreate) -> dict:
    user_id = str(user.id)
    username = getattr(user, "username", "User")
    return {
        "id": f"msg_{uuid.uuid4()}",
        "user_id": user_id,
        "username": username,
        "message": payload.message,
        "timestamp": _iso_now(),
        "reply_to_id": payload.reply_to_id,
    }


def _get_chat_service(redis: RedisClient) -> RedisChatService:
    return RedisChatService(redis)


@router.get("/{room_id}/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    room_id: str,
    limit: int = 200,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: RedisClient = Depends(get_redis),
):
    """Fetch the last 200 messages (with reactions) for a room."""
    await _ensure_room_access(room_id, current_user, db)

    chat_service = _get_chat_service(redis)
    messages = await chat_service.get_messages(room_id, limit=limit)

    reactions: Dict[str, Dict[str, list[str]]] = {}
    for msg in messages:
        msg_id = msg.get("id")
        if not msg_id:
            continue
        reactions[msg_id] = await chat_service.get_reactions(room_id, msg_id)

    return ChatHistoryResponse(messages=messages, reactions=reactions)


@router.post("/{room_id}/chat/message", response_model=ChatSendResponse)
async def send_chat_message(
    room_id: str,
    payload: ChatMessageCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    redis: RedisClient = Depends(get_redis),
):
    """Fallback HTTP endpoint to store a chat message (primary path is LiveKit data channel)."""
    await _ensure_room_access(room_id, current_user, db)
    _check_can_chat(current_user)

    chat_service = _get_chat_service(redis)
    message = _build_message_payload(current_user, payload)
    await chat_service.add_message(room_id, message)

    return ChatSendResponse(id=message["id"], timestamp=message["timestamp"])

