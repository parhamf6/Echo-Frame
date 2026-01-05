"""
LiveKit API Endpoints
Provides LiveKit token generation for voice and text chat

🔒 LIVEKIT CONFIGURATION:
All LiveKit credentials (API key, secret, host, webhook secret) are loaded from
environment variables. To update them, edit the .env file:
- Location: backend/echoframe_api/.env
- Variables: LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WEBHOOK_SECRET

The LiveKitService class automatically uses these credentials. No code changes needed
when updating keys - only update the .env file.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.admin import Admin
from app.models.guest import Guest
from app.core.livekit_service import livekit_service

router = APIRouter()


# Response Model
class LiveKitTokenResponse(BaseModel):
    """LiveKit token response"""
    token: str
    room_name: str
    ws_url: str


@router.post(
    "/rooms/{room_id}/livekit/token",
    response_model=LiveKitTokenResponse,
    summary="Get LiveKit token",
    description="Generate LiveKit access token for voice and text chat"
)
async def get_livekit_token(
    room_id: str,
    current_user: Admin | Guest = Depends(get_current_user)
):
    """
    Generate LiveKit token for accessing voice and text chat
    
    - **room_id**: Room identifier
    - Requires: Valid session token (guest or admin)
    - Returns: LiveKit token, room name, and WebSocket URL
    """
    # Verify user has access to this room
    if isinstance(current_user, Guest):
        if str(current_user.room_id) != room_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this room"
            )
        
        # If guest is still pending, they can connect but won't have permissions
        guest_id = str(current_user.id)
        username = current_user.username
        role = current_user.role.value
        
        # Get permissions - only granted if ACCEPTED
        from app.models.guest import JoinStatus
        if current_user.join_status == JoinStatus.ACCEPTED:
            permissions = current_user.permissions_json or {}
            can_chat = permissions.get("can_chat", False)
            can_voice = permissions.get("can_voice", False)
        else:
            # Pending guests have no permissions yet
            can_chat = False
            can_voice = False
        
    else:
        # Admin always has full permissions
        guest_id = f"admin_{current_user.id}"
        username = current_user.username or "Admin"
        role = "admin"
        can_chat = True
        can_voice = True
    
    # Generate token
    try:
        token_data = await livekit_service.generate_token(
            room_id=room_id,
            guest_id=guest_id,
            username=username,
            can_voice=can_voice,
            can_chat=can_chat,
            role=role
        )
        
        return LiveKitTokenResponse(**token_data)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )