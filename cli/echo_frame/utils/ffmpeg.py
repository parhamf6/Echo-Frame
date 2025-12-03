from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


class FFmpegNotFoundError(RuntimeError):
    pass


@dataclass
class VideoMetadata:
    width: int
    height: int
    duration: float
    bitrate: Optional[int] = None

    @property
    def resolution_label(self) -> str:
        return f"{self.width}x{self.height}"


def _resolve_binary(binary: str, override: Optional[Path]) -> str:
    if override:
        override_str = str(override)
        # Validate that override looks like a file path (not a URL or other invalid value)
        if override_str.startswith(("http://", "https://", "Server URL:")):
            # Invalid override value, fall back to auto-detection
            path = shutil.which(binary)
            if not path:
                raise FFmpegNotFoundError(
                    f"{binary} is not installed or not on PATH. "
                    f"Config has invalid ffmpeg_path value: {override_str}. "
                    f"Fix it with: echo-frame config set ffmpeg_path <path>"
                )
            return path
        # Check if the override path exists and is executable
        override_path = Path(override_str)
        if override_path.exists() and override_path.is_file():
            return override_str
        # Path doesn't exist, but user specified it, so try it anyway (might be valid but not found yet)
        return override_str
    path = shutil.which(binary)
    if not path:
        raise FFmpegNotFoundError(f"{binary} is not installed or not on PATH")
    return path


def get_ffmpeg_binary(override: Optional[Path]) -> str:
    return _resolve_binary("ffmpeg", override)


def get_ffprobe_binary(override: Optional[Path]) -> str:
    return _resolve_binary("ffprobe", override)


def probe_video(path: Path, ffprobe_bin: str) -> VideoMetadata:
    cmd: List[str] = [
        ffprobe_bin,
        "-v",
        "error",
        "-show_entries",
        "stream=width,height,bit_rate",
        "-show_entries",
        "format=duration,bit_rate",
        "-of",
        "json",
        str(path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    payload = json.loads(result.stdout)
    video_stream = next((s for s in payload.get("streams", []) if s.get("width")), {})
    fmt = payload.get("format", {})
    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))
    duration = float(fmt.get("duration", 0.0))
    bitrate = int(video_stream.get("bit_rate") or fmt.get("bit_rate") or 0) or None
    if not width or not height:
        raise RuntimeError(f"Unable to detect resolution for {path}")
    return VideoMetadata(width=width, height=height, duration=duration, bitrate=bitrate)


def run_ffmpeg(cmd: List[str], log_path: Path) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a") as log_file:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        assert process.stdout is not None
        for line in process.stdout:
            log_file.write(line)
        exit_code = process.wait()
        if exit_code != 0:
            raise RuntimeError(f"FFmpeg command failed: {' '.join(cmd)}")


def convert_subtitle_to_vtt(input_path: Path, output_path: Path, ffmpeg_bin: str, log_path: Path) -> None:
    cmd = [
        ffmpeg_bin,
        "-y",
        "-i",
        str(input_path),
        str(output_path),
    ]
    run_ffmpeg(cmd, log_path)


def capture_thumbnail(source: Path, output_path: Path, ffmpeg_bin: str, timestamp: float = 1.0) -> None:
    cmd = [
        ffmpeg_bin,
        "-y",
        "-ss",
        str(timestamp),
        "-i",
        str(source),
        "-frames:v",
        "1",
        "-q:v",
        "2",
        str(output_path),
    ]
    run_ffmpeg(cmd, output_path.parent / "thumbnail.log")
