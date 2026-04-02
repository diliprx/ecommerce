# """
# app/api/v1/endpoints/auth.py
# ─────────────────────────────
# Auth endpoints with rate limiting and HTTP-only cookie for refresh token.

# Security:
#   • /login is rate-limited (5 req/min per IP) — brute force protection
#   • Refresh token sent as HTTP-only, Secure, SameSite=strict cookie
#     → inaccessible to JavaScript → XSS resistant
#   • Access token returned in JSON body (stored in memory on frontend)
# """
# from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
# from slowapi import Limiter
# from slowapi.util import get_remote_address
# from sqlalchemy.orm import Session

# from app.api.deps import CurrentUser, DB
# from app.schemas.schemas import (
#     LoginRequest,
#     RefreshRequest,
#     RegisterRequest,
#     TokenResponse,
#     UserOut,
# )
# from app.services.services import AuthService

# router = APIRouter(prefix="/auth", tags=["auth"])
# limiter = Limiter(key_func=get_remote_address)

# _RT_COOKIE = "refresh_token"
# _COOKIE_OPTS = dict(
#     httponly=True,
#     secure=True,           # HTTPS only in production
#     samesite="strict",     # CSRF protection
#     max_age=7 * 24 * 3600,
#     path="/api/v1/auth",   # scope to auth routes only
# )


# @router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
# @limiter.limit("10/minute")
# async def register(request: Request, body: RegisterRequest, db: DB):
#     """Register a new user. Email must be unique."""
#     svc = AuthService(db)
#     return svc.register(body)


# @router.post("/login", response_model=TokenResponse)
# @limiter.limit("5/minute")
# async def login(request: Request, response: Response, body: LoginRequest, db: DB):
#     """
#     Authenticate. Returns access token in body + refresh token in HTTP-only cookie.
#     Rate-limited to 5 attempts/min per IP.
#     """
#     svc = AuthService(db)
#     token_resp, raw_rt = svc.login(body)
#     response.set_cookie(_RT_COOKIE, raw_rt, **_COOKIE_OPTS)
#     return token_resp


# @router.post("/refresh-token", response_model=TokenResponse)
# @limiter.limit("20/minute")
# async def refresh_token(request: Request, response: Response, db: DB):
#     """
#     Rotate refresh token. Old token is revoked, new pair issued.
#     Reads the refresh token from the HTTP-only cookie (not body) for CSRF safety.
#     """
#     raw_rt = request.cookies.get(_RT_COOKIE)
#     if not raw_rt:
#         raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token missing")
#     svc = AuthService(db)
#     token_resp, new_raw_rt = svc.refresh(raw_rt)
#     response.set_cookie(_RT_COOKIE, new_raw_rt, **_COOKIE_OPTS)
#     return token_resp


# @router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
# async def logout(response: Response, current_user: CurrentUser, db: DB):
#     """Revoke all refresh tokens for the user and clear the cookie."""
#     svc = AuthService(db)
#     svc.logout(current_user.id)
#     response.delete_cookie(_RT_COOKIE, path="/api/v1/auth")


# @router.get("/me", response_model=UserOut)
# async def me(current_user: CurrentUser):
#     """Return current user profile. Requires valid access token."""
#     return UserOut(
#         id=current_user.id,
#         email=current_user.email,
#         first_name=current_user.first_name,
#         last_name=current_user.last_name,
#         role=current_user.role.name if current_user.role else "user",
#         is_active=current_user.is_active,
#         created_at=current_user.created_at,
#     )

"""
app/api/v1/endpoints/auth.py
─────────────────────────────
Auth endpoints with secure JWT tokens, HTTP-only refresh cookies, and rate limiting.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.api.deps import DB, CurrentUser
from app.schemas.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.services.services import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

# Refresh token cookie settings
_RT_COOKIE = "refresh_token"
_COOKIE_OPTS = dict(
    httponly=True,
    secure=False,           # True in production (HTTPS)
    samesite="strict",
    max_age=7 * 24 * 3600, # 7 days
    path="/api/v1/auth",
)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(request: Request, body: RegisterRequest, db: DB):
    """
    Register a new user with unique email and hashed password.
    """
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    hashed_pw = bcrypt.hash(body.password)
    user = User(
        email=body.email,
        password_hash=hashed_pw,
        first_name=body.first_name,
        last_name=body.last_name,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role.name if user.role else "user",
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, response: Response, body: LoginRequest, db: DB):
    """
    Authenticate user: returns access token + refresh token cookie (secure HTTP-only).
    """
    svc = AuthService(db)
    token_resp, raw_rt = svc.login(body)
    response.set_cookie(_RT_COOKIE, raw_rt, **_COOKIE_OPTS)
    return token_resp


@router.post("/refresh-token", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh_token(request: Request, response: Response, db: DB):
    """
    Rotate refresh token securely via service (DB revocation).
    """
    raw_rt = request.cookies.get(_RT_COOKIE)
    if not raw_rt:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")
    
    svc = AuthService(db)
    token_resp, new_raw_rt = svc.refresh(raw_rt)
    response.set_cookie(_RT_COOKIE, new_raw_rt, **_COOKIE_OPTS)
    return token_resp


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, current_user: CurrentUser, db: DB):
    """
    Secure logout: revoke all user refresh tokens + clear cookie.
    """
    svc = AuthService(db)
    svc.logout(current_user.id)
    response.delete_cookie(_RT_COOKIE, path="/api/v1/auth")


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser):
    """
    Return current user profile. Requires valid access token.
    """
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=current_user.role.name if current_user.role else "user",
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )