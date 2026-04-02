"""
tests/test_auth.py
───────────────────
Integration tests for authentication endpoints.
Uses TestClient + SQLite in-memory DB for speed (no MySQL needed for CI).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app

# ── In-memory test DB ─────────────────────────────────────────
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    # Seed roles
    from app.models.models import Role
    db = TestingSessionLocal()
    db.add(Role(id=1, name="user"))
    db.add(Role(id=2, name="admin"))
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


# ── Registration tests ────────────────────────────────────────
class TestRegister:
    def test_register_success(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "email": "alice@example.com",
            "password": "Str0ng!Pass",
            "first_name": "Alice",
            "last_name": "Smith",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "alice@example.com"
        assert "password" not in data
        assert "password_hash" not in data

    def test_register_duplicate_email(self, client):
        payload = {
            "email": "bob@example.com",
            "password": "Str0ng!Pass",
            "first_name": "Bob",
            "last_name": "Jones",
        }
        client.post("/api/v1/auth/register", json=payload)
        resp = client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 409

    def test_register_weak_password(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "email": "weak@example.com",
            "password": "password",     # no uppercase, digit, special
            "first_name": "Weak",
            "last_name": "Pass",
        })
        assert resp.status_code == 422

    def test_register_invalid_email(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "email": "not-an-email",
            "password": "Str0ng!Pass",
            "first_name": "A",
            "last_name": "B",
        })
        assert resp.status_code == 422

    def test_register_strips_html_from_name(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "email": "xss@example.com",
            "password": "Str0ng!Pass",
            "first_name": "<script>alert(1)</script>Alice",
            "last_name": "Smith",
        })
        assert resp.status_code == 201
        assert "<script>" not in resp.json()["first_name"]


# ── Login tests ───────────────────────────────────────────────
class TestLogin:
    def _register(self, client):
        client.post("/api/v1/auth/register", json={
            "email": "user@example.com",
            "password": "Str0ng!Pass",
            "first_name": "Test",
            "last_name": "User",
        })

    def test_login_success(self, client):
        self._register(client)
        resp = client.post("/api/v1/auth/login", json={
            "email": "user@example.com",
            "password": "Str0ng!Pass",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()
        assert "refresh_token" not in resp.json()          # must be in cookie
        assert "refresh_token" in resp.cookies

    def test_login_wrong_password(self, client):
        self._register(client)
        resp = client.post("/api/v1/auth/login", json={
            "email": "user@example.com",
            "password": "WrongPass!1",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": "ghost@example.com",
            "password": "Str0ng!Pass",
        })
        assert resp.status_code == 401

    def test_login_response_excludes_password(self, client):
        self._register(client)
        resp = client.post("/api/v1/auth/login", json={
            "email": "user@example.com",
            "password": "Str0ng!Pass",
        })
        body = resp.json()
        assert "password" not in body
        assert "password_hash" not in body


# ── Token refresh tests ───────────────────────────────────────
class TestRefreshToken:
    def _login(self, client):
        client.post("/api/v1/auth/register", json={
            "email": "user@example.com",
            "password": "Str0ng!Pass",
            "first_name": "T",
            "last_name": "U",
        })
        resp = client.post("/api/v1/auth/login", json={
            "email": "user@example.com",
            "password": "Str0ng!Pass",
        })
        return resp

    def test_refresh_returns_new_token(self, client):
        login_resp = self._login(client)
        old_token = login_resp.json()["access_token"]
        refresh_resp = client.post("/api/v1/auth/refresh-token")
        assert refresh_resp.status_code == 200
        new_token = refresh_resp.json()["access_token"]
        assert new_token != old_token

    def test_refresh_without_cookie_fails(self, client):
        resp = client.post("/api/v1/auth/refresh-token")
        assert resp.status_code == 401


# ── Protected route tests ─────────────────────────────────────
class TestProtectedRoutes:
    def test_me_without_token(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    def test_me_with_valid_token(self, client):
        client.post("/api/v1/auth/register", json={
            "email": "me@example.com",
            "password": "Str0ng!Pass",
            "first_name": "Me",
            "last_name": "User",
        })
        login = client.post("/api/v1/auth/login", json={
            "email": "me@example.com",
            "password": "Str0ng!Pass",
        })
        token = login.json()["access_token"]
        resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "me@example.com"

    def test_me_with_invalid_token(self, client):
        resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert resp.status_code == 401


# ── Input validation tests ────────────────────────────────────
class TestInputValidation:
    def test_sql_injection_in_email(self, client):
        resp = client.post("/api/v1/auth/login", json={
            "email": "' OR '1'='1",
            "password": "anything",
        })
        # Should fail validation (invalid email format), not execute SQL
        assert resp.status_code == 422

    def test_oversized_payload(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "email": "a@b.com",
            "password": "A" * 200,      # exceeds max_length=128
            "first_name": "X",
            "last_name": "Y",
        })
        assert resp.status_code == 422
