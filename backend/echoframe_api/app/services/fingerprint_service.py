from typing import List
from app.core.redis_client import RedisClient
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


async def add_fingerprint_ip(redis: RedisClient, room_id: str, fingerprint: str, ip: str) -> int:
    """Associate an IP with a fingerprint for a room.

    Uses a Redis set `fp:{room_id}:{fingerprint}` to store unique IPs.
    Returns the number of unique IPs seen for this fingerprint.
    """
    if not redis or not getattr(redis, "redis", None):
        logger.debug("Redis not available for fingerprint tracking")
        return 1

    key = f"fp:{room_id}:{fingerprint}"
    try:
        await redis.redis.sadd(key, ip)
        # set TTL to room period or a sensible default
        await redis.redis.expire(key, settings.GUEST_RATE_PERIOD_SECONDS)
        count = await redis.redis.scard(key)
        return int(count)
    except Exception as e:
        logger.error(f"Fingerprint tracking error: {e}")
        return 1


async def get_fingerprint_ips(redis: RedisClient, room_id: str, fingerprint: str) -> List[str]:
    if not redis or not getattr(redis, "redis", None):
        return []
    key = f"fp:{room_id}:{fingerprint}"
    try:
        items = await redis.redis.smembers(key)
        return list(items)
    except Exception as e:
        logger.error(f"Failed to read fp set: {e}")
        return []
