from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, ValidationError

CONFIG_DIR = Path.home() / ".echo-frame"
CONFIG_PATH = CONFIG_DIR / "config.yaml"


class ConfigError(RuntimeError):
    """Raised when the CLI configuration cannot be loaded or validated."""


class CLIConfig(BaseModel):
    server_url: Optional[AnyHttpUrl] = None
    admin_token: Optional[str] = None
    ffmpeg_path: Optional[Path] = None

    model_config = ConfigDict(extra="allow")

    def masked_dict(self) -> dict[str, Any]:
        data = self.model_dump()
        # Convert Pydantic types to strings for display
        if 'server_url' in data and data['server_url'] is not None:
            data['server_url'] = str(data['server_url'])
        if 'ffmpeg_path' in data and data['ffmpeg_path'] is not None:
            data['ffmpeg_path'] = str(data['ffmpeg_path'])
        token = data.get("admin_token")
        if token:
            data["admin_token"] = f"{token[:4]}***{token[-4:]}" if len(token) > 8 else "***"
        return data


def ensure_config_dir() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> CLIConfig:
    ensure_config_dir()
    if CONFIG_PATH.exists():
        raw = yaml.safe_load(CONFIG_PATH.read_text()) or {}
    else:
        raw = {}
    
    # Validate and clean ffmpeg_path if it's set to an invalid value (e.g., URL)
    if 'ffmpeg_path' in raw and raw['ffmpeg_path']:
        ffmpeg_path_str = str(raw['ffmpeg_path'])
        # If it looks like a URL or invalid value, clear it
        if ffmpeg_path_str.startswith(("http://", "https://", "Server URL:")):
            raw['ffmpeg_path'] = None
    
    try:
        return CLIConfig(**raw)
    except ValidationError as exc:
        raise ConfigError(str(exc)) from exc


def save_config(config: CLIConfig) -> None:
    ensure_config_dir()
    # Convert Pydantic types to YAML-serializable values
    data = config.model_dump(exclude_none=True)
    # Convert AnyHttpUrl to string and Path to string
    if 'server_url' in data and data['server_url'] is not None:
        data['server_url'] = str(data['server_url'])
    if 'ffmpeg_path' in data and data['ffmpeg_path'] is not None:
        data['ffmpeg_path'] = str(data['ffmpeg_path'])
    CONFIG_PATH.write_text(yaml.safe_dump(data, sort_keys=False))


def update_config(**updates: Any) -> CLIConfig:
    config = load_config()
    data = config.model_dump()
    data.update({k: v for k, v in updates.items() if v is not None})
    new_config = CLIConfig(**data)
    save_config(new_config)
    return new_config


def config_as_json(pretty: bool = False) -> str:
    config = load_config()
    dump = config.model_dump()
    return json.dumps(dump, indent=2 if pretty else None)
