# Echo Frame CLI

Local-first toolkit for preparing Echo Frame watch-party assets. Use it to transcode or segment HLS ladders, convert subtitles, capture thumbnails, and (soon) upload bundles to the backend without burning server resources.

---

## Table of Contents
- Overview
- Prerequisites
- Installation
- Configuration
- Command Reference
  - `process run`
  - `upload run`
  - `config` commands
- Processing Modes & Outputs
- Subtitle Workflow
- Testing & Development
- Troubleshooting

---

## Overview
- **Why**: HLS generation is CPU intensive. Running FFmpeg locally/colab keeps backend costs low and gives admins control over the pipeline.
- **What you get**: 
  - Auto-generated HLS master + variant playlists (`master.m3u8`, `quality/index.m3u8`)
  - `.ts` segments per variant, metadata JSON, thumbnail, and converted subtitles
  - Rich-powered CLI UX suitable for both devs and non‑dev operators
  - Configurable upload command placeholder ready for backend integration
- **Where outputs live**: inside an `output_dir` you choose (default `processed_video/`), structured as:
  ```
  processed_video/
    master.m3u8
    1080/
      index.m3u8
      segment_00001.ts
      ...
    720/
    480/
    360/
    subtitles/
      en.vtt
      es.vtt
    thumbnails/poster.jpg
    metadata.json
    logs/*.log
  ```

---

## Prerequisites
- **Python**: 3.10+ (same version as backend virtualenv works fine).
- **FFmpeg + FFprobe**: install via package manager or download binaries.
  - Ubuntu: `sudo apt install ffmpeg`
  - macOS: `brew install ffmpeg`
  - Windows: download from https://ffmpeg.org/ and add to `PATH`.
- **Optional**: `virtualenv` or `pyenv` to isolate dependencies.

The CLI checks for `ffmpeg` and `ffprobe`. Set a custom binary path via config if needed.

---

## Installation
1. Navigate to the repo root.
2. (Optional) create & activate a virtualenv.
3. Install the CLI in editable mode:
   ```bash
   cd /home/parhamf/codes/Echo-Frame/cli
   pip install -e .
   ```
4. Verify:
   ```bash
   echo-frame --help
   ```

---

## Configuration
Configuration lives in `~/.echo-frame/config.yaml`. Manage it via CLI commands:

- `echo-frame config init`
  - Prompts for `server_url`, `admin_token`, `ffmpeg_path`. Hit enter to keep existing values.
- `echo-frame config show`
  - Displays current settings (token masked by default).
- `echo-frame config set server_url https://api.example.com`
  - Quickly update a single field.

Fields:
- `server_url`: backend base URL (used by upload command once wired).
- `admin_token`: JWT used for authenticated uploads.
- `ffmpeg_path`: optional absolute path to FFmpeg binary. Leave blank to auto-detect.

---

## Command Reference

### `echo-frame process run`
Process video inputs into an HLS package.

Common flags:
- `--source PATH`: single high-quality input. CLI transcodes down to requested ladder.
- `--input QUALITY=PATH`: repeat per variant for segment-only mode (no re-encoding).
- `--targets "1080,720,480,360"`: ladder for transcode mode. Higher tiers than the source resolution are skipped automatically.
- `--output-dir PATH`: target directory (default `processed_video`).
- `--subtitle PATH --lang en`: repeatable pairs for subtitle conversion.
- `--interactive/--no-interactive`: toggle confirmation prompts (default interactive).
- `--dry-run`: show plan without running FFmpeg.

Example (transcode):
```bash
echo-frame process run \
  --source ~/videos/talk.mp4 \
  --targets "1080,720,480" \
  --subtitle captions_en.srt --lang en \
  --subtitle captions_es.srt --lang es
```

Example (segment-only):
```bash
echo-frame process run \
  --input 1080=~/exports/talk_1080.mp4 \
  --input 720=~/exports/talk_720.mp4 \
  --output-dir ./processed_video
```

Outputs:
- Variant directories with `index.m3u8` + `.ts`
- `master.m3u8`
- `thumbnails/poster.jpg`
- `metadata.json`
- `subtitles/{lang}.vtt`
- Logs under `logs/*.log`

### `echo-frame upload run`
Stub command that previews upload configuration and directory. Once backend endpoints are finalized, this will perform the multipart upload with progress bars.

Usage:
```bash
echo-frame upload run ./processed_video --dry-run
```

### `echo-frame config ...`
- `config init`: interactive setup
- `config show --no-mask`: print raw values
- `config set admin_token <token>`: update single fields

---

## Processing Modes & Outputs
| Mode            | Trigger                     | Behavior                                                   |
|-----------------|-----------------------------|------------------------------------------------------------|
| Transcode       | `--source`                  | Scales/resamples to requested ladder, generates segments   |
| Segment-only    | `--input quality=path` pairs| Uses pre-encoded files, segments with `-c copy`            |

Quality presets (defaults):
| Label | Resolution  | Video bitrate | Audio bitrate |
|-------|-------------|---------------|---------------|
| 1080p | 1920x1080   | 5000 kbps     | 192 kbps      |
| 720p  | 1280x720    | 3000 kbps     | 128 kbps      |
| 480p  | 854x480     | 1400 kbps     | 128 kbps      |
| 360p  | 640x360     | 800 kbps      | 96 kbps       |

Metadata (`metadata.json`) includes rendition info, playlist paths, bitrates, segment counts, and subtitle descriptors to feed the backend.

---

## Subtitle Workflow
1. Pass each subtitle file with a matching `--lang` (ISO code recommended).
2. CLI converts formats (`.srt`, `.vtt`, `.ass`) to `.vtt` via FFmpeg.
3. Converted files live under `subtitles/{lang}.vtt`.
4. Metadata lists available tracks for frontend auto-loading.

If you forget a language code or a file is missing, the CLI exits with an actionable error before processing video.

---

## Testing & Development
- **Unit tests (future)**: add `pytest` suites under `cli/tests/` to mock `subprocess` and validate command planning.
- **Manual testing**:
  1. Run `echo-frame process run --dry-run` with sample inputs to verify detection.
  2. Execute full processing on a short clip to confirm output layout.
  3. Open `metadata.json` and `master.m3u8` to ensure references are relative.
  4. Validate subtitles in a Video.js player (drop `master.m3u8` into a local server).
- **Logging**: inspect `logs/*.log` for raw FFmpeg output when debugging.

---

## Troubleshooting
- **FFmpeg not found**: install system package or set `echo-frame config set ffmpeg_path /abs/path/to/ffmpeg`.
- **Output dir not empty**: CLI refuses to overwrite; either point to a new folder or manually clear it.
- **Resolution mismatch**: if a requested ladder tier exceeds source height, it’s skipped with a warning.
- **Subtitle count mismatch**: ensure every `--subtitle` has a corresponding `--lang`.
- **Slow processing**: use `--targets "720,480,360"` to skip 1080p or run on a machine with more CPU cores.
- **Upload pending**: until backend endpoint is ready, the `upload run` command only previews configs.

For additional questions, check Rich/ Typer docs or reach out to the Echo Frame backend team.
