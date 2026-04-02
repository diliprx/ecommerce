"""app/db/base.py — Declarative base shared by all models."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
