"""
LiveKit Service
Handles LiveKit token generation and room management
"""
import logging
from typing import Dict, Optional
from livekit import api
import json
import secrets

from app.core.config import settings

logger = logging.getLogger(__name__)


class LiveKitService:
    """Service for managing LiveKit connections and tokens"""
    
    def __init__(self):
        # 🔒 LIVEKIT CREDENTIALS: All values are loaded from environment variables in .env
        # If you need to change LiveKit keys, update the .env file:
        # - LIVEKIT_HOST (WebSocket URL)
        # - LIVEKIT_API_KEY (API Key)
        # - LIVEKIT_API_SECRET (API Secret)
        # - LIVEKIT_WEBHOOK_SECRET (Webhook Secret)
        # Location: backend/echoframe_api/.env
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.host = settings.LIVEKIT_HOST
    
    async def generate_token(
        self,
        room_id: str,
        guest_id: str,
        username: str,
        can_voice: bool,
        can_chat: bool,
        role: str = "viewer"
    ) -> Dict[str, str]:
        """
        Generate LiveKit access token for a user
        
        Args:
            room_id: Room identifier
            guest_id: Guest/user identifier
            username: Display name
            can_voice: Whether user can publish audio
            can_chat: Whether user can send data (chat messages)
            role: User role (viewer, moderator, admin)
        
        Returns:
            dict: {token: str, room_name: str}
        """
        try:
            # Create token instance
            token = api.AccessToken(
                api_key=self.api_key,
                api_secret=self.api_secret
            )
            
            # Create a session-unique identity to avoid duplicate-identity errors
            # Keep the original guest_id in metadata so server-side logic can
            # map sessions back to a user (guest/admin).
            session_suffix = secrets.token_hex(4)
            session_identity = f"{guest_id}-{session_suffix}"

            # Set identity and metadata
            token.with_identity(session_identity)
            token.with_name(username)
            token.with_metadata(json.dumps({
                "username": username,
                "guest_id": guest_id,
                "role": role,
                "session_identity": session_identity
            }))
            
            # Configure permissions
            grants = api.VideoGrants(
                room_join=True,
                room=f"room_{room_id}",
                
                # Audio permissions (voice chat)
                can_publish=can_voice,
                can_subscribe=True,  # Always allow listening
                
                # Data channel permissions (text chat)
                can_publish_data=can_chat,
                can_update_own_metadata=True,
            )
            
            # Only allow microphone source (no video)
            if can_voice:
                # Don't explicitly set can_publish_sources - LiveKit will handle it
                # We're audio-only so no need to restrict sources
                pass
            
            token.with_grants(grants)
            
            jwt_token = token.to_jwt()
            
            logger.info(
                f"Generated LiveKit token for {username} (guest_id={guest_id}) "
                f"in room {room_id} - voice={can_voice}, chat={can_chat}"
            )
            
            return {
                "token": jwt_token,
                "room_name": f"room_{room_id}",
                "ws_url": self.host
            }
            
        except Exception as e:
            logger.error(f"Failed to generate LiveKit token: {e}")
            raise ValueError(f"Token generation failed: {str(e)}")
    
    async def send_data_message(
        self,
        room_name: str,
        data: Dict,
        destination_identities: Optional[list] = None
    ) -> bool:
        """
        Send data message to LiveKit room (for server-side broadcasting)
        
        Args:
            room_name: LiveKit room name
            data: Message data to send
            destination_identities: Optional list of specific user identities to send to
        
        Returns:
            bool: Success status
        """
        try:
            # TODO: Implement server-side data sending if needed
            # For now, clients will send data directly via LiveKit Data Channel
            logger.warning("Server-side data sending not yet implemented")
            return False
            
        except Exception as e:
            logger.error(f"Failed to send data message: {e}")
            return False


# Singleton instance
livekit_service = LiveKitService()