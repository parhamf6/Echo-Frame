from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db_session
from app.core.livekit_service import LiveKitService
from app.models.admin import Admin
from app.models.guest import Guest, JoinStatus
from app.models.room import Room
from uuid import UUID

router = APIRouter(prefix="/rooms", tags=["livekit"])


class LiveKitTokenResponse(BaseModel):
    token: str
    room_name: str
    host: str


def _get_livekit_service() -> LiveKitService:
    return LiveKitService()


async def _ensure_room_exists(db: AsyncSession, room_id: str) -> Room:
    try:
        room_uuid = UUID(room_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid room_id format")

    result = await db.execute(select(Room).where(Room.id == room_uuid))
    room = result.scalar_one_or_none()
    if not room or not room.is_active:
        raise HTTPException(status_code=404, detail="Room not found or inactive")
    return room


async def _resolve_permissions(user, room_id: str, db: AsyncSession) -> dict:
    if isinstance(user, Admin):
        return {"can_chat": True, "can_voice": True, "role": "admin", "username": user.username}

    if not isinstance(user, Guest):
        raise HTTPException(status_code=401, detail="Not authenticated")

    if str(user.room_id) != room_id:
        raise HTTPException(status_code=403, detail="Access denied for this room")

    if user.join_status != JoinStatus.ACCEPTED or user.kicked:
        raise HTTPException(status_code=403, detail="Guest not allowed")

    perms = user.permissions_json or {}
    return {
        "can_chat": bool(perms.get("can_chat")),
        "can_voice": bool(perms.get("can_voice")),
        "role": user.role.value if hasattr(user, "role") else "viewer",
        "username": user.username,
    }


@router.post("/{room_id}/livekit/token", response_model=LiveKitTokenResponse)
async def create_livekit_token(
    room_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    await _ensure_room_exists(db, room_id)
    perms = await _resolve_permissions(current_user, room_id, db)

    if not perms["can_chat"] and not perms["can_voice"]:
        raise HTTPException(status_code=403, detail="No permissions for LiveKit")

    lk = _get_livekit_service()
    token = lk.generate_token(room_id, str(current_user.id), perms["username"], perms["can_voice"], perms["role"])
    return LiveKitTokenResponse(token=token, room_name=f"room_{room_id}", host=lk.host)

