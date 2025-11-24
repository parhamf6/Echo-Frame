from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.auth import AdminLogin, TokenResponse, RefreshResponse
from app.api.deps import get_db_session, get_redis, get_current_admin
from app.services import auth_service
from app.core import security
from app.core.config import settings
from app.core.redis_client import RedisClient
from typing import Optional
from app.models.admin import Admin

router = APIRouter()


def _access_expires_seconds() -> int:
    return int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)


@router.post("/login", response_model=TokenResponse)
async def login(payload: AdminLogin, response: Response, db: AsyncSession = Depends(get_db_session), redis: RedisClient = Depends(get_redis)):
    admin = await auth_service.authenticate_admin(db, payload.username, payload.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Create access token
    access_token = security.create_access_token({"sub": str(admin.id)})

    # Create refresh token and store jti in redis
    refresh_token = await auth_service.create_and_store_refresh(redis, str(admin.id))

    # Set refresh token as secure HttpOnly cookie
    refresh_ttl = int(settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)
    secure_flag = not settings.DEBUG
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure_flag,
        samesite="lax",
        path="/",
        max_age=refresh_ttl,
        expires=refresh_ttl,
    )

    return TokenResponse(access_token=access_token, expires_in=_access_expires_seconds())


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(request: Request, response: Response, redis: RedisClient = Depends(get_redis)):
    refresh_token: Optional[str] = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    payload = security.decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    admin_id = payload.get("sub")
    jti = payload.get("jti")
    if not admin_id or not jti:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    valid = await auth_service.is_refresh_valid(redis, admin_id, jti)
    if not valid:
        raise HTTPException(status_code=401, detail="Refresh token revoked or expired")

    # Rotate refresh token: revoke old and create new
    await auth_service.revoke_refresh(redis, admin_id, jti)
    new_refresh = await auth_service.create_and_store_refresh(redis, admin_id)

    # Set new cookie
    refresh_ttl = int(settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)
    secure_flag = not settings.DEBUG
    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=secure_flag,
        samesite="lax",
        path="/",
        max_age=refresh_ttl,
        expires=refresh_ttl,
    )

    # Issue new access token
    access_token = security.create_access_token({"sub": admin_id})
    return RefreshResponse(access_token=access_token, expires_in=_access_expires_seconds())


@router.post("/logout")
async def logout(request: Request, response: Response, redis: RedisClient = Depends(get_redis)):
    refresh_token: Optional[str] = request.cookies.get("refresh_token")
    if refresh_token:
        payload = security.decode_token(refresh_token)
        if payload:
            admin_id = payload.get("sub")
            jti = payload.get("jti")
            if admin_id and jti:
                await auth_service.revoke_refresh(redis, admin_id, jti)

    # Clear cookie
    response.delete_cookie("refresh_token", path="/")
    return {"detail": "Logged out"}


@router.get("/me")
async def me(current_admin: Admin = Depends(get_current_admin)):
    """Protected endpoint to verify access token works. Returns basic admin info."""
    return {"id": str(current_admin.id), "username": current_admin.username, "created_at": current_admin.created_at}
