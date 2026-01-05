import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
import importlib.util
import os
import sys
import types

# Import the livekit_webhook module directly by file path to avoid importing package-level
# modules that register background tasks during module import.
here = os.path.dirname(__file__)
module_path = os.path.join(here, '..', 'api', 'v1', 'livekit_webhook.py')
spec = importlib.util.spec_from_file_location("livekit_webhook", os.path.abspath(module_path))
livekit_mod = importlib.util.module_from_spec(spec)
# Prevent importing heavy service modules that register background tasks during import
if 'app.services' not in sys.modules:
    sys.modules['app.services'] = types.ModuleType('app.services')
    # Provide minimal attributes expected by imports during tests
    sys.modules['app.services'].rate_limit_service = types.SimpleNamespace()
    sys.modules['app.services'].ip_tracking_service = types.SimpleNamespace()

spec.loader.exec_module(livekit_mod)
livekit_router = livekit_mod.router


@pytest.fixture
def test_client():
    # Create a small FastAPI instance with only the livekit webhook router to avoid app-wide side-effects
    app = FastAPI()
    # Mount with the same path as production: /api/v1/livekit
    app.include_router(livekit_router, prefix="/api/v1/livekit")
    return TestClient(app)
