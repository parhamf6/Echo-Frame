from fastapi import FastAPI,Depends
from app.core.config import settings
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db, async_engine
from app.core.redis_client import redis_client
from app.api.v1 import auth as auth_router
from app.api.v1 import room as room_router
from app.core.database import init_db, close_db


app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,  # Critical for HTTP-only cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # Connect to Redis
    await redis_client.connect()
    # Initialize DB in development (no-op in production if using migrations)
    await init_db()


@app.on_event("shutdown")
async def shutdown():
    await redis_client.disconnect()
    await close_db()


app.include_router(auth_router.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(room_router.router, prefix="/api/v1/room", tags=["room"])
from app.api.v1 import guests as guests_router
app.include_router(guests_router.router, prefix="/api/v1/guests", tags=["guests"])


@app.get("/")
async def root():
    return {"message": "EchoFrame API", "status": "running"}


