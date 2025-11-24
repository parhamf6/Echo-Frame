from fastapi import FastAPI,Depends
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db, async_engine
from app.core.redis_client import redis_client
from app.api.v1 import auth as auth_router
from app.core.database import init_db, close_db


app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)


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


@app.get("/")
async def root():
    return {"message": "EchoFrame API", "status": "running"}


