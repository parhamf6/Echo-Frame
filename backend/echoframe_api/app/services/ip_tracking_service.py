from datetime import datetime
from typing import List
from app.core.redis_client import RedisClient
import logging

logger = logging.getLogger(__name__)


async def log_ip_event(redis: RedisClient, ip: str, event: str, max_len: int = 100):
    """Log a timestamped event for an IP address in Redis (capped list).

    Key: `ip:events:{ip}` -> list of strings "{ts}|{event}"
    """
    if not redis or not getattr(redis, "redis", None):
        logger.debug("Redis not available for ip tracking")
        return

    key = f"ip:events:{ip}"
    entry = f"{int(datetime.utcnow().timestamp())}|{event}"
    try:
        await redis.redis.lpush(key, entry)
        await redis.redis.ltrim(key, 0, max_len - 1)
    except Exception as e:
        logger.error(f"Failed to log ip event for {ip}: {e}")


async def get_ip_events(redis: RedisClient, ip: str, limit: int = 50) -> List[str]:
    if not redis or not getattr(redis, "redis", None):
        return []

    key = f"ip:events:{ip}"
    try:
        items = await redis.redis.lrange(key, 0, limit - 1)
        return items
    except Exception as e:
        logger.error(f"Failed to read ip events for {ip}: {e}")
        return []
