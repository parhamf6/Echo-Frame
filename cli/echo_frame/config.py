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
    try:
        return CLIConfig(**raw)
    except ValidationError as exc:
        raise ConfigError(str(exc)) from exc


def save_config(config: CLIConfig) -> None:
    ensure_config_dir()
    CONFIG_PATH.write_text(yaml.safe_dump(config.model_dump(exclude_none=True), sort_keys=False))


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
