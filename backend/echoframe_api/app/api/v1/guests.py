from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas.guest import GuestJoinRequest, GuestJoinResponse, GuestResponse, GuestStatusResponse
from app.api.deps import get_db_session, get_redis, get_current_admin, get_current_user, require_moderator_or_admin,require_admin_only
from app.services import guest_service
from app.utils.ip import extract_client_ip
from app.core.redis_client import RedisClient
from app.schemas.guest import PermissionUpdate, PermissionResponse
from app.models.guest import Guest, JoinStatus
from typing import List, Optional
from app.core.socketio_manager import (
    emit_permission_changed,
    emit_user_kicked,
    emit_user_list_updated,
    emit_join_request
)

router = APIRouter()


@router.post("/join", response_model=GuestJoinResponse)
async def join_guest(request: Request, payload: GuestJoinRequest, db: AsyncSession = Depends(get_db_session), redis: RedisClient = Depends(get_redis)):
    """Guest join endpoint.

    Frontend should POST JSON: 
    { 
        "room_id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "alice", 
        "fingerprint": "abc123def456ghi789" 
    }
    
    The server extracts client IP and creates a pending guest. Returns a session token
    which the frontend keeps in memory (or in a secure cookie) for subsequent requests.

    Best practices:
    - Call GET /api/v1/room/status first to get available room_id
    - Validate username on client and server (length, disallowed chars)
    - Keep session token short-lived in Redis and rotate on refresh
    - Send minimal info back to the client
    """
    ip = extract_client_ip(request)

    try:
        res = await guest_service.join_guest(db, payload.room_id, payload.username, payload.fingerprint, ip, redis)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return GuestJoinResponse(guest_id=res["guest_id"], session_token=res["session_token"], note="pending approval")


@router.get("/pending", response_model=List[GuestResponse])
async def list_pending_guests(room_id: Optional[str] = None, limit: int = 50, admin=Depends(get_current_admin), db: AsyncSession = Depends(get_db_session)):
    """List pending guest join requests (admin only).

    Optional query params:
    - `room_id`: filter by room UUID
    - `limit`: maximum rows to return (default 50)
    """
    guests = await guest_service.get_pending_guests(db, room_id=room_id, limit=limit)
    return [GuestResponse(id=str(g.id), room_id=str(g.room_id), username=g.username, join_status=g.join_status.value, role=g.role.value, kicked=g.kicked, created_at=str(g.created_at)) for g in guests]


