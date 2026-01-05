import base64
import hashlib
import hmac
import json

from app.core.livekit_service import LiveKitService
from app.core.config import settings


def _expected_signature(body: bytes) -> str:
    sig = hmac.new(settings.LIVEKIT_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return sig


def test_verify_webhook_bearer_hex():
    svc = LiveKitService()
    body = b'{"event":"test"}'
    sig = _expected_signature(body)

    assert svc.verify_webhook(body, f"Bearer {sig}") is True


def test_verify_webhook_bare_hex():
    svc = LiveKitService()
    body = b'{"event":"test"}'
    sig = _expected_signature(body)

    assert svc.verify_webhook(body, sig) is True


def test_verify_webhook_signature_prefix():
    svc = LiveKitService()
    body = b'{"event":"test"}'
    sig = _expected_signature(body)

    assert svc.verify_webhook(body, f"Signature {sig}") is True


def test_verify_webhook_sha256_prefix():
    svc = LiveKitService()
    body = b'{"event":"test"}'
    sig = _expected_signature(body)

    assert svc.verify_webhook(body, f"sha256={sig}") is True


def test_verify_webhook_v1_prefix():
    svc = LiveKitService()
    body = b'{"event":"test"}'
    sig = _expected_signature(body)

    assert svc.verify_webhook(body, f"v1={sig}") is True


def test_livekit_webhook_accepts_alt_header(test_client):
    # Use TestClient fixture to call the real endpoint
    body = b'{"event":"not_interested"}'
    sig = _expected_signature(body)

    headers = {
        "LiveKit-Signature": sig
    }

    resp = test_client.post("/api/v1/livekit/webhook", data=body, headers=headers)
    assert resp.status_code == 200
    assert resp.json().get("detail") == "ignored"


def test_livekit_webhook_accepts_x_alt_header(test_client):
    body = b'{"event":"not_interested"}'
    sig = _expected_signature(body)

    headers = {
        "X-LiveKit-Signature": f"sha256={sig}"
    }

    resp = test_client.post("/api/v1/livekit/webhook", data=body, headers=headers)
    assert resp.status_code == 200
    assert resp.json().get("detail") == "ignored"


def test_verify_webhook_base64_accepts():
    svc = LiveKitService()
    body = b'{"event":"test"}'
    sig_hex = _expected_signature(body)
    sig_b64 = base64.b64encode(bytes.fromhex(sig_hex)).decode()

    assert svc.verify_webhook(body, f"Bearer {sig_b64}") is True


def test_verify_webhook_mismatch_returns_false():
    svc = LiveKitService()
    body = b'{"event":"test"}'
    assert svc.verify_webhook(body, "Bearer deadbeef") is False


def test_verify_webhook_mismatch_logs_debug(caplog):
    svc = LiveKitService()
    body = b'{"event":"test"}'
    caplog.clear()

    # Ensure DEBUG is on for preview logging
    assert svc.verify_webhook(body, "Bearer deadbeef") is False
    logs = "\n".join(r.message for r in caplog.records)
    assert "Webhook signature mismatch" in logs
    # Check that the masked preview was logged (development-only)
    assert "provided=" in logs or "expected_hex_prefix" in logs


def test_data_received_prefers_metadata(test_client):
    # Build a data_received event where participant.metadata contains guest_id
    participant = {
        "identity": "admin_123-abcd",
        "name": "AdminUser",
        "metadata": json.dumps({"guest_id": "admin_123", "username": "AdminUser"})
    }

    payload = {
        "event": "data_received",
        "room": {"name": "room_abc"},
        "participant": participant,
        "data_packet": {"data": json.dumps({"type": "chat:message", "message": "hello"})}
    }

    body = json.dumps(payload).encode()
    sig = _expected_signature(body)

    headers = {"LiveKit-Signature": sig}

    resp = test_client.post("/api/v1/livekit/webhook", data=body, headers=headers)
    assert resp.status_code == 200
    assert resp.json().get("status") == "ok"


def test_generate_token_includes_session_identity():
    svc = LiveKitService()
    # The method is async; run it on a fresh loop
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    token_data = loop.run_until_complete(svc.generate_token(
        room_id="abc",
        guest_id="guest_42",
        username="TestUser",
        can_voice=False,
        can_chat=True,
        role="viewer"
    ))
    loop.close()

    token = token_data.get("token")
    assert token and isinstance(token, str)

    # Decode JWT payload without verifying signature
    import base64
    parts = token.split('.')
    assert len(parts) >= 2
    payload_b64 = parts[1]
    # Fix padding
    payload_b64 += '=' * ((4 - len(payload_b64) % 4) % 4)
    payload_json = base64.urlsafe_b64decode(payload_b64.encode())
    payload = json.loads(payload_json)

    # Metadata should be present and contain guest_id and session_identity
    metadata_str = payload.get('metadata') or payload.get('meta') or payload.get('m')
    assert metadata_str, f"metadata not found in token payload: {payload}"
    meta = json.loads(metadata_str)
    assert meta.get('guest_id') == 'guest_42'
    session_identity = meta.get('session_identity')
    assert session_identity and session_identity.startswith('guest_42-')
