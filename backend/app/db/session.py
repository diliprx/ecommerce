"""
app/db/session.py
─────────────────
SQLAlchemy 2.0 async-compatible session factory.

Security: connection pool + SSL can be enabled via ssl_ca / ssl_cert params.
Performance: pool_pre_ping avoids stale connections; pool_recycle keeps MySQL
             from closing idle connections (MySQL default wait_timeout = 8h).
"""
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,        # checks connection health before use
    pool_recycle=3600,         # recycle after 1 h → avoids MySQL timeout drops
    pool_size=10,
    max_overflow=20,
    echo=settings.APP_DEBUG,   # log SQL only in debug mode
    future=True,               # SQLAlchemy 2.0 style
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,    # avoids lazy-load after commit in API responses
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
