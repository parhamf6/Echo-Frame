from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import typer
from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table

from ..config import load_config
from ..utils.ffmpeg import (
    FFmpegNotFoundError,
    VideoMetadata,
    capture_thumbnail,
    convert_subtitle_to_vtt,
    get_ffmpeg_binary,
    get_ffprobe_binary,
    probe_video,
    run_ffmpeg,
)

console = Console()
process_app = typer.Typer(help="Process videos into HLS packages")

SEGMENT_LENGTH = 4


@dataclass
class QualityPreset:
    label: str
    width: int
    height: int
    video_bitrate: int  # kbps
    audio_bitrate: int  # kbps

    @property
    def bandwidth(self) -> int:
        return (self.video_bitrate + self.audio_bitrate) * 1000

    @property
    def resolution(self) -> str:
        return f"{self.width}x{self.height}"


QUALITY_PRESETS: Dict[str, QualityPreset] = {
    "1080": QualityPreset("1080p", 1920, 1080, 5000, 192),
    "720": QualityPreset("720p", 1280, 720, 3000, 128),
    "480": QualityPreset("480p", 854, 480, 1400, 128),
    "360": QualityPreset("360p", 640, 360, 800, 96),
}


@dataclass
class RenditionPlan:
    name: str
    preset: QualityPreset
    source: Path
    metadata: VideoMetadata
    transcode: bool


def parse_variant_pairs(pairs: Iterable[str]) -> Dict[str, Path]:
    mapping: Dict[str, Path] = {}
    for pair in pairs:
        if "=" not in pair:
            raise typer.BadParameter("--input must look like 720=/path/to/file.mp4")
        quality, path_str = pair.split("=", 1)
        quality = quality.strip().lower()
        if quality not in QUALITY_PRESETS:
            raise typer.BadParameter(f"Unknown quality '{quality}'. Choose from {list(QUALITY_PRESETS.keys())}")
        path = Path(path_str).expanduser().resolve()
        if not path.exists():
            raise typer.BadParameter(f"Input file not found: {path}")
        mapping[quality] = path
    return mapping


