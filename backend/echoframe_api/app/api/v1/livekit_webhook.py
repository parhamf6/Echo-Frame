"""
LiveKit Webhook Handler
Receives events from LiveKit server (data messages, participant events)
"""
import json
import logging
import hmac
import hashlib
from typing import Dict, Any
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Request, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.redis_chat import redis_chat_service
from app.api.deps import get_db_session
from app.models.guest import Guest

logger = logging.getLogger(__name__)

router = APIRouter()


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """
    Verify LiveKit webhook signature
    
    🔒 LIVEKIT WEBHOOK SECRET: Uses LIVEKIT_WEBHOOK_SECRET from environment variables.
    If you need to update the webhook secret, change it in the .env file:
    - Location: backend/echoframe_api/.env
    - Variable: LIVEKIT_WEBHOOK_SECRET
    
    Args:
        body: Raw request body
        signature: Signature from X-LiveKit-Signature header
    
    Returns:
        bool: True if signature is valid
    """
    try:
        # Normalize common signature formats used by LiveKit
        # Accepts: raw hex, 'sha256=<hex>', 'v1=<hex>', 'Signature <hex>', 'Bearer <hex|base64>'
        sig = signature or ''
        sig = sig.strip()

        # Helper to extract hex from various prefixes
        hex_sig = None
        if sig.startswith('sha256=') or sig.startswith('v1='):
            hex_sig = sig.split('=', 1)[1]
        elif sig.startswith('Signature ') or sig.startswith('signature '):
            hex_sig = sig.split(' ', 1)[1]
        elif sig.startswith('Bearer '):
            token = sig.split(' ', 1)[1]
            # Token may be raw hex or base64-encoded bytes
            try:
                # If it's valid hex, use it
                int(token, 16)
                hex_sig = token
            except Exception:
                try:
                    import base64
                    raw = base64.b64decode(token)
                    hex_sig = raw.hex()
                except Exception:
                    hex_sig = None
        else:
            # bare hex or alternative header values
            hex_sig = sig if all(c in '0123456789abcdefABCDEF' for c in sig) else None

        if not hex_sig:
            logger.warning('[LiveKit] Webhook invalid Authorization format')
            return False

        # LiveKit uses HMAC-SHA256
        expected_signature = hmac.new(
            settings.LIVEKIT_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(hex_sig, expected_signature)
    except Exception as e:
        logger.error(f"Webhook signature verification error: {e}")
        return False


async def get_guest_permissions(db: AsyncSession, guest_id: str) -> Dict[str, bool]:
    """
    Get guest permissions from database
    
    Args:
        db: Database session
        guest_id: Guest identifier
    
    Returns:
        dict: {can_chat: bool, can_voice: bool}
    """
    try:
        # Handle admin identities (format: admin_{id})
        if guest_id.startswith("admin_"):
            return {"can_chat": True, "can_voice": True}
        
        result = await db.execute(select(Guest).where(Guest.id == guest_id))
        guest = result.scalar_one_or_none()
        
        if not guest:
            logger.warning(f"Guest {guest_id} not found")
            return {"can_chat": False, "can_voice": False}
        
        permissions = guest.permissions_json or {}
        return {
            "can_chat": permissions.get("can_chat", False),
            "can_voice": permissions.get("can_voice", False)
        }
    except Exception as e:
        logger.error(f"Failed to get guest permissions: {e}")
        return {"can_chat": False, "can_voice": False}


async def handle_chat_message(
    room_id: str,
    sender_id: str,
    username: str,
    message_data: Dict[str, Any],
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Handle incoming chat message
    
    Args:
        room_id: Room identifier
        sender_id: Sender guest ID
        username: Sender username
        message_data: Message payload
        db: Database session
    
    Returns:
        dict: Formatted message to broadcast
    """
    try:
        # Check permissions
        permissions = await get_guest_permissions(db, sender_id)
        if not permissions.get("can_chat", False):
            logger.warning(f"User {sender_id} tried to send message without permission")
            return {}
        
        # Extract message content
        message_text = message_data.get("message", "")
        reply_to_id = message_data.get("reply_to_id")
        
        if not message_text or len(message_text) > 1000:
            logger.warning(f"Invalid message length from {sender_id}")
            return {}
        
        # Store in Redis
        message_obj = await redis_chat_service.add_message(
            room_id=room_id,
            user_id=sender_id,
            username=username,
            message=message_text,
            reply_to_id=reply_to_id
        )
        
        if not message_obj:
            logger.error("Failed to store message in Redis")
            return {}
        
        logger.info(f"Chat message stored: {message_obj['id']} from {username}")
        
        # Return formatted message for broadcast
        return {
            "type": "chat:message",
            "id": message_obj["id"],
            "user_id": sender_id,
            "username": username,
            "message": message_text,
            "timestamp": message_obj["timestamp"],
            "reply_to_id": reply_to_id
        }
        
    except Exception as e:
        logger.error(f"Failed to handle chat message: {e}")
        return {}


async def handle_chat_reaction(
    room_id: str,
    sender_id: str,
    reaction_data: Dict[str, Any],
    db: AsyncSession
) -> Dict[str, Any]:
    """
    Handle chat reaction (emoji)
    
    Args:
        room_id: Room identifier
        sender_id: User adding/removing reaction
        reaction_data: Reaction payload
        db: Database session
    
    Returns:
        dict: Formatted reaction update to broadcast
    """
    try:
        # Check permissions
        permissions = await get_guest_permissions(db, sender_id)
        if not permissions.get("can_chat", False):
            logger.warning(f"User {sender_id} tried to react without permission")
            return {}
        
        message_id = reaction_data.get("message_id")
        emoji = reaction_data.get("emoji")
        action = reaction_data.get("action")  # 'add' or 'remove'
        
        if not message_id or not emoji or action not in ["add", "remove"]:
            logger.warning(f"Invalid reaction data from {sender_id}")
            return {}
        
        # Update reaction in Redis
        if action == "add":
            success = await redis_chat_service.add_reaction(
                room_id=room_id,
                message_id=message_id,
                emoji=emoji,
                user_id=sender_id
            )
        else:
            success = await redis_chat_service.remove_reaction(
                room_id=room_id,
                message_id=message_id,
                emoji=emoji,
                user_id=sender_id
            )
        
        if not success:
            logger.warning(f"Failed to {action} reaction for {sender_id}")
            return {}
        
        logger.info(f"Reaction {action}: {emoji} on {message_id} by {sender_id}")
        
        # Return formatted reaction update
        return {
            "type": "chat:reaction",
            "message_id": message_id,
            "emoji": emoji,
            "user_id": sender_id,
            "action": action,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to handle reaction: {e}")
        return {}


# Typing indicators - in-memory store (no persistence needed)
typing_indicators: Dict[str, Dict[str, float]] = {}  # {room_id: {user_id: timestamp}}

async def handle_typing_indicator(
    room_id: str,
    sender_id: str,
    username: str,
    typing_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Handle typing indicator
    
    Args:
        room_id: Room identifier
        sender_id: User typing
        username: User's display name
        typing_data: Typing payload
    
    Returns:
        dict: Typing indicator to broadcast
    """
    try:
        is_typing = typing_data.get("is_typing", False)
        
        # Update typing state
        if room_id not in typing_indicators:
            typing_indicators[room_id] = {}
        
        if is_typing:
            typing_indicators[room_id][sender_id] = datetime.utcnow().timestamp()
        else:
            typing_indicators[room_id].pop(sender_id, None)
        
        # Return typing indicator (no storage)
        return {
            "type": "chat:typing",
            "user_id": sender_id,
            "username": username,
            "is_typing": is_typing,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to handle typing indicator: {e}")
        return {}


@router.post(
    "/livekit/webhook",
    summary="LiveKit webhook",
    description="Receives events from LiveKit server"
)
async def livekit_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    """
    LiveKit webhook endpoint
    
    Handles:
    - data_received: Chat messages, reactions, typing indicators
    - participant_joined: User joined room
    - participant_left: User left room
    """
    try:
        # Get signature
        signature = request.headers.get("X-LiveKit-Signature", "")
        
        # Get raw body
        body = await request.body()
        
        # Verify signature (skip in development)
        logger.debug(f"LiveKit webhook headers: X-LiveKit-Signature present={ 'X-LiveKit-Signature' in request.headers }, LiveKit-Signature present={ 'LiveKit-Signature' in request.headers }, Authorization present={ 'Authorization' in request.headers }")
        if settings.is_production and not verify_webhook_signature(body, signature):
            logger.warning("[LiveKit] Webhook verification failed")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature"
            )
        
        # Parse webhook data
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON"
            )
        
        event_type = data.get("event")
        
        logger.info(f"Received LiveKit webhook: {event_type}")
        
        # Handle different event types
        if event_type == "data_received":
            # Extract data
            room_name = data.get("room", {}).get("name", "")
            participant = data.get("participant", {})

            # Prefer metadata (contains original guest_id and username).
            # Fallback to participant.identity / participant.name if metadata
            # is missing or invalid.
            sender_id = participant.get("identity", "")
            username = participant.get("name", "Unknown")
            metadata_str = participant.get("metadata", "")
            if metadata_str:
                try:
                    meta = json.loads(metadata_str)
                    sender_id = meta.get("guest_id", sender_id)
                    username = meta.get("username", username)
                except (json.JSONDecodeError, TypeError):
                    logger.warning("Invalid participant metadata, falling back to identity/name")
            
            # Parse room_id from room_name (format: room_{room_id})
            if room_name.startswith("room_"):
                room_id = room_name.replace("room_", "")
            else:
                logger.warning(f"Invalid room name format: {room_name}")
                return {"status": "ignored"}
            
            # Get data payload
            data_payload_str = data.get("data_packet", {}).get("data", "")
            
            try:
                # LiveKit sends base64-encoded data, but in webhook it's already decoded
                message_data = json.loads(data_payload_str)
            except (json.JSONDecodeError, TypeError):
                logger.warning(f"Invalid data payload: {data_payload_str}")
                return {"status": "ignored"}
            
            message_type = message_data.get("type")
            
            # Route to appropriate handler
            response_data = {}
            
            if message_type == "chat:message":
                response_data = await handle_chat_message(
                    room_id, sender_id, username, message_data, db
                )
            
            elif message_type == "chat:reaction":
                response_data = await handle_chat_reaction(
                    room_id, sender_id, message_data, db
                )
            
            elif message_type == "chat:typing":
                response_data = await handle_typing_indicator(
                    room_id, sender_id, username, message_data
                )
            
            else:
                logger.warning(f"Unknown message type: {message_type}")
                return {"status": "ignored"}
            
            # If handler returned data, it means we should broadcast
            # (LiveKit will handle broadcasting automatically via Data Channel)
            if response_data:
                logger.info(f"Processed {message_type} successfully")
            
            return {"status": "ok"}
        
        elif event_type == "participant_joined":
            participant = data.get("participant", {})
            room_name = data.get("room", {}).get("name", "")

            # Try to extract guest_id from metadata for clearer logs
            identity = participant.get('identity', '')
            metadata_str = participant.get('metadata', '')
            guest_id = identity
            if metadata_str:
                try:
                    meta = json.loads(metadata_str)
                    guest_id = meta.get('guest_id', identity)
                except (json.JSONDecodeError, TypeError):
                    pass

            logger.info(
                f"Participant joined: identity={identity}, guest_id={guest_id} "
                f"in room {room_name}"
            )
            return {"status": "ok"}
        
        elif event_type == "participant_left":
            participant = data.get("participant", {})
            room_name = data.get("room", {}).get("name", "")

            # Try to extract guest_id from metadata for clearer logs
            identity = participant.get('identity', '')
            metadata_str = participant.get('metadata', '')
            guest_id = identity
            if metadata_str:
                try:
                    meta = json.loads(metadata_str)
                    guest_id = meta.get('guest_id', identity)
                except (json.JSONDecodeError, TypeError):
                    pass

            logger.info(
                f"Participant left: identity={identity}, guest_id={guest_id} "
                f"in room {room_name}"
            )
            return {"status": "ok"}
        
        else:
            logger.info(f"Unhandled event type: {event_type}")
            return {"status": "ignored"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook handler error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.get("/livekit/webhook/test")
async def test_webhook():
    """Test endpoint to verify webhook is accessible"""
    return {
        "status": "ok",
        "message": "LiveKit webhook is accessible",
        "webhook_secret_configured": bool(settings.LIVEKIT_WEBHOOK_SECRET)
    }

# Cleanup old typing indicators every 10 seconds
import asyncio

async def cleanup_typing_indicators():
    """Remove stale typing indicators (older than 5 seconds)"""
    while True:
        try:
            await asyncio.sleep(10)
            
            now = datetime.utcnow().timestamp()
            for room_id in list(typing_indicators.keys()):
                room_typing = typing_indicators[room_id]
                stale_users = [
                    user_id for user_id, timestamp in room_typing.items()
                    if now - timestamp > 5  # 5 seconds timeout
                ]
                for user_id in stale_users:
                    room_typing.pop(user_id, None)
                
                # Remove empty room entries
                if not room_typing:
                    typing_indicators.pop(room_id, None)
                    
        except Exception as e:
            logger.error(f"Error in cleanup_typing_indicators: {e}")

# Start cleanup task on module load
# Note: This will be started by FastAPI's startup event in main.py