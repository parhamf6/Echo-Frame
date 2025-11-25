from fastapi import Response
from app.core.config import settings


def set_refresh_cookie(response: Response, token: str) -> None:
    """Set refresh token cookie using application settings.

    Cookie attributes:
    - HttpOnly: True
    - Secure: enabled when not in DEBUG
    - SameSite: from settings.REFRESH_COOKIE_SAMESITE
    - Path: '/'
    - Max-Age/Expires: based on REFRESH_TOKEN_EXPIRE_DAYS
    """
    refresh_ttl = int(settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)
    secure_flag = not settings.DEBUG

    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure_flag,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path="/",
        max_age=refresh_ttl,
        expires=refresh_ttl,
    )


def clear_refresh_cookie(response: Response) -> None:
    """Clear the refresh token cookie."""
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path="/")
