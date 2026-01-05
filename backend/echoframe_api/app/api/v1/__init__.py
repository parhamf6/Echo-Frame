from fastapi import APIRouter

from . import auth, guests, room, videos, chat, livekit, livekit_webhook

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(room.router, prefix="/room", tags=["room"])
api_router.include_router(guests.router, prefix="/guests", tags=["guests"])
api_router.include_router(videos.router, prefix="/videos", tags=["videos"])
api_router.include_router(chat.router, prefix="/rooms", tags=["chat"])
api_router.include_router(livekit.router, tags=["livekit"])
api_router.include_router(livekit_webhook.router, tags=["livekit"])


