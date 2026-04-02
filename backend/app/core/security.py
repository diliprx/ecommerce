"""
app/core/security.py
────────────────────
All cryptographic operations live here:
  • Password hashing / verification (bcrypt)
  • JWT access token creation / decoding
  • Refresh token generation and hashing (SHA-256)

Security decisions:
  • bcrypt with cost factor 12 — resists brute force
  • Access tokens: short-lived (15 min), signed HS256
  • Refresh tokens: random 256-bit secret → stored as SHA-256 hash
    (so a DB breach doesn't yield usable tokens)
  • JWTs include jti (JWT ID) for future revocation lists
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

# ── Password hashing ─────────────────────────────────────────
_pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,          # OWASP: min 10; 12 balances cost/UX
)


def hash_password(plain: str) -> str:
    """Return bcrypt hash. Never store plain passwords."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time comparison — prevents timing attacks."""
    return _pwd_context.verify(plain, hashed)


# ── JWT access tokens ────────────────────────────────────────
def create_access_token(
    subject: str,          # user id as string
    role: str,
    extra_claims: Optional[dict] = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "role": role,
        "jti": str(uuid4()),   # unique token id for revocation
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Raises jose.JWTError on invalid/expired tokens.
    Caller must handle the exception and return 401.
    """
    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    if payload.get("type") != "access":
        raise JWTError("Token type mismatch")
    return payload


# ── Refresh tokens ───────────────────────────────────────────
def generate_refresh_token() -> tuple[str, str]:
    """
    Returns (raw_token, sha256_hash).
    Store the HASH in DB; send the raw token to the client via HTTP-only cookie.
    """
    raw = secrets.token_urlsafe(64)       # 512-bit entropy
    hashed = _hash_token(raw)
    return raw, hashed


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def hash_refresh_token(raw: str) -> str:
    return _hash_token(raw)
