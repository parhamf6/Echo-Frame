from fastapi import FastAPI,Depends
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db, async_engine
from app.core.redis_client import redis_client


app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)


@app.get("/")
async def root():
    return {
        "message": "EchoFrame API",
        "status": "running"
    }


