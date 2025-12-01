import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db_session, get_current_admin, get_redis
from app.schemas.room import RoomResponse, RoomStatus
from app.services import room_service
from app.models.room import Room
from app.models.guest import Guest, GuestRole, JoinStatus
from app.models.admin import Admin
from app.schemas.guest import GuestJoinRequest, GuestJoinResponse, GuestResponse, GuestStatusResponse
from app.core.redis_client import RedisClient
from app.utils.ip import extract_client_ip
from app.core.socketio_manager import emit_room_closed

router = APIRouter()


@router.post("/", response_model=RoomResponse)
async def create_room(admin=Depends(get_current_admin), db: AsyncSession = Depends(get_db_session)):
    """Create a single active room (admin only)."""
    try:
        room = await room_service.create_room(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return RoomResponse(id=str(room.id), is_active=room.is_active, created_at=room.created_at, ended_at=room.ended_at)


@router.get("/status", response_model=RoomStatus)
async def room_status(db: AsyncSession = Depends(get_db_session)):
    """Return current room status (is_active, current users count, created/ended times, room_id).
    
    Public endpoint - guests call this to get available room_id before joining.
    """
    status = await room_service.get_room_status(db)
    if not status:
        # No room exists yet
        return RoomStatus(id=None, is_active=False, current_users_count=0, created_at=None, ended_at=None)

    return RoomStatus(**status)


@router.delete("/{room_id}")
async def close_room(room_id: str, admin=Depends(get_current_admin), db: AsyncSession = Depends(get_db_session)):
    """Close a room (admin only). Starts a countdown (default 60s) and marks room as closing."""
    room = await room_service.close_room(db, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Persist changes
    await db.commit()
    await db.refresh(room)

    # Notify all connected users via Socket.IO
    await emit_room_closed(str(room.id))

    return {"detail": "Room closing", "ended_at": room.ended_at}


@router.get("/{room_id}/admin-join", response_model=GuestJoinResponse)
async def admin_join_room(
    room_id: str,
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
    redis: RedisClient = Depends(get_redis)
):
    """Admin bypass join request - instant access."""
    from uuid import UUID as PYUUID
    try:
        room_uuid = PYUUID(room_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid room_id format")
    
    # Verify room exists and is active
    result = await db.execute(select(Room).where(Room.id == room_uuid))
    room = result.scalar_one_or_none()
    if not room or not room.is_active:
        raise HTTPException(status_code=404, detail="Room not found or not active")
    
    # Check if admin already joined
    result = await db.execute(
        select(Guest).where(
            Guest.room_id == room_uuid,
            Guest.username == admin.username
        )
    )
    existing_guest = result.scalar_one_or_none()
    if existing_guest:
        return GuestJoinResponse(
            guest_id=str(existing_guest.id),
            session_token=existing_guest.session_token,
            note="already joined"
        )
    
    # Create admin guest record
    ip = extract_client_ip(request)
    session_token = secrets.token_urlsafe(32)
    
    guest = Guest(
        room_id=room.id,
        username=admin.username,
        session_token=session_token,
        fingerprint=f"admin-{admin.id}",  # Admin doesn't need real fingerprint
        ip_address=ip,
        role=GuestRole.MODERATOR,  # Give admin moderator powers in room
        join_status=JoinStatus.ACCEPTED,
        permissions_json={"can_chat": True, "can_voice": True}
    )
    
    db.add(guest)
    await db.flush()
    await db.refresh(guest)
    
    # Store session in Redis
    key = f"session:{session_token}"
    value = f"{guest.id}|admin-{admin.id}|{ip}"
    await redis.set(key, value, expire=24 * 3600)
    
    return GuestJoinResponse(
        guest_id=str(guest.id),
        session_token=session_token,
        note="admin auto-accepted"
    )