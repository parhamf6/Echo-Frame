from typing import AsyncGenerator
from app.core.database import get_db
from app.core.redis_client import redis_client
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from app.core import security
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.admin import Admin
from typing import Optional


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
