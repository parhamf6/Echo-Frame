import logging
from app.core.redis_client import RedisClient

logger = logging.getLogger(__name__)


async def is_rate_limited(redis: RedisClient, ip: str, limit: int = 3, period_seconds: int = 3600) -> bool:
    """Return True if the IP exceeded the allowed number of requests within the period.

    Uses a simple Redis counter with TTL. Increments the counter and sets expiry
    when the key is first created. This is sufficient for a per-period cap.
    """
    if not redis or not getattr(redis, "redis", None):
        # Redis not available — fail open (do not rate limit)
        logger.debug("Redis not available for rate limiting — allowing request")
        return False

    key = f"rl:auth:{ip}"
    try:
        # atomic increment
        val = await redis.redis.incr(key)
        if val == 1:
            # first time: set expiration
            await redis.redis.expire(key, period_seconds)

        logger.debug(f"Rate limit key={key} count={val}")
        return val > limit
    except Exception as e:
        logger.error(f"Rate limiter error: {e}")
        # On error, be permissive to avoid accidental lockout
        return False


async def get_remaining(redis: RedisClient, ip: str, limit: int = 3, period_seconds: int = 3600) -> int:
    """Return number of remaining allowed requests for the period (best-effort)."""
    if not redis or not getattr(redis, "redis", None):
        return limit

    key = f"rl:auth:{ip}"
    try:
        val = await redis.redis.get(key)
        if not val:
            return limit
        val = int(val)
        remaining = max(0, limit - val)
        return remaining
    except Exception:
        return limit
