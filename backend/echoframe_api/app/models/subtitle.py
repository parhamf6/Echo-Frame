from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.core.database import Base


class Subtitle(Base):
    __tablename__ = "subtitles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(10), nullable=False)  # e.g., 'en', 'es', 'ar'
    label = Column(String(50), nullable=False)  # e.g., 'English', 'Spanish'
    file_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<Subtitle {self.language} for Video {self.video_id}>"