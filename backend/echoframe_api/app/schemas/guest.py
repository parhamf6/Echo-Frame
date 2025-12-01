from pydantic import BaseModel, Field
from typing import Optional


class GuestJoinRequest(BaseModel):
    room_id: str = Field(..., description="UUID of the room to join")
    username: str = Field(..., min_length=2, max_length=50)
    fingerprint: str = Field(..., min_length=8, max_length=255)



class GuestResponse(BaseModel):
    id: str
    room_id: str
    username: str
    join_status: str
    role: str
    kicked: bool
    created_at: Optional[str]
    permissions: Optional[dict] = None
    online: Optional[bool] = True
    offline_since: Optional[str] = None


class GuestJoinResponse(BaseModel):
    guest_id: str
    session_token: str
    note: Optional[str]


class PermissionUpdate(BaseModel):
    can_chat: Optional[bool] = None
    can_voice: Optional[bool] = None
    
    class Config:
        # Allow partial updates - at least one field should be provided
        # but we'll validate that in the endpoint
        pass


class PermissionResponse(BaseModel):
    guest_id: str
    permissions: dict


class GuestStatusResponse(BaseModel):
    guest_id: str
    join_status: str
    kicked: bool
    role: str
    permissions: dict