@process_app.command("run")
def run(
    source: Optional[Path] = typer.Option(None, help="High-quality source file for transcoding"),
    input_variant: List[str] = typer.Option(
        None,
        "--input",
        help="quality=/path/to/file.mp4 for segment-only mode",
    ),
    targets: str = typer.Option(
        "1080,720,480,360",
        help="Comma-separated quality targets when --source is provided",
    ),
    output_dir: Path = typer.Option(
        Path("processed_video"),
        help="Directory to write HLS package",
    ),
    subtitle: List[Path] = typer.Option(None, "--subtitle", help="Subtitle file (repeatable)"),
    subtitle_lang: List[str] = typer.Option(None, "--lang", help="Subtitle language code (repeatable)"),
    interactive: bool = typer.Option(True, help="Ask for confirmation before processing"),
    dry_run: bool = typer.Option(False, help="Show plan without running FFmpeg"),
):
    """Process video files into an HLS ladder, generate metadata, and prepare uploadable output."""

    if not source and not input_variant:
        raise typer.BadParameter("Provide either --source or at least one --input quality=path pair")
    if source and input_variant:
        raise typer.BadParameter("Use either --source or --input pairs, not both")

    config = load_config()
    source = source.expanduser().resolve() if source else None

    try:
        ffmpeg_bin = get_ffmpeg_binary(config.ffmpeg_path)
        ffprobe_bin = get_ffprobe_binary(config.ffmpeg_path)
    except FFmpegNotFoundError as exc:
        console.print(f"❌ {exc}")
        console.print("Install FFmpeg or set ffmpeg_path via `echo-frame config set`")
        raise typer.Exit(code=1)

    output_dir = output_dir.expanduser().resolve()
    if output_dir.exists() and any(output_dir.iterdir()):
        console.print(f"⚠️  Output directory {output_dir} is not empty. Aborting to avoid overwrites.")
        raise typer.Exit(code=1)
    output_dir.mkdir(parents=True, exist_ok=True)
    logs_dir = output_dir / "logs"
    logs_dir.mkdir(exist_ok=True)

    plans: List[RenditionPlan] = []

    if source:
        if not source.exists():
            console.print(f"Source file not found: {source}")
            raise typer.Exit(code=1)
        source_meta = probe_video(source, ffprobe_bin)
        requested = [q.strip().lower() for q in targets.split(",") if q.strip()]
        for quality in requested:
            preset = QUALITY_PRESETS.get(quality)
            if not preset:
                console.print(f"Skipping unknown quality '{quality}'")
                continue
            if preset.height > source_meta.height:
                console.print(f"Skipping {preset.label} because source is only {source_meta.height}p")
                continue
            plans.append(
                RenditionPlan(
                    name=quality,
                    preset=preset,
                    source=source,
                    metadata=source_meta,
                    transcode=True,
                )
            )
        if not plans:
            console.print("No valid renditions to process. Check --targets and source resolution.")
            raise typer.Exit(code=1)
    else:
        mapping = parse_variant_pairs(input_variant)
        for quality, path in mapping.items():
            meta = probe_video(path, ffprobe_bin)
            preset = QUALITY_PRESETS[quality]
            plans.append(
                RenditionPlan(
                    name=quality,
                    preset=preset,
                    source=path,
                    metadata=meta,
                    transcode=False,
                )
            )

    subtitle_pairs = _pair_subtitles(subtitle, subtitle_lang)

    _print_plan(plans, output_dir, subtitle_pairs)
    if interactive and not dry_run:
        confirm = typer.confirm("Proceed with FFmpeg processing?", default=True)
        if not confirm:
            raise typer.Exit()

    if dry_run:
        console.print("Dry run complete. No commands executed.")
        raise typer.Exit()

    _execute_plans(plans, ffmpeg_bin, output_dir, logs_dir)
    thumb_source = plans[0].source
    thumbnail_path = output_dir / "thumbnails" / "poster.jpg"
    thumbnail_path.parent.mkdir(exist_ok=True)
    capture_thumbnail(thumb_source, thumbnail_path, ffmpeg_bin)

    subtitle_entries = _process_subtitles(subtitle_pairs, ffmpeg_bin, output_dir, logs_dir)
    segment_counts = _count_segments(plans, output_dir)
    master_path = _write_master_manifest(plans, output_dir)
    metadata_path = _write_metadata(plans, output_dir, segment_counts, subtitle_entries)

    _print_summary(master_path, thumbnail_path, metadata_path, subtitle_entries)
    console.print("✅ Processing complete. Ready for upload.")


def _pair_subtitles(files: List[Path], langs: List[str]) -> List[tuple[Path, str]]:
    files = files or []
    langs = langs or []
    if len(files) != len(langs):
        raise typer.BadParameter("Provide matching --subtitle and --lang arguments")
    pairs: List[tuple[Path, str]] = []
    for file, lang in zip(files, langs):
        file_path = file.expanduser().resolve()
        if not file_path.exists():
            raise typer.BadParameter(f"Subtitle not found: {file_path}")
        pairs.append((file_path, lang))
    return pairs


def _print_plan(plans: List[RenditionPlan], output_dir: Path, subtitles: List[tuple[Path, str]]) -> None:
    table = Table(title="Processing Plan", show_lines=True)
    table.add_column("Quality")
    table.add_column("Source")
    table.add_column("Resolution")
    table.add_column("Mode")
    table.add_column("Target Dir")
    for plan in plans:
        table.add_row(
            plan.preset.label,
            str(plan.source.name),
            plan.metadata.resolution_label,
            "transcode" if plan.transcode else "segment-only",
            f"{output_dir}/{plan.name}",
        )
    console.print(table)
    if subtitles:
        sub_table = Table(title="Subtitles")
        sub_table.add_column("Language")
        sub_table.add_column("File")
        for file, lang in subtitles:
            sub_table.add_row(lang, str(file.name))
        console.print(sub_table)


