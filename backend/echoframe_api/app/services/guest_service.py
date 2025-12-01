import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.guest import Guest, JoinStatus, GuestRole
from app.models.room import Room
from app.core.config import settings
from app.core.redis_client import RedisClient
from typing import Optional
import secrets
from app.core.socketio_manager import emit_join_request


async def join_guest(db: AsyncSession, room_id: str, username: str, fingerprint: str, ip: str, redis: RedisClient) -> dict:
    """Create a pending guest record and generate a session token.

    - Validates that the room exists and is active.
    - Creates a `Guest` with `join_status = pending`.
    - Generates a secure random `session_token` stored both in DB and cached in Redis
      with associated fingerprint and ip for quick session lookup.

    Args:
        db: Database session
        room_id: UUID of the room to join (required)
        username: Guest's display name
        fingerprint: Browser/device fingerprint for abuse detection
        ip: Guest's IP address
        redis: Redis client for session storage and anti-abuse tracking

    Returns a dict with `guest_id` and `session_token`.
    
    Raises:
        ValueError: If room doesn't exist, is not active, or duplicate fingerprint detected
    """
    # verify room exists and is active
    from uuid import UUID as PYUUID
    try:
        room_uuid = PYUUID(room_id)
    except (ValueError, TypeError):
        raise ValueError("Invalid room_id format")
    
    result = await db.execute(select(Room).where(Room.id == room_uuid))
    room = result.scalar_one_or_none()
    if not room or not room.is_active:
        raise ValueError("Room not found or not active")

    # generate session token
    session_token = secrets.token_urlsafe(32)

    guest = Guest(
        room_id=room.id,
        username=username,
        session_token=session_token,
        fingerprint=fingerprint,
        ip_address=ip,
    )

    db.add(guest)
    await db.flush()
    await db.refresh(guest)

    # Store session info in Redis for quick validation: key session:{token} -> guest_id|fingerprint|ip
    key = f"session:{session_token}"
    value = f"{guest.id}|{fingerprint}|{ip}"
    # TTL should be reasonably long (e.g., 1 day) — adjust via settings if needed
    await redis.set(key, value, expire=24 * 3600)

    # Anti-abuse: track fingerprint -> IPs for the room
    try:
        from app.services.fingerprint_service import add_fingerprint_ip
        ip_count = await add_fingerprint_ip(redis, str(room.id), fingerprint, ip)
        # If fingerprint seen from multiple IPs, consider it suspicious
        if ip_count > 1:
            # mark as rejected and log event
            guest.join_status = JoinStatus.REJECTED
            db.add(guest)
            await db.flush()
            await db.refresh(guest)
            # Optionally, ban fingerprint globally for the room
            ban_key = f"ban:fp:{room.id}:{fingerprint}"
            await redis.set(ban_key, "1", expire=settings.GUEST_RATE_PERIOD_SECONDS)
            raise ValueError("Duplicate fingerprint detected from multiple IPs — possible abuse")
    except ValueError:
        raise
    except Exception:
        # Non-fatal: continue
        pass
    await emit_join_request(str(room.id), {
        'guest_id': str(guest.id),
        'username': username,
        'created_at': str(guest.created_at)
    })

    return {"guest_id": str(guest.id), "session_token": session_token}


async def accept_guest(db: AsyncSession, guest_id: str) -> Optional[Guest]:
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        return None
    guest.join_status = JoinStatus.ACCEPTED
    db.add(guest)
    await db.flush()
    await db.refresh(guest)
    return guest


async def reject_guest(db: AsyncSession, guest_id: str) -> Optional[Guest]:
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        return None
    guest.join_status = JoinStatus.REJECTED
    db.add(guest)
    await db.flush()
    await db.refresh(guest)
    return guest


