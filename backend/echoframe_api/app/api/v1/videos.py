from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Dict, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db_session
from app.core.config import settings
from app.models import Subtitle, Video
from app.schemas.video import (
    PlaylistReorderRequest,
    PlaylistResponse,
    SubtitleResponse,
    VideoResponse,
    VideoUploadResponse,
)

router = APIRouter()


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _load_metadata(video_dir: Path) -> Dict | None:
    meta_path = video_dir / "metadata.json"
    if not meta_path.exists():
        return None
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _validate_hls_structure(video_dir: Path) -> List[str]:
    """
    Validate that the extracted directory looks like an Echo Frame HLS package.

    - master.m3u8 must exist at the root.
    - Either metadata.json lists renditions with quality/index.m3u8
      or we infer qualities from subdirectories containing index.m3u8.
    """
    master = video_dir / "master.m3u8"
    if not master.exists():
        raise HTTPException(status_code=400, detail="master.m3u8 not found in uploaded package")

    qualities: List[str] = []

    metadata = _load_metadata(video_dir)
    if metadata and isinstance(metadata, dict):
        for rendition in metadata.get("renditions", []):
            label = str(rendition.get("label") or "").strip()
            if not label:
                continue
            variant_dir = video_dir / label
            playlist = variant_dir / "index.m3u8"
            if not playlist.exists():
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing index.m3u8 for rendition '{label}'",
                )
            qualities.append(label)

    # Fallback: infer from folders containing index.m3u8
    if not qualities:
        for child in video_dir.iterdir():
            if child.is_dir():
                playlist = child / "index.m3u8"
                if playlist.exists():
                    qualities.append(child.name)

    if not qualities:
        raise HTTPException(status_code=400, detail="No HLS variant playlists found in uploaded package")

    return qualities


def _next_playlist_order(existing: List[Video]) -> int:
    if not existing:
        return 1
    return max(v.playlist_order for v in existing) + 1


