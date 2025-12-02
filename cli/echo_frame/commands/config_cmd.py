from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from ..config import CLIConfig, load_config, save_config, update_config

console = Console()
config_app = typer.Typer(help="Manage Echo Frame CLI configuration")


@config_app.command("init")
def init_config(
    server_url: Optional[str] = typer.Option(None, help="Server base URL"),
    admin_token: Optional[str] = typer.Option(None, help="Admin JWT token"),
    ffmpeg_path: Optional[Path] = typer.Option(None, help="Path to ffmpeg binary"),
) -> None:
    """Interactively create or update the CLI config file."""

    existing = load_config()
    server_url = server_url or typer.prompt(
        "Server URL", default=str(existing.server_url or ""), show_default=False
    ) or None
    admin_token = admin_token or typer.prompt(
        "Admin token", default=existing.admin_token or "", show_default=False
    ) or None
    ffmpeg_path = ffmpeg_path or Path(
        typer.prompt(
            "FFmpeg path (leave blank to auto-detect)",
            default=str(existing.ffmpeg_path or ""),
            show_default=False,
        )
        or ""
    )
    if ffmpeg_path == Path(""):
        ffmpeg_path = None

    config = CLIConfig(server_url=server_url, admin_token=admin_token, ffmpeg_path=ffmpeg_path)
    save_config(config)
    console.print("✅ Config saved to ~/.echo-frame/config.yaml")


@config_app.command("show")
def show_config(mask: bool = typer.Option(True, help="Mask sensitive fields")) -> None:
    """Display current configuration values."""

    config = load_config()
    data = config.masked_dict() if mask else config.model_dump()
    table = Table(title="Echo Frame CLI Config", show_lines=True)
    table.add_column("Key")
    table.add_column("Value")
    for key, value in data.items():
        table.add_row(key, str(value))
    console.print(table)


@config_app.command("set")
def set_value(
    key: str = typer.Argument(..., help="Field name: server_url | admin_token | ffmpeg_path"),
    value: str = typer.Argument(..., help="New value"),
) -> None:
    """Set a single configuration value."""

    key = key.lower()
    if key not in {"server_url", "admin_token", "ffmpeg_path"}:
        raise typer.BadParameter("Unsupported key")

    if key == "ffmpeg_path":
        updated = update_config(ffmpeg_path=Path(value))
    elif key == "server_url":
        updated = update_config(server_url=value)
    else:
        updated = update_config(admin_token=value)

    console.print(f"Updated {key}")
    if key == "admin_token":
        console.print("(value hidden)")
    else:
        console.print(getattr(updated, key))
