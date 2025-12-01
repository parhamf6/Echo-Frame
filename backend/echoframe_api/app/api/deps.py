from typing import AsyncGenerator
from app.core.database import get_db
from app.core.redis_client import redis_client, RedisClient
from fastapi import Depends, HTTPException, Request, Response,Header
from fastapi.security import OAuth2PasswordBearer
from app.core import security
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.admin import Admin
from app.models.guest import Guest, GuestRole
from typing import Optional, Union
from app.models.guest import JoinStatus
from app.services import rate_limit_service
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.utils.ip import extract_client_ip
from app.services import ip_tracking_service



async def get_db_session() -> AsyncGenerator:
    """Dependency that yields a database session (alias for get_db)."""
    async for session in get_db():
        yield session


async def get_redis():
    """Dependency that yields the redis client instance."""
    # Ensure redis_client.redis is connected by startup event in main
    return redis_client


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_admin(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> Optional[Admin]:
    """Dependency that validates an access token and returns Admin object."""
    payload = security.decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid access token")

    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(Admin).where(Admin.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")

    return admin


async def rate_limit_dependency(request: Request, redis: RedisClient = Depends(get_redis)):
    """Rate limit dependency for auth endpoints (3 requests/hour per IP)."""
    # Extract client IP (respect X-Forwarded-For if present)
    ip = extract_client_ip(request)

    limited = await rate_limit_service.is_rate_limited(redis, ip, limit=settings.GUEST_RATE_LIMIT_PER_HOUR, period_seconds=settings.GUEST_RATE_PERIOD_SECONDS)
    # log the auth attempt for observability
    await ip_tracking_service.log_ip_event(redis, ip, event="auth_attempt")

    if limited:
        # Provide Retry-After header using TTL if available
        try:
            ttl = await redis.redis.ttl(f"{settings.RATE_LIMIT_KEY_PREFIX}:auth:{ip}")
            retry_after = ttl if ttl and ttl > 0 else settings.GUEST_RATE_PERIOD_SECONDS
        except Exception:
            retry_after = settings.GUEST_RATE_PERIOD_SECONDS

        raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": str(retry_after)})

    return None


async def guest_rate_limit(request: Request, response: Response, redis: RedisClient = Depends(get_redis)):
    """Guest-specific rate limit dependency.

    Usage: attach to guest endpoints: `async def join(..., _rl=Depends(guest_rate_limit)):`
    Defaults to IP-based limiting using `settings.GUEST_RATE_LIMIT_PER_HOUR`.
    To rate-limit by guest id instead, call `rate_limit_service.is_rate_limited`
    with the guest id as key (e.g., `rl:guest:{guest_id}`) from within your endpoint.
    """
    ip = extract_client_ip(request)
    limited = await rate_limit_service.is_rate_limited(redis, ip, limit=settings.GUEST_RATE_LIMIT_PER_HOUR, period_seconds=settings.GUEST_RATE_PERIOD_SECONDS)
    await ip_tracking_service.log_ip_event(redis, ip, event="guest_action")

    remaining = await rate_limit_service.get_remaining(redis, ip, limit=settings.GUEST_RATE_LIMIT_PER_HOUR, period_seconds=settings.GUEST_RATE_PERIOD_SECONDS)
    response.headers["X-RateLimit-Limit"] = str(settings.GUEST_RATE_LIMIT_PER_HOUR)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    if limited:
        try:
            ttl = await redis.redis.ttl(f"{settings.RATE_LIMIT_KEY_PREFIX}:auth:{ip}")
            retry_after = ttl if ttl and ttl > 0 else settings.GUEST_RATE_PERIOD_SECONDS
        except Exception:
            retry_after = settings.GUEST_RATE_PERIOD_SECONDS

        raise HTTPException(status_code=429, detail="Too many requests", headers={"Retry-After": str(retry_after)})

    return None

async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db_session)
) -> Union[Admin, Guest]:
    """
    Get current user (either Admin via Bearer token OR Guest via session token).
    Returns Admin or Guest object.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if it's a Bearer token (admin)
    if authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        payload = security.decode_token(token)
        if payload and payload.get("type") == "access":
            admin_id = payload.get("sub")
            result = await db.execute(select(Admin).where(Admin.id == admin_id))
            admin = result.scalar_one_or_none()
            if admin:
                return admin
    
    # Otherwise treat as guest session token
    # (You can enhance this to check Redis session:{token})
    result = await db.execute(select(Guest).where(Guest.session_token == authorization))
    guest = result.scalar_one_or_none()
    if guest and guest.join_status == JoinStatus.ACCEPTED and not guest.kicked:
        return guest
    
    raise HTTPException(status_code=401, detail="Invalid or expired token")


async def require_moderator_or_admin(
    current_user: Union[Admin, Guest] = Depends(get_current_user)
) -> Union[Admin, Guest]:
    """
    Ensure user is either Admin OR Moderator.
    """
    if isinstance(current_user, Admin):
        return current_user
    
    if isinstance(current_user, Guest) and current_user.role == GuestRole.MODERATOR:
        return current_user
    
    raise HTTPException(status_code=403, detail="Moderator or Admin access required")


async def require_admin_only(
    current_user: Union[Admin, Guest] = Depends(get_current_user)
) -> Admin:
    """
    Ensure user is Admin (not just moderator).
    """
    if not isinstance(current_user, Admin):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user