async def kick_guest(db: AsyncSession, guest_id: str, redis: RedisClient) -> Optional[Guest]:
    """Kick a guest: set kicked=True and ban IP + fingerprint until room ends.

    Stores bans in Redis keys:
      - ban:ip:{room_id}:{ip}
      - ban:fp:{room_id}:{fingerprint}
    TTL is set to remaining room time if available, otherwise a sensible default.
    """
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        return None

    # mark kicked
    guest.kicked = True
    db.add(guest)
    await db.flush()
    await db.refresh(guest)

    # compute TTL until room end
    result_room = await db.execute(select(Room).where(Room.id == guest.room_id))
    room = result_room.scalar_one_or_none()
    ttl = None
    from datetime import datetime
    if room and room.ended_at:
        remaining = int((room.ended_at - datetime.utcnow()).total_seconds())
        ttl = max(0, remaining)

    ban_ttl = ttl if ttl and ttl > 0 else 24 * 3600

    # set ban keys in redis
    try:
        await redis.set(f"ban:ip:{guest.room_id}:{guest.ip_address}", "1", expire=ban_ttl)
        await redis.set(f"ban:fp:{guest.room_id}:{guest.fingerprint}", "1", expire=ban_ttl)
    except Exception:
        # best-effort: continue even if redis unavailable
        pass

    # log event via ip tracking if available
    try:
        from app.services.ip_tracking_service import log_ip_event
        await log_ip_event(redis, guest.ip_address, event=f"kicked:{guest.id}")
    except Exception:
        pass

    return guest


async def update_permissions(db: AsyncSession, guest_id: str, permissions: dict) -> Optional[Guest]:
    """Update permissions_json for a guest (admin/moderator action).
    
    Note: Moderators always have can_chat and can_voice set to True.
    This is enforced in the API endpoint before calling this function.
    """
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        return None
    # merge permissions - create a new dict to ensure SQLAlchemy detects the change
    current = dict(guest.permissions_json) if guest.permissions_json else {}
    current.update(permissions)
    
    # Ensure moderators always have can_chat and can_voice set to True
    if guest.role == GuestRole.MODERATOR:
        current["can_chat"] = True
        current["can_voice"] = True
    
    guest.permissions_json = current
    db.add(guest)
    await db.flush()
    await db.refresh(guest)
    return guest


async def promote_guest(db: AsyncSession, guest_id: str) -> Optional[Guest]:
    """Promote a guest to moderator (admin-only action).
    
    Also sets can_chat and can_voice permissions to True.
    """
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        return None
    guest.role = GuestRole.MODERATOR
    # Set permissions to True when promoting - create a new dict to ensure proper update
    current_perms = dict(guest.permissions_json) if guest.permissions_json else {}
    current_perms["can_chat"] = True
    current_perms["can_voice"] = True
    guest.permissions_json = current_perms
    db.add(guest)
    await db.flush()
    await db.refresh(guest)
    
    # Double-check permissions are set correctly after refresh
    if guest.permissions_json.get("can_chat") is not True or guest.permissions_json.get("can_voice") is not True:
        # Force set again if not properly saved
        guest.permissions_json = {"can_chat": True, "can_voice": True}
        db.add(guest)
        await db.flush()
        await db.refresh(guest)
    
    return guest


async def demote_guest(db: AsyncSession, guest_id: str) -> Optional[Guest]:
    """Demote a guest back to viewer. Admin-only action."""
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    guest = result.scalar_one_or_none()
    if not guest:
        return None
    
    guest.role = GuestRole.VIEWER
    # Reset permissions to safe defaults for viewers
    guest.permissions_json = {"can_chat": False, "can_voice": False}
    db.add(guest)
    await db.flush()
    await db.refresh(guest)
    return guest


async def get_pending_guests(db: AsyncSession, room_id: Optional[str] = None, limit: int = 50):
    """Return a list of pending Guest objects.

    Args:
        db: database session
        room_id: optional room UUID string to filter results
        limit: maximum number of rows to return

    Returns:
        list of Guest objects
    """
    q = select(Guest).where(Guest.join_status == JoinStatus.PENDING)
    if room_id:
        try:
            from uuid import UUID as PYUUID
            room_uuid = PYUUID(room_id)
            q = q.where(Guest.room_id == room_uuid)
        except Exception:
            # invalid UUID -> return empty list
            return []

    q = q.order_by(Guest.created_at.desc()).limit(limit)
    result = await db.execute(q)
    rows = result.scalars().all()
    return rows

async def get_guest_by_id(db: AsyncSession, guest_id: str) -> Optional[Guest]:
    """Get guest by ID."""
    result = await db.execute(select(Guest).where(Guest.id == guest_id))
    return result.scalar_one_or_none()