@router.post("/upload", response_model=VideoUploadResponse)
async def upload_video_package(
    title: str = Form(..., description="Human-readable video title"),
    duration_seconds: int = Form(..., description="Duration in seconds"),
    package: UploadFile = File(..., description="Tar/zip archive produced by Echo Frame CLI"),
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Upload a processed HLS package produced by the Echo Frame CLI.

    The file should be an archive (.tar.gz, .zip, etc.) of the directory that contains:
    - master.m3u8
    - rendition folders (1080/, 720/, ...) with index.m3u8 + .ts
    - thumbnails/poster.jpg (optional)
    - subtitles/{lang}.vtt (optional)
    - metadata.json (optional, for validation and UI hints)
    """
    base_storage = Path(settings.VIDEO_STORAGE_PATH)
    _ensure_dir(base_storage)

    # Persist the uploaded archive temporarily
    tmp_path = base_storage / f"tmp_{package.filename}"
    with tmp_path.open("wb") as f:
        shutil.copyfileobj(package.file, f)

    # Determine next playlist order and create DB row (we'll update paths after extraction)
    result = await db.execute(select(Video).order_by(Video.playlist_order.asc()))
    existing: List[Video] = list(result.scalars().all())

    video = Video(
        title=title,
        hls_manifest_path="",
        thumbnail_path=None,
        duration_seconds=duration_seconds,
        playlist_order=_next_playlist_order(existing),
    )
    db.add(video)
    await db.flush()
    await db.refresh(video)

    # Final directory: /videos/{video_id}/ on disk and as URL prefix
    video_dir = base_storage / str(video.id)
    _ensure_dir(video_dir)

    try:
        shutil.unpack_archive(str(tmp_path), str(video_dir))
    except (shutil.ReadError, ValueError):
        # Best-effort cleanup of the DB row
        await db.delete(video)
        await db.commit()
        raise HTTPException(status_code=400, detail="Failed to unpack uploaded package (unsupported or corrupt archive)")
    finally:
        if tmp_path.exists():
            tmp_path.unlink()

    # Validate HLS layout
    _validate_hls_structure(video_dir)

    # Persist manifest + thumbnail paths as URL paths that Nginx will serve
    url_root = f"/videos/{video.id}"
    video.hls_manifest_path = f"{url_root}/master.m3u8"

    poster = video_dir / "thumbnails" / "poster.jpg"
    if poster.exists():
        video.thumbnail_path = f"{url_root}/thumbnails/poster.jpg"

    await db.commit()

    return VideoUploadResponse(video_id=str(video.id))


@router.post("/{video_id}/subtitles", response_model=SubtitleResponse)
async def upload_subtitle(
    video_id: str,
    language: str = Form(..., description="ISO code, e.g. 'en'"),
    label: str = Form(..., description="Human label, e.g. 'English'"),
    file: UploadFile = File(...),
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Upload a single subtitle file for a given video."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in settings.ALLOWED_SUBTITLE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported subtitle extension: {suffix}")

    subtitles_dir = Path(settings.VIDEO_STORAGE_PATH) / str(video.id) / "subtitles"
    _ensure_dir(subtitles_dir)

    safe_name = f"{language}.vtt" if suffix == ".vtt" else f"{language}{suffix}"
    dest = subtitles_dir / safe_name
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    subtitle = Subtitle(
        video_id=video.id,
        language=language,
        label=label,
        file_path=f"/videos/{video.id}/subtitles/{safe_name}",
    )
    db.add(subtitle)
    await db.commit()
    await db.refresh(subtitle)

    return SubtitleResponse(
        id=str(subtitle.id),
        language=subtitle.language,
        label=subtitle.label,
        file_path=subtitle.file_path,
        created_at=subtitle.created_at,
    )


@router.get("/playlist", response_model=PlaylistResponse)
async def get_playlist(db: AsyncSession = Depends(get_db_session)):
    """Return all videos in playlist order, including subtitle metadata."""
    result = await db.execute(select(Video).order_by(Video.playlist_order.asc(), Video.created_at.asc()))
    videos: List[Video] = list(result.scalars().all())

    if not videos:
        return PlaylistResponse(videos=[])

    video_ids = [v.id for v in videos]
    sub_result = await db.execute(select(Subtitle).where(Subtitle.video_id.in_(video_ids)))
    subtitles: List[Subtitle] = list(sub_result.scalars().all())

    by_video: Dict[str, List[Subtitle]] = {}
    for s in subtitles:
        key = str(s.video_id)
        by_video.setdefault(key, []).append(s)

    def build_video(v: Video) -> VideoResponse:
        subs = [
            SubtitleResponse(
                id=str(s.id),
                language=s.language,
                label=s.label,
                file_path=s.file_path,
                created_at=s.created_at,
            )
            for s in by_video.get(str(v.id), [])
        ]
        return VideoResponse(
            id=str(v.id),
            title=v.title,
            hls_manifest_path=v.hls_manifest_path,
            thumbnail_path=v.thumbnail_path,
            duration_seconds=v.duration_seconds,
            playlist_order=v.playlist_order,
            created_at=v.created_at,
            subtitles=subs,
        )

    return PlaylistResponse(videos=[build_video(v) for v in videos])


@router.put("/playlist/reorder", response_model=PlaylistResponse)
async def reorder_playlist(
    payload: PlaylistReorderRequest,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Reorder the playlist based on the provided list of video IDs.

    Videos not present in the payload are appended afterwards, preserving
    their relative order.
    """
    result = await db.execute(select(Video).order_by(Video.playlist_order.asc(), Video.created_at.asc()))
    all_videos: List[Video] = list(result.scalars().all())

    id_to_video: Dict[str, Video] = {str(v.id): v for v in all_videos}

    for vid in payload.video_ids:
        if vid not in id_to_video:
            raise HTTPException(status_code=400, detail=f"Unknown video_id in playlist: {vid}")

    order = 1
    for vid in payload.video_ids:
        id_to_video[vid].playlist_order = order
        order += 1

    remaining = [v for v in all_videos if str(v.id) not in payload.video_ids]
    for v in remaining:
        v.playlist_order = order
        order += 1

    await db.commit()

    # Return updated playlist
    return await get_playlist(db=db)


@router.delete("/{video_id}")
async def delete_video(
    video_id: str,
    admin=Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
):
    """Delete a video, its subtitles (via FK cascade), and its files from disk."""
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Delete DB row
    await db.delete(video)
    await db.commit()

    # Best-effort cleanup of directory
    video_dir = Path(settings.VIDEO_STORAGE_PATH) / str(video.id)
    if video_dir.exists():
        shutil.rmtree(video_dir, ignore_errors=True)

    return {"detail": "Video deleted", "video_id": video_id}


