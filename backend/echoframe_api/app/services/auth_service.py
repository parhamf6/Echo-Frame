import uuid
from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.admin import Admin
from app.core import security
from app.core.config import settings
from app.core.redis_client import RedisClient
from typing import Optional


async def authenticate_admin(db: AsyncSession, username: str, password: str) -> Optional[Admin]:
    """Verify admin credentials and return Admin or None."""
    result = await db.execute(select(Admin).where(Admin.username == username))
    admin = result.scalar_one_or_none()
    if not admin:
        return None

    if not security.verify_password(password, admin.hashed_password):
        return None

    return admin


def _refresh_ttl_seconds() -> int:
    return int(settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)


async def create_and_store_refresh(redis: RedisClient, admin_id: str) -> str:
    """Create a refresh token with a jti, store the jti in Redis and return token string."""
    jti = str(uuid.uuid4())
    payload = {"sub": admin_id, "jti": jti}
    token = security.create_refresh_token(payload)

    # Store key in redis for validation/rotation: refresh:{admin_id}:{jti} -> 1
    key = f"refresh:{admin_id}:{jti}"
    await redis.set(key, "1", expire=_refresh_ttl_seconds())
    return token


async def revoke_refresh(redis: RedisClient, admin_id: str, jti: str):
    key = f"refresh:{admin_id}:{jti}"
    await redis.delete(key)


async def is_refresh_valid(redis: RedisClient, admin_id: str, jti: str) -> bool:
    key = f"refresh:{admin_id}:{jti}"
    return await redis.exists(key)
