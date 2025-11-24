import redis.asyncio as redis
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

"""
Redis Client Configuration

🔒 PRODUCTION FEATURES:
1. Connection pooling for performance
2. Automatic reconnection on failure
3. Health checks
4. Proper cleanup on shutdown
"""

class RedisClient:
    """
    Async Redis client wrapper
    
    🔒 PRODUCTION: Use connection pooling for better performance
    """
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self.pool: Optional[redis.ConnectionPool] = None
    
    async def connect(self):
        """
        Initialize Redis connection pool
        
        🔒 PRODUCTION: Connection pool reuses connections (faster)
        """
        try:
            # Parse Redis URL
            # 🔒 PRODUCTION: Add password in URL format: redis://:password@host:port/db
            self.pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=20 if settings.is_production else 10,
                decode_responses=True,  # Auto-decode bytes to strings
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
            )
            
            self.redis = redis.Redis(connection_pool=self.pool)
            
            # Test connection
            await self.redis.ping()
            logger.info("Redis connected successfully")
            
        except Exception as e:
            logger.error(f"Redis connection failed: {e}")
            # 🔒 PRODUCTION: Decide if app should crash or continue without Redis
            if settings.is_production:
                raise  # Crash in production if Redis is critical
            else:
                logger.warning("Running without Redis in development mode")
    
    async def disconnect(self):
        """
        Close Redis connections
        """
        if self.redis:
            await self.redis.close()
        if self.pool:
            await self.pool.disconnect()
        logger.info("Redis disconnected")
    
    async def get(self, key: str) -> Optional[str]:
        """Get value from Redis"""
        if not self.redis:
            return None
        try:
            return await self.redis.get(key)
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return None
    
    async def set(self, key: str, value: str, expire: Optional[int] = None):
        """
        Set value in Redis
        
        Args:
            key: Redis key
            value: Value to store
            expire: Optional expiration in seconds
        """
        if not self.redis:
            return
        try:
            await self.redis.set(key, value, ex=expire)
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
    
    async def delete(self, key: str):
        """Delete key from Redis"""
        if not self.redis:
            return
        try:
            await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis:
            return False
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis EXISTS error: {e}")
            return False


# Global Redis client instance
redis_client = RedisClient()
