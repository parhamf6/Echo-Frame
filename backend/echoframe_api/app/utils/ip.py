from fastapi import Request


def extract_client_ip(request: Request) -> str:
    """Extract client IP from request, respecting X-Forwarded-For when present.

    - If `X-Forwarded-For` header exists, return the first entry (left-most).
    - Otherwise return `request.client.host`.

    Note: Only trust `X-Forwarded-For` when running behind a trusted proxy.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()

    if request.client:
        return request.client.host

    return "unknown"
