from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class VideoUploadResponse(BaseModel):
    video_id: str = Field(..., description="ID of the created video")


class SubtitleResponse(BaseModel):
    id: str
    language: str
    label: str
    file_path: str
    created_at: datetime


class VideoResponse(BaseModel):
    id: str
    title: str
    hls_manifest_path: str
    thumbnail_path: Optional[str] = None
    duration_seconds: int
    playlist_order: int
    created_at: datetime
    subtitles: List[SubtitleResponse] = []


class PlaylistReorderRequest(BaseModel):
    video_ids: List[str] = Field(..., description="Video IDs in the desired playlist order")


class PlaylistResponse(BaseModel):
    videos: List[VideoResponse]


