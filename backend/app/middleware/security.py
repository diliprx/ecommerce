"""
app/middleware/security.py
───────────────────────────
Custom ASGI middleware that adds:
  1. Unique request ID for tracing
  2. Security headers (OWASP recommendations)
  3. Request/response logging (sanitized — no auth headers)

Security headers applied:
  • X-Content-Type-Options: nosniff          → MIME sniffing prevention
  • X-Frame-Options: DENY                    → Clickjacking protection
  • Strict-Transport-Security               → Force HTTPS
  • Content-Security-Policy                 → XSS mitigation
  • Referrer-Policy                         → Leak prevention
  • Permissions-Policy                      → Feature restriction
"""
import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.utils.logger import get_logger

logger = get_logger(__name__)

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self';"
    ),
}

# Headers to never log (sensitive)
_REDACTED_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key"}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid4())
        start = time.perf_counter()

        # Attach request ID so handlers can reference it
        request.state.request_id = request_id

        response: Response = await call_next(request)

        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        # Apply security headers
        for header, value in _SECURITY_HEADERS.items():
            response.headers[header] = value
        response.headers["X-Request-Id"] = request_id

        # Structured access log (no sensitive headers)
        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
            request_id=request_id,
        )

        return response
