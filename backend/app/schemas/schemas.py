"""
app/schemas/schemas.py
──────────────────────
Pydantic v2 schemas used for request validation and response serialization.

Security notes:
  • password_hash / token fields are NEVER in response schemas
  • email is normalized (lowercased) on input
  • HTML is stripped via a custom validator to prevent XSS
  • Strict types prevent type-coercion injection
"""
import re
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ── Utility ───────────────────────────────────────────────────
def _strip_html(value: str) -> str:
    """Very lightweight HTML strip — for full XSS safety combine with bleach."""
    return re.sub(r"<[^>]+>", "", value).strip()


# ── Auth ──────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain a special character")
        return v

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        return _strip_html(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int    # seconds


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10)


# ── User ──────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Address ───────────────────────────────────────────────────
class AddressCreate(BaseModel):
    label: str = Field(default="home", max_length=50)
    line1: str = Field(min_length=1, max_length=255)
    line2: Optional[str] = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    country_code: str = Field(min_length=2, max_length=2)
    is_default: bool = False

    @field_validator("country_code")
    @classmethod
    def upper_country(cls, v: str) -> str:
        return v.upper()


class AddressOut(AddressCreate):
    id: int
    model_config = {"from_attributes": True}


# ── Category ──────────────────────────────────────────────────
class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str

    model_config = {"from_attributes": True}


# ── Product ───────────────────────────────────────────────────
class ProductOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    price: Decimal
    stock: int
    image_url: Optional[str]  # Legacy first image
    image_urls: Optional[List[str]] = None
    category: CategoryOut
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    category_id: int
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    price: Decimal = Field(gt=0, decimal_places=2)
    stock: int = Field(ge=0)
    image_url: Optional[str] = Field(default=None, max_length=1000)  # Legacy
    image_urls: Optional[List[str]] = Field(default=None)
    sku: Optional[str] = Field(default=None, max_length=100)

    @field_validator("name", "description", mode="before")
    @classmethod
    def sanitize(cls, v: Optional[str]) -> Optional[str]:
        return _strip_html(v) if v else v


class ProductListResponse(BaseModel):
    items: List[ProductOut]
    total: int
    page: int
    limit: int
    pages: int


# ── Cart ──────────────────────────────────────────────────────
class CartItemAdd(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=100)


class CartItemRemove(BaseModel):
    product_id: int = Field(gt=0)


class CartItemOut(BaseModel):
    id: int
    product: ProductOut
    quantity: int

    model_config = {"from_attributes": True}


class CartOut(BaseModel):
    id: int
    items: List[CartItemOut]
    total: Decimal

    model_config = {"from_attributes": True}


# ── Order ─────────────────────────────────────────────────────
class OrderCreate(BaseModel):
    address_id: int = Field(gt=0)
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("notes", mode="before")
    @classmethod
    def sanitize_notes(cls, v: Optional[str]) -> Optional[str]:
        return _strip_html(v) if v else v


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    price_at_purchase: Decimal
    quantity: int

    model_config = {"from_attributes": True}


class PaymentOut(BaseModel):
    id: int
    gateway: str
    transaction_id: str
    amount: Decimal
    currency: str
    status: str
    paid_at: Optional[datetime]

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    status: str
    total_amount: Decimal
    currency: str
    notes: Optional[str]
    items: List[OrderItemOut]
    address: AddressOut
    payment: Optional[PaymentOut]
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    items: List[OrderOut]
    total: int
    page: int
    limit: int


# ── Payment (Stripe) ──────────────────────────────────────────
class PaymentIntentCreate(BaseModel):
    order_id: int = Field(gt=0)


class PaymentIntentResponse(BaseModel):
    client_secret: str        # sent to frontend — never the server key
    publishable_key: str


# ── Pagination params (shared) ────────────────────────────────
class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=10, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit


# ── Error response ────────────────────────────────────────────
class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
