import base64
import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.core.livekit_service import LiveKitService
from app.core.redis_chat import RedisChatService
from app.core.redis_client import RedisClient
from app.api.deps import get_redis
from app.models.guest import Guest, JoinStatus
from app.models.room import Room

router = APIRouter(tags=["livekit"])
logger = logging.getLogger(__name__)


def _get_livekit_service() -> LiveKitService:
    return LiveKitService()


async def _get_guest(db: AsyncSession, guest_id: str) -> Optional[Guest]:
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    return result.scalar_one_or_none()


async def _room_exists(db: AsyncSession, room_id: str) -> bool:
    try:
        import uuid

        room_uuid = uuid.UUID(room_id)
    except Exception:
        return False

    result = await db.execute(select(Room).where(Room.id == room_uuid))
    return result.scalar_one_or_none() is not None


def _decode_data(encoded: str) -> Dict[str, Any]:
    try:
        raw = base64.b64decode(encoded).decode("utf-8")
        return json.loads(raw)
    except Exception:
        return {}


def _extract_room_id(room_name: str) -> Optional[str]:
    if room_name.startswith("room_"):
        return room_name.replace("room_", "", 1)
    return None


def _guest_can_chat(guest: Guest) -> bool:
    perms = guest.permissions_json or {}
    return perms.get("can_chat", False)


@router.post("/livekit/webhook")
async def livekit_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session),
    redis: RedisClient = Depends(get_redis),
):
    lk = _get_livekit_service()
    secret = None
    if authorization and authorization.lower().startswith("bearer "):
        secret = authorization.split(" ", 1)[1].strip()

    if not lk.verify_webhook(secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event")
    if event != "data_received":
        return {"detail": "ignored"}

    data_encoded = payload.get("data")
    room_name = payload.get("room", {}).get("name") or payload.get("room", "")
    participant = payload.get("participant", {}) or {}
    identity = participant.get("identity")
    username = participant.get("name") or participant.get("identity") or "User"

    if not data_encoded or not room_name or not identity:
        raise HTTPException(status_code=400, detail="Missing required fields")

    room_id = _extract_room_id(room_name)
    if not room_id or not await _room_exists(db, room_id):
        raise HTTPException(status_code=404, detail="Room not found")

    guest = await _get_guest(db, identity)
    if not guest or guest.join_status != JoinStatus.ACCEPTED or guest.kicked:
        raise HTTPException(status_code=403, detail="Guest not allowed")

    data = _decode_data(data_encoded)
    msg_type = data.get("type")

    chat_service = RedisChatService(redis)

    if msg_type == "chat:message":
        if not _guest_can_chat(guest):
            raise HTTPException(status_code=403, detail="Chat disabled")

        reply_to_id = data.get("reply_to_id")
        message_payload = {
            "id": data.get("id") or f"msg_{guest.id}",
            "user_id": str(guest.id),
            "username": username,
            "message": data.get("message", ""),
            "timestamp": data.get("timestamp") or "",
            "reply_to_id": reply_to_id,
        }
        await chat_service.add_message(room_id, message_payload)
        await lk.send_data_message(room_id, {"type": "chat:message", **message_payload})
        return {"detail": "ok"}

    if msg_type == "chat:reaction":
        if not _guest_can_chat(guest):
            raise HTTPException(status_code=403, detail="Chat disabled")

        message_id = data.get("message_id")
        emoji = data.get("emoji")
        action = data.get("action")
        if not message_id or not emoji or action not in ("add", "remove"):
            raise HTTPException(status_code=400, detail="Invalid reaction payload")

        if action == "add":
            await chat_service.add_reaction(room_id, message_id, emoji, str(guest.id))
        else:
            await chat_service.remove_reaction(room_id, message_id, emoji, str(guest.id))

        await lk.send_data_message(
            room_id,
            {
                "type": "chat:reaction",
                "message_id": message_id,
                "emoji": emoji,
                "user_id": str(guest.id),
                "action": action,
            },
        )
        return {"detail": "ok"}

    if msg_type == "chat:typing":
        if not _guest_can_chat(guest):
            raise HTTPException(status_code=403, detail="Chat disabled")
        await lk.send_data_message(
            room_id,
            {
                "type": "chat:typing",
                "user_id": str(guest.id),
                "username": username,
            },
            reliable=False,
        )
        return {"detail": "ok"}

    return {"detail": "ignored"}