def _execute_plans(plans: List[RenditionPlan], ffmpeg_bin: str, output_dir: Path, logs_dir: Path) -> None:
    with Progress(
        SpinnerColumn(),
        TextColumn("{task.description}"),
        BarColumn(),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        for plan in plans:
            task = progress.add_task(f"Processing {plan.preset.label}", total=None)
            try:
                _run_single_plan(plan, ffmpeg_bin, output_dir, logs_dir)
            finally:
                progress.update(task, completed=1)


def _run_single_plan(plan: RenditionPlan, ffmpeg_bin: str, output_dir: Path, logs_dir: Path) -> None:
    quality_dir = output_dir / plan.name
    quality_dir.mkdir(parents=True, exist_ok=True)
    playlist_path = quality_dir / "index.m3u8"
    segment_template = quality_dir / "segment_%05d.ts"
    log_path = logs_dir / f"{plan.name}.log"

    cmd = [
        ffmpeg_bin,
        "-y",
        "-i",
        str(plan.source),
    ]
    if plan.transcode:
        cmd += [
            "-vf",
            f"scale=-2:{plan.preset.height}",
            "-c:v",
            "h264",
            "-profile:v",
            "high",
            "-level",
            "4.1",
            "-b:v",
            f"{plan.preset.video_bitrate}k",
            "-maxrate",
            f"{int(plan.preset.video_bitrate * 1.07)}k",
            "-bufsize",
            f"{plan.preset.video_bitrate * 2}k",
            "-preset",
            "fast",
            "-c:a",
            "aac",
            "-b:a",
            f"{plan.preset.audio_bitrate}k",
        ]
    else:
        cmd += ["-c", "copy"]

    cmd += [
        "-hls_time",
        str(SEGMENT_LENGTH),
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        str(segment_template),
        str(playlist_path),
    ]

    run_ffmpeg(cmd, log_path)


def _count_segments(plans: List[RenditionPlan], output_dir: Path) -> Dict[str, int]:
    segment_counts: Dict[str, int] = {}
    for plan in plans:
        quality_dir = output_dir / plan.name
        segment_counts[plan.name] = len(list(quality_dir.glob("segment_*.ts")))
    return segment_counts


def _write_master_manifest(plans: List[RenditionPlan], output_dir: Path) -> Path:
    master_path = output_dir / "master.m3u8"
    lines = ["#EXTM3U"]
    for plan in plans:
        lines.append(
            f"#EXT-X-STREAM-INF:BANDWIDTH={plan.preset.bandwidth},RESOLUTION={plan.preset.resolution}"
        )
        lines.append(f"{plan.name}/index.m3u8")
    master_path.write_text("\n".join(lines) + "\n")
    return master_path


def _write_metadata(
    plans: List[RenditionPlan],
    output_dir: Path,
    segment_counts: Dict[str, int],
    subtitles: List[Dict[str, str]],
) -> Path:
    metadata = {
        "renditions": [
            {
                "quality": plan.preset.label,
                "playlist": f"{plan.name}/index.m3u8",
                "resolution": plan.preset.resolution,
                "segments": segment_counts.get(plan.name, 0),
                "video_bitrate_kbps": plan.preset.video_bitrate,
                "audio_bitrate_kbps": plan.preset.audio_bitrate,
                "mode": "transcode" if plan.transcode else "segment",
            }
            for plan in plans
        ],
        "subtitles": subtitles,
    }
    metadata_path = output_dir / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2))
    return metadata_path


def _process_subtitles(
    subtitle_pairs: List[tuple[Path, str]],
    ffmpeg_bin: str,
    output_dir: Path,
    logs_dir: Path,
) -> List[Dict[str, str]]:
    entries: List[Dict[str, str]] = []
    subtitles_dir = output_dir / "subtitles"
    subtitles_dir.mkdir(exist_ok=True)
    for source, lang in subtitle_pairs:
        output_path = subtitles_dir / f"{lang}.vtt"
        log_path = logs_dir / f"subtitle_{lang}.log"
        convert_subtitle_to_vtt(source, output_path, ffmpeg_bin, log_path)
        entries.append({"lang": lang, "path": str(output_path.relative_to(output_dir))})
    return entries


def _print_summary(
    master_path: Path,
    thumbnail_path: Path,
    metadata_path: Path,
    subtitles: List[Dict[str, str]],
) -> None:
    table = Table(title="Artifacts", show_lines=True)
    table.add_column("Type")
    table.add_column("Path")
    table.add_row("Master Playlist", str(master_path))
    table.add_row("Thumbnail", str(thumbnail_path))
    table.add_row("Metadata", str(metadata_path))
    console.print(table)
    if subtitles:
        sub_table = Table(title="Subtitle Tracks")
        sub_table.add_column("Language")
        sub_table.add_column("File")
        for entry in subtitles:
            sub_table.add_row(entry["lang"], entry["path"])
        console.print(sub_table)
