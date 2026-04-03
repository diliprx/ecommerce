"""
app/main.py
────────────
FastAPI application factory with all middleware, routers, and error handlers.

Architecture decisions:
  • CORS restricted to ALLOWED_ORIGINS env var (not wildcard)
  • Rate limiter applied globally, stricter on auth routes
  • Global exception handler catches unhandled errors and logs them
    without exposing stack traces to the client
  • Lifespan used for startup/shutdown hooks (SQLAlchemy pool warm-up)
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api.v1.endpoints import auth, cart, orders, products, webhooks
from app.core.config import get_settings
from app.db.session import engine
from app.middleware.security import SecurityHeadersMiddleware
from app.utils.logger import get_logger, setup_logging

settings = get_settings()
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", env=settings.APP_ENV)
    # Verify DB connectivity on startup
    with engine.connect() as conn:
        from sqlalchemy import text
        conn.execute(text("SELECT 1"))
    logger.info("db_connected")
    yield
    logger.info("shutdown")
    engine.dispose()


# ── Rate limiter ──────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── App instance ──────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/api/docs" if not settings.APP_ENV == "production" else None,
    redoc_url="/api/redoc" if not settings.APP_ENV == "production" else None,
    openapi_url="/api/openapi.json" if not settings.APP_ENV == "production" else None,
    lifespan=lifespan,
)

# ── State ─────────────────────────────────────────────────────
app.state.limiter = limiter

# ── Middleware (order matters — outermost first) ──────────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)
origins = [
    "http://localhost:3000",  # Next.js default
    "http://localhost:3001",  # Next.js custom port (current)
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,              # required for HTTP-only cookie
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"],
    max_age=600,
)

# ── Routers ───────────────────────────────────────────────────
API_PREFIX = "/api/v1"
app.include_router(auth.router,      prefix=API_PREFIX)
app.include_router(products.router,  prefix=API_PREFIX)
app.include_router(cart.router,      prefix=API_PREFIX)
app.include_router(orders.router,    prefix=API_PREFIX)
app.include_router(webhooks.router,  prefix=API_PREFIX)

# ── Exception handlers ────────────────────────────────────────
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Too many requests. Please slow down.", "code": "RATE_LIMITED"},
    )


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Return structured validation errors without internal stack traces."""
    errors = [
        {"field": ".".join(str(loc) for loc in err["loc"]), "message": err["msg"]}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation failed", "errors": errors},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Catch-all — log full exception internally, return generic message to client.
    Never expose stack traces in production.
    """
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "unhandled_exception",
        exc_info=exc,
        path=request.url.path,
        method=request.method,
        request_id=request_id,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred.",
            "code": "INTERNAL_ERROR",
            "request_id": request_id,
        },
    )

from app.core.config import get_settings

settings = get_settings()

print("ENV CHECK:", settings.DB_USER, settings.DB_NAME)

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
