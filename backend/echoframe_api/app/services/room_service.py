from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.room import Room
from app.models.guest import Guest, JoinStatus
from app.core.config import settings
from typing import Optional


async def create_room(db: AsyncSession) -> Room:
    """Create a single active room. Raises ValueError if an active room exists."""
    # Check if active room exists
    result = await db.execute(select(Room).where(Room.is_active == True))
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError("An active room already exists")

    room = Room()
    db.add(room)
    await db.flush()
    await db.refresh(room)
    return room


async def get_room_status(db: AsyncSession) -> Optional[dict]:
    """Return status for the (single) room if exists, otherwise None.
    
    Includes room_id so guests can use it to join.
    """
    result = await db.execute(select(Room).order_by(Room.created_at.desc()).limit(1))
    room = result.scalar_one_or_none()
    if not room:
        return None

    # count active guests: accepted and not kicked
    q = await db.execute(
        select(func.count(Guest.id)).where(
            Guest.room_id == room.id,
            Guest.join_status == JoinStatus.ACCEPTED,
            Guest.kicked == False,
        )
    )
    count = q.scalar() or 0

    return {
        "id": str(room.id),
        "is_active": room.is_active,
        "current_users_count": int(count),
        "created_at": room.created_at,
        "ended_at": room.ended_at,
    }


async def close_room(db: AsyncSession, room_id: str, countdown_seconds: int = 60) -> Optional[Room]:
    """Initiate room closure: set is_active=False and set ended_at to now+countdown_seconds.

    Returns updated room or None if not found.
    """
    result = await db.execute(select(Room).where(Room.id == room_id))
    room = result.scalar_one_or_none()
    if not room:
        return None

    room.is_active = False
    room.ended_at = datetime.utcnow() + timedelta(seconds=countdown_seconds)
    db.add(room)
    await db.flush()
    await db.refresh(room)
    return room
