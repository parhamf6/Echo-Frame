from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum
from app.core.database import Base


class GuestRole(str, enum.Enum):
    VIEWER = "viewer"
    MODERATOR = "moderator"


class JoinStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class Guest(Base):
    __tablename__ = "guests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("room.id"), nullable=False)
    username = Column(String(50), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    fingerprint = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(45), nullable=False, index=True)
    role = Column(Enum(GuestRole), default=GuestRole.VIEWER, nullable=False)
    permissions_json = Column(JSONB, default={"can_chat": False, "can_voice": False}, nullable=False)
    join_status = Column(Enum(JoinStatus), default=JoinStatus.PENDING, nullable=False)
    kicked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<Guest {self.username} - {self.role}>"