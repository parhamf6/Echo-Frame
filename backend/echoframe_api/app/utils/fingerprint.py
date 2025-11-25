"""Placeholder utilities for server-side fingerprint validation.

Planned usage:
- Frontend collects a fingerprint (e.g., via FingerprintJS) and sends it during login
  (e.g., header `X-Client-Fingerprint` or in login payload).
- Server can store fingerprint in refresh token claims or in Redis tied to the refresh jti.
- On refresh, server validates the incoming fingerprint matches the stored value.

This file contains small helpers to normalize/verify fingerprints. Actual
integration will depend on the frontend fingerprinting library and threat model.
"""
from typing import Optional


def normalize_fingerprint(fp: Optional[str]) -> Optional[str]:
    if not fp:
        return None
    # Minimal normalization: trim and lower
    return fp.strip()


def verify_fingerprint(stored: Optional[str], provided: Optional[str]) -> bool:
    if not stored or not provided:
        return False
    return normalize_fingerprint(stored) == normalize_fingerprint(provided)
