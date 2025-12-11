import redis.asyncio as redis
from typing import Optional
from app.core.config import settings
import logging
import json

logger = logging.getLogger(__name__)

class RedisClient:
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.pool: Optional[redis.ConnectionPool] = None
    
    async def connect(self):
        try:
            self.pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=20 if settings.is_production else 10,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
            )
            
            self.redis = redis.Redis(connection_pool=self.pool)
            await self.redis.ping()
            logger.info("Redis connected successfully")
            
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            if settings.is_production:
                raise
            else:
                logger.warning("Running without Redis in development mode")
    
    async def disconnect(self):
        if self.redis:
            await self.redis.close()
        if self.pool:
            await self.pool.disconnect()
        logger.info("Redis disconnected")
    
    async def get(self, key: str) -> Optional[str]:
        if not self.redis:
            return None
        try:
            return await self.redis.get(key)
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return None
    
    async def set(self, key: str, value: str, expire: Optional[int] = None):
        if not self.redis:
            return
        try:
            await self.redis.set(key, value, ex=expire)
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
    
    async def delete(self, key: str):
        if not self.redis:
            return
        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
    
    async def exists(self, key: str) -> bool:
        if not self.redis:
            return False
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis EXISTS error: {e}")
            return False
    
    async def get_video_state(self, room_id: str) -> dict:
        """Get video state from Redis"""
        state_json = await self.get(f"video_state:{room_id}")
        if state_json:
            return json.loads(state_json)
        return {}
    
    async def set_video_state(self, room_id: str, state: dict, expire: int = 3600):
        """Set video state in Redis"""
        await self.set(f"video_state:{room_id}", json.dumps(state), expire=expire)

redis_client = RedisClient()