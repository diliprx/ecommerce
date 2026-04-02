# app/utils/jwt.py
import os
from datetime import datetime, timedelta
from jose import jwt, JWTError

ACCESS_TOKEN_SECRET = os.environ.get("ACCESS_TOKEN_SECRET", "supersecretaccess")
REFRESH_TOKEN_SECRET = os.environ.get("REFRESH_TOKEN_SECRET", "supersecretrefresh")

ACCESS_TOKEN_EXPIRE_MINUTES = 15  # default short-lived
REFRESH_TOKEN_EXPIRE_DAYS = 7     # long-lived

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Generate JWT access token with optional custom expiration"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, ACCESS_TOKEN_SECRET, algorithm="HS256")
    return token

def create_refresh_token(data: dict) -> str:
    """Generate JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, REFRESH_TOKEN_SECRET, algorithm="HS256")
    return token

def verify_refresh_token(token: str) -> dict:
    """Verify refresh token and return payload"""
    try:
        payload = jwt.decode(token, REFRESH_TOKEN_SECRET, algorithms=["HS256"])
        return payload
    except JWTError:
        raise ValueError("Invalid refresh token")