from __future__ import annotations

import typer

from .commands.config_cmd import config_app
from .commands.process import process_app
from .commands.upload import upload_app

app = typer.Typer(help="Echo Frame CLI utilities")
app.add_typer(config_app, name="config")
app.add_typer(process_app, name="process")
app.add_typer(upload_app, name="upload")


if __name__ == "__main__":  # pragma: no cover
    app()