@router.get("/list", response_model=List[GuestResponse])
async def list_guests(
    room_id: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db_session)
):
    """List all active guests in a room (accepted, not kicked).
    
    Public endpoint - no auth required so viewers can see the list.
    Frontend will handle UI permissions (disable buttons for viewers).
    
    Query params:
    - room_id: filter by room UUID
    - limit: maximum rows to return (default 50)
    """
    if not room_id:
        raise HTTPException(status_code=400, detail="room_id is required")
    
    from uuid import UUID as PYUUID
    try:
        room_uuid = PYUUID(room_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid room_id format")
    
    result = await db.execute(
        select(Guest).where(
            Guest.room_id == room_uuid,
            Guest.join_status == JoinStatus.ACCEPTED,
            Guest.kicked == False
        ).order_by(Guest.created_at)
    )
    guests = result.scalars().all()
    
    return [
        GuestResponse(
            id=str(g.id),
            room_id=str(g.room_id),
            username=g.username,
            join_status=g.join_status.value,
            role=g.role.value,
            kicked=g.kicked,
            created_at=str(g.created_at),
            permissions=g.permissions_json  # ✅ Include permissions
        )
        for g in guests
    ]


@router.post("/session/refresh")
async def refresh_session(payload: dict, db: AsyncSession = Depends(get_db_session), redis: RedisClient = Depends(get_redis)):
    """Session refresh endpoint.

    Accepts JSON: { "session_token": "...", "fingerprint": "..." }
    Validates session exists, fingerprint matches, guest is accepted and not kicked.
    On success, refreshes the Redis TTL for the session and returns success.
    """
    token = payload.get("session_token")
    provided_fp = payload.get("fingerprint")
    if not token or not provided_fp:
        raise HTTPException(status_code=400, detail="Missing session_token or fingerprint")

    key = f"session:{token}"
    raw = await redis.get(key)
    if not raw:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    try:
        guest_id, stored_fp, stored_ip = raw.split("|")
    except Exception:
        raise HTTPException(status_code=500, detail="Malformed session data")

    # fingerprint must match
    if stored_fp != provided_fp:
        raise HTTPException(status_code=401, detail="Fingerprint mismatch")

    # check guest state
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest or guest.join_status != JoinStatus.ACCEPTED or guest.kicked:
        raise HTTPException(status_code=401, detail="Invalid guest state")

    # refresh TTL
    await redis.set(key, raw, expire=24 * 3600)
    return {"detail": "session refreshed"}


@router.patch("/{guest_id}/accept", response_model=GuestResponse)
async def accept_guest(guest_id: str, current_user=Depends(require_moderator_or_admin), db: AsyncSession = Depends(get_db_session)):
    guest = await guest_service.accept_guest(db, guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    await emit_user_list_updated(str(guest.room_id))

    return GuestResponse(id=str(guest.id), room_id=str(guest.room_id), username=guest.username, join_status=guest.join_status.value, role=guest.role.value, kicked=guest.kicked, created_at=str(guest.created_at))


@router.patch("/{guest_id}/reject", response_model=GuestResponse)
async def reject_guest(guest_id: str, admin=Depends(get_current_admin), db: AsyncSession = Depends(get_db_session)):
    guest = await guest_service.reject_guest(db, guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    return GuestResponse(id=str(guest.id), room_id=str(guest.room_id), username=guest.username, join_status=guest.join_status.value, role=guest.role.value, kicked=guest.kicked, created_at=str(guest.created_at))


@router.patch("/{guest_id}/permissions", response_model=PermissionResponse)
async def update_permissions(guest_id: str, payload: PermissionUpdate, current_user=Depends(require_moderator_or_admin), db: AsyncSession = Depends(get_db_session)):
    """Update guest permissions (admin/moderator).

    Frontend usage: PATCH with JSON body `{ "can_chat": true, "can_voice": false }`.
    Best practice: UI should reflect permission changes in real-time (WebSocket events).
    """
    perms = {k: v for k, v in payload.dict().items() if v is not None}
    if not perms:
        raise HTTPException(status_code=400, detail="No permissions provided")

    guest = await guest_service.update_permissions(db, guest_id, perms)
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    await emit_permission_changed(str(guest.room_id), guest_id, perms)

    return PermissionResponse(guest_id=str(guest.id), permissions=guest.permissions_json)


@router.patch("/{guest_id}/promote", response_model=GuestResponse)
async def promote_guest(guest_id: str, admin=Depends(require_admin_only), db: AsyncSession = Depends(get_db_session)):
    """Promote guest to moderator (admin only).

    Frontend: call when admin clicks "Promote". Consider notifying the promoted user via socket.
    """
    guest = await guest_service.promote_guest(db, guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    return GuestResponse(id=str(guest.id), room_id=str(guest.room_id), username=guest.username, join_status=guest.join_status.value, role=guest.role.value, kicked=guest.kicked, created_at=str(guest.created_at))


@router.delete("/{guest_id}")
async def kick_guest(guest_id: str, current_user=Depends(require_moderator_or_admin), db: AsyncSession = Depends(get_db_session), redis: RedisClient = Depends(get_redis)):
    """Kick a guest (admin/moderator).

    This will set `kicked=true` and ban the guest's IP and fingerprint until the room ends.
    """
    guest = await guest_service.kick_guest(db, guest_id, redis)
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    await emit_user_kicked(str(guest.room_id), guest_id)
    await emit_user_list_updated(str(guest.room_id))

    return {"detail": "Guest kicked and banned until room end"}


@router.get("/{guest_id}", response_model=GuestStatusResponse)
async def get_guest_status(guest_id: str, db: AsyncSession = Depends(get_db_session)):
    """Get minimal guest status for polling by the frontend.

    Returns the guest's `join_status`, `kicked`, `role`, and `permissions`.
    """
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    return GuestStatusResponse(
        guest_id=str(guest.id),
        join_status=guest.join_status.value,
        kicked=guest.kicked,
        role=guest.role.value,
        permissions=guest.permissions_json,
    )