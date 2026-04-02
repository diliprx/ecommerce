"""
tests/test_products_cart.py
────────────────────────────
Tests for product listing, filtering, and cart operations.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.models import Category, Product, Role

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
    db = TestingSessionLocal()
    db.add(Role(id=1, name="user"))
    db.add(Role(id=2, name="admin"))
    cat = Category(id=1, name="Electronics", slug="electronics")
    db.add(cat)
    db.flush()
    db.add(Product(
        id=1, category_id=1, name="Test Phone", slug="test-phone",
        price=299.99, stock=50, is_active=True,
    ))
    db.add(Product(
        id=2, category_id=1, name="Test Laptop", slug="test-laptop",
        price=999.00, stock=0, is_active=True,
    ))
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def auth_headers(client):
    client.post("/api/v1/auth/register", json={
        "email": "cart@example.com",
        "password": "Str0ng!Pass",
        "first_name": "Cart",
        "last_name": "User",
    })
    resp = client.post("/api/v1/auth/login", json={
        "email": "cart@example.com",
        "password": "Str0ng!Pass",
    })
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


class TestProducts:
    def test_list_products_public(self, client):
        resp = client.get("/api/v1/products")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert data["total"] == 2

    def test_list_products_pagination(self, client):
        resp = client.get("/api/v1/products?page=1&limit=1")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["pages"] == 2

    def test_list_products_search(self, client):
        resp = client.get("/api/v1/products?search=Phone")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Test Phone"

    def test_list_products_price_filter(self, client):
        resp = client.get("/api/v1/products?max_price=500")
        assert resp.status_code == 200
        data = resp.json()
        assert all(float(p["price"]) <= 500 for p in data["items"])

    def test_get_product_by_id(self, client):
        resp = client.get("/api/v1/products/1")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Phone"

    def test_get_nonexistent_product(self, client):
        resp = client.get("/api/v1/products/9999")
        assert resp.status_code == 404

    def test_limit_max_100(self, client):
        resp = client.get("/api/v1/products?limit=9999")
        assert resp.status_code == 422


class TestCart:
    def test_get_empty_cart(self, client, auth_headers):
        resp = client.get("/api/v1/cart", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["items"] == []

    def test_add_item_to_cart(self, client, auth_headers):
        resp = client.post("/api/v1/cart/add", json={"product_id": 1, "quantity": 2}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["quantity"] == 2

    def test_add_out_of_stock_item(self, client, auth_headers):
        # Product 2 has stock=0
        resp = client.post("/api/v1/cart/add", json={"product_id": 2, "quantity": 1}, headers=auth_headers)
        assert resp.status_code == 409

    def test_remove_item_from_cart(self, client, auth_headers):
        client.post("/api/v1/cart/add", json={"product_id": 1, "quantity": 1}, headers=auth_headers)
        resp = client.delete("/api/v1/cart/remove", json={"product_id": 1}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["items"] == []

    def test_cart_requires_auth(self, client):
        resp = client.get("/api/v1/cart")
        assert resp.status_code == 401

    def test_quantity_exceeds_stock(self, client, auth_headers):
        # Stock = 50 for product 1
        resp = client.post("/api/v1/cart/add", json={"product_id": 1, "quantity": 51}, headers=auth_headers)
        assert resp.status_code == 409

    def test_cart_total_calculation(self, client, auth_headers):
        client.post("/api/v1/cart/add", json={"product_id": 1, "quantity": 2}, headers=auth_headers)
        resp = client.get("/api/v1/cart", headers=auth_headers)
        data = resp.json()
        expected_total = 299.99 * 2
        assert abs(float(data["total"]) - expected_total) < 0.01
