import base64
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
from jose import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


class LiveKitService:
    """Minimal LiveKit helper for token generation and data messages."""

    def __init__(self):
        self.host = settings.LIVEKIT_HOST.rstrip("/")
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET

    def _room_name(self, room_id: str) -> str:
        return f"room_{room_id}"

    def _basic_auth_header(self) -> str:
        return f"Bearer {self.api_key}:{self.api_secret}"

    def _encode_data(self, data: dict) -> str:
        """LiveKit SendData expects base64-encoded bytes."""
        return base64.b64encode(json.dumps(data).encode("utf-8")).decode("utf-8")

    async def send_data_message(self, room_id: str, data: Dict[str, Any], reliable: bool = True) -> None:
        """
        Broadcast a data message to a room via LiveKit RoomService.
        Uses the Twirp HTTP endpoint so we don't need gRPC stubs.
        """
        url = f"{self.host}/twirp/livekit.RoomService/SendData"
        payload = {
            "room": self._room_name(room_id),
            "data": self._encode_data(data),
            "kind": "RELIABLE" if reliable else "LOSSY",
        }

        headers = {"Authorization": self._basic_auth_header()}

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code != 200:
                    logger.error(f"[LiveKit] SendData failed: {resp.status_code} {resp.text}")
        except Exception as e:
            logger.error(f"[LiveKit] SendData exception: {e}")

    def generate_token(self, room_id: str, guest_id: str, username: str, can_voice: bool, role: str) -> str:
        """
        Generate a LiveKit access token (HS256 JWT) without external SDK.
        """
        now = datetime.now(timezone.utc)
        exp = now + timedelta(hours=4)

        claims = {
            "iss": self.api_key,
            "sub": guest_id,
            "name": username,
            "video": {
                "room": self._room_name(room_id),
                "room_join": True,
                "room_list": False,
                "can_publish": bool(can_voice),
                "can_subscribe": True,
                "can_publish_data": True,
                "can_publish_sources": ["mic"] if can_voice else [],
            },
            "metadata": json.dumps({"username": username, "role": role}),
            "nbf": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        }

        token = jwt.encode(claims, self.api_secret, algorithm="HS256")
        return token

    def verify_webhook(self, provided_secret: Optional[str]) -> bool:
        """Simple shared-secret verification for webhook calls."""
        if not provided_secret:
            return False
        return hmac.compare_digest(provided_secret, settings.LIVEKIT_WEBHOOK_SECRET)

