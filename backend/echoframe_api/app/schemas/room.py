from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RoomCreate(BaseModel):
    # No payload needed for single-room creation but keep model for extensibility
    pass


class RoomResponse(BaseModel):
    id: str
    is_active: bool
    created_at: datetime
    ended_at: Optional[datetime]


class RoomStatus(BaseModel):
    id: Optional[str]
    is_active: bool
    current_users_count: int
    created_at: Optional[datetime]
    ended_at: Optional[datetime]
