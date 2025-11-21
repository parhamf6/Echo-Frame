# backend/echoframe_api/app/db/base.py
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# IMPORTANT: import your models here so Alembic autogenerate can see them.
# Add one line per model file (do not import heavy modules here)
from app.models.user import User
from app.models.room import Room
from app.models.room_member import RoomMember
from app.models.video import Video
from app.models.room_playlist import RoomPlaylist
from app.models.friendship import Friendship
from app.models.room_invitation import RoomInvitation
from app.models.chat_message import ChatMessage
from app.models.storage_analytics import StorageAnalytics
