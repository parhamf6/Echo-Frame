from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db_session, get_current_admin
from app.schemas.room import RoomResponse, RoomStatus
from app.services import room_service
from app.models.room import Room

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

    return {"detail": "Room closing", "ended_at": room.ended_at}
