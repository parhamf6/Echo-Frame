"""
Redis Chat Storage Service - Modified to prevent duplicates
"""
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)


class RedisChatService:
    """Manages chat messages and reactions in Redis"""
    
    CHAT_TTL = 86400  # 24 hours
    MAX_MESSAGES = 200
    
    @staticmethod
    def _message_key(room_id: str) -> str:
        return f"chat:{room_id}:messages"
    
    @staticmethod
    def _reactions_key(room_id: str, message_id: str) -> str:
        return f"chat:{room_id}:reactions:{message_id}"
    
    async def add_message(
        self,
        room_id: str,
        user_id: str,
        username: str,
        message: str,
        reply_to_id: Optional[str] = None,
        message_id: Optional[str] = None,  # ← NEW: Accept pre-generated ID
        timestamp: Optional[str] = None,   # ← NEW: Accept pre-generated timestamp
    ) -> Dict:
        """
        Add a message to the chat history
        
        Args:
            message_id: If provided, use this ID (prevents duplicates)
            timestamp: If provided, use this timestamp
        
        Returns:
            dict: The created message with id and timestamp
        """
        if not redis_client.redis:
            logger.warning("Redis not available, message not stored")
            return {}
        
        try:
            # Use provided ID or generate new one
            msg_id = message_id or f"msg_{uuid4().hex[:12]}"
            msg_timestamp = timestamp or datetime.utcnow().isoformat()
            
            # ✅ Check if message already exists (prevent duplicates)
            key = self._message_key(room_id)
            existing_messages = await redis_client.redis.lrange(key, 0, -1)
            
            for existing_msg_json in existing_messages:
                try:
                    existing_msg = json.loads(existing_msg_json)
                    if existing_msg.get("id") == msg_id:
                        logger.info(f"Message {msg_id} already exists, skipping")
                        return existing_msg  # Return existing message
                except json.JSONDecodeError:
                    continue
            
            # Create new message object
            message_obj = {
                "id": msg_id,
                "user_id": user_id,
                "username": username,
                "message": message,
                "timestamp": msg_timestamp,
                "reply_to_id": reply_to_id
            }
            
            # Add to list
            await redis_client.redis.rpush(key, json.dumps(message_obj))
            
            # Trim to last 200 messages
            await redis_client.redis.ltrim(key, -self.MAX_MESSAGES, -1)
            
            # Set expiration
            await redis_client.redis.expire(key, self.CHAT_TTL)
            
            logger.info(f"Message {msg_id} added to room {room_id}")
            return message_obj
            
        except Exception as e:
            logger.error(f"Failed to add message to Redis: {e}")
            return {}
    
    async def get_messages(
        self,
        room_id: str,
        limit: int = 200
    ) -> List[Dict]:
        """Get last N messages from chat history"""
        if not redis_client.redis:
            return []
        
        try:
            key = self._message_key(room_id)
            messages_json = await redis_client.redis.lrange(key, -limit, -1)
            
            messages = []
            for msg_json in messages_json:
                try:
                    messages.append(json.loads(msg_json))
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON in message: {msg_json}")
                    continue
            
            logger.info(f"Retrieved {len(messages)} messages from room {room_id}")
            return messages
            
        except Exception as e:
            logger.error(f"Failed to get messages from Redis: {e}")
            return []
    
    async def add_reaction(
        self,
        room_id: str,
        message_id: str,
        emoji: str,
        user_id: str
    ) -> bool:
        """Add a reaction to a message"""
        if not redis_client.redis:
            return False
        
        try:
            key = self._reactions_key(room_id, message_id)
            existing = await redis_client.redis.hget(key, emoji)
            user_ids = json.loads(existing) if existing else []
            
            if user_id not in user_ids:
                user_ids.append(user_id)
                await redis_client.redis.hset(key, emoji, json.dumps(user_ids))
                await redis_client.redis.expire(key, self.CHAT_TTL)
                logger.info(f"Reaction {emoji} added by {user_id} to {message_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to add reaction: {e}")
            return False
    
    async def remove_reaction(
        self,
        room_id: str,
        message_id: str,
        emoji: str,
        user_id: str
    ) -> bool:
        """Remove a reaction from a message"""
        if not redis_client.redis:
            return False
        
        try:
            key = self._reactions_key(room_id, message_id)
            existing = await redis_client.redis.hget(key, emoji)
            if not existing:
                return False
            
            user_ids = json.loads(existing)
            
            if user_id in user_ids:
                user_ids.remove(user_id)
                
                if user_ids:
                    await redis_client.redis.hset(key, emoji, json.dumps(user_ids))
                else:
                    await redis_client.redis.hdel(key, emoji)
                
                logger.info(f"Reaction {emoji} removed by {user_id} from {message_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to remove reaction: {e}")
            return False
    
    async def get_reactions(
        self,
        room_id: str,
        message_id: str
    ) -> Dict[str, List[str]]:
        """Get all reactions for a message"""
        if not redis_client.redis:
            return {}
        
        try:
            key = self._reactions_key(room_id, message_id)
            reactions_raw = await redis_client.redis.hgetall(key)
            
            reactions = {}
            for emoji, user_ids_json in reactions_raw.items():
                try:
                    reactions[emoji] = json.loads(user_ids_json)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON in reactions: {user_ids_json}")
                    continue
            
            return reactions
            
        except Exception as e:
            logger.error(f"Failed to get reactions: {e}")
            return {}
    
    async def get_all_reactions_for_room(
        self,
        room_id: str,
        message_ids: List[str]
    ) -> Dict[str, Dict[str, List[str]]]:
        """Get reactions for multiple messages at once"""
        reactions_map = {}
        
        for message_id in message_ids:
            reactions = await self.get_reactions(room_id, message_id)
            if reactions:
                reactions_map[message_id] = reactions
        
        return reactions_map


# Singleton instance
redis_chat_service = RedisChatService()