import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.core.redis_client import RedisClient

logger = logging.getLogger(__name__)


class RedisChatService:
    """Lightweight chat storage using Redis."""

    TTL_SECONDS = 24 * 3600
    MAX_MESSAGES = 200

    def __init__(self, redis_client: RedisClient):
        self.redis_client = redis_client

    @property
    def _redis(self):
        return getattr(self.redis_client, "redis", None)

    def _messages_key(self, room_id: str) -> str:
        return f"chat:{room_id}:messages"

    def _reactions_key(self, room_id: str, message_id: str) -> str:
        return f"chat:{room_id}:reactions:{message_id}"

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def new_message(self, room_id: str, user_id: str, username: str, message: str, reply_to_id: Optional[str] = None) -> dict:
        return {
            "id": f"msg_{uuid.uuid4()}",
            "user_id": user_id,
            "username": username,
            "message": message,
            "timestamp": self._now_iso(),
            "reply_to_id": reply_to_id,
        }

    async def add_message(self, room_id: str, message: dict) -> None:
        r = self._redis
        if not r:
            logger.warning("Redis not connected, skipping add_message")
            return

        key = self._messages_key(room_id)
        try:
            await r.rpush(key, json.dumps(message))
            await r.ltrim(key, -self.MAX_MESSAGES, -1)
            await r.expire(key, self.TTL_SECONDS)
        except Exception as e:
            logger.error(f"[RedisChatService] add_message failed: {e}")

    async def get_messages(self, room_id: str, limit: int = 200) -> List[dict]:
        r = self._redis
        if not r:
            return []

        key = self._messages_key(room_id)
        try:
            raw = await r.lrange(key, -limit, -1)
            messages = []
            for item in raw:
                try:
                    messages.append(json.loads(item))
                except Exception:
                    continue
            return messages
        except Exception as e:
            logger.error(f"[RedisChatService] get_messages failed: {e}")
            return []

    async def add_reaction(self, room_id: str, message_id: str, emoji: str, user_id: str) -> None:
        r = self._redis
        if not r:
            logger.warning("Redis not connected, skipping add_reaction")
            return

        key = self._reactions_key(room_id, message_id)
        try:
            existing_raw = await r.hget(key, emoji)
            users: List[str] = []
            if existing_raw:
                try:
                    users = json.loads(existing_raw)
                except Exception:
                    users = []

            if user_id not in users:
                users.append(user_id)
                await r.hset(key, emoji, json.dumps(users))

            await r.expire(key, self.TTL_SECONDS)
        except Exception as e:
            logger.error(f"[RedisChatService] add_reaction failed: {e}")

    async def remove_reaction(self, room_id: str, message_id: str, emoji: str, user_id: str) -> None:
        r = self._redis
        if not r:
            logger.warning("Redis not connected, skipping remove_reaction")
            return

        key = self._reactions_key(room_id, message_id)
        try:
            existing_raw = await r.hget(key, emoji)
            if not existing_raw:
                return

            try:
                users = json.loads(existing_raw)
            except Exception:
                users = []

            if user_id in users:
                users = [u for u in users if u != user_id]
                if users:
                    await r.hset(key, emoji, json.dumps(users))
                else:
                    await r.hdel(key, emoji)

            await r.expire(key, self.TTL_SECONDS)
        except Exception as e:
            logger.error(f"[RedisChatService] remove_reaction failed: {e}")

    async def get_reactions(self, room_id: str, message_id: str) -> Dict[str, List[str]]:
        r = self._redis
        if not r:
            return {}

        key = self._reactions_key(room_id, message_id)
        try:
            raw = await r.hgetall(key)
            reactions: Dict[str, List[str]] = {}
            for emoji, users_json in raw.items():
                try:
                    reactions[emoji] = json.loads(users_json)
                except Exception:
                    reactions[emoji] = []
            return reactions
        except Exception as e:
            logger.error(f"[RedisChatService] get_reactions failed: {e}")
            return {}

