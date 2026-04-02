"""
app/services/services.py
─────────────────────────
Business logic layer. Services orchestrate repositories, enforce rules,
and handle transactions. They have zero knowledge of HTTP.
"""
import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, Tuple

import stripe
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.models import Cart, Order, User
from app.repositories.repositories import (
    AddressRepository,
    CartRepository,
    OrderRepository,
    ProductRepository,
    RefreshTokenRepository,
    UserRepository,
)
from app.schemas.schemas import (
    CartOut,
    LoginRequest,
    OrderCreate,
    OrderOut,
    ProductListResponse,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


# ── Auth Service ──────────────────────────────────────────────
class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.rt_repo = RefreshTokenRepository(db)

    def register(self, req: RegisterRequest) -> UserOut:
        if self.user_repo.get_by_email(req.email):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

        hashed = hash_password(req.password)
        user = self.user_repo.create(
            email=req.email,
            password_hash=hashed,
            first_name=req.first_name,
            last_name=req.last_name,
        )
        self.db.commit()
        self.db.refresh(user)
        logger.info("user_registered", user_id=user.id)
        return UserOut(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role.name if user.role else "user",
            is_active=user.is_active,
            created_at=user.created_at,
        )

    def login(self, req: LoginRequest) -> Tuple[TokenResponse, str]:
        """Returns (TokenResponse, raw_refresh_token)."""
        user = self.user_repo.get_by_email(req.email)
        # Constant-time check — always verify even if user not found to prevent enumeration
        dummy_hash = "$2b$12$placeholderplaceholderplaceholderplaceholderplaceholder."
        valid = verify_password(req.password, user.password_hash if user else dummy_hash)

        if not user or not valid or not user.is_active:
            logger.warning("login_failed", email=req.email)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

        role_name = user.role.name if user.role else "user"
        access_token = create_access_token(str(user.id), role=role_name)
        raw_rt, rt_hash = generate_refresh_token()

        self.rt_repo.create(
            user_id=user.id,
            token_hash=rt_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.commit()
        logger.info("login_success", user_id=user.id)

        token_resp = TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        return token_resp, raw_rt

    def refresh(self, raw_token: str) -> Tuple[TokenResponse, str]:
        """Token rotation: revoke old, issue new pair."""
        rt_hash = hash_refresh_token(raw_token)
        rt = self.rt_repo.get_by_hash(rt_hash)
        if not rt:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

        self.rt_repo.revoke(rt)

        user = self.user_repo.get_by_id(rt.user_id)
        if not user or not user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

        role_name = user.role.name if user.role else "user"
        new_access = create_access_token(str(user.id), role=role_name)
        new_raw_rt, new_hash = generate_refresh_token()

        self.rt_repo.create(
            user_id=user.id,
            token_hash=new_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.commit()
        return TokenResponse(access_token=new_access, expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60), new_raw_rt

    def logout(self, user_id: int) -> None:
        self.rt_repo.revoke_all_for_user(user_id)
        self.db.commit()


# ── Product Service ───────────────────────────────────────────
class ProductService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ProductRepository(db)

    def list_products(
        self,
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        min_price: Optional[Decimal] = None,
        max_price: Optional[Decimal] = None,
    ) -> ProductListResponse:
        items, total = self.repo.list_products(
            page=page, limit=limit, search=search,
            category_id=category_id, min_price=min_price, max_price=max_price,
        )
        pages = math.ceil(total / limit) if limit else 1
        return ProductListResponse(items=items, total=total, page=page, limit=limit, pages=pages)

    def get_product(self, product_id: int):
        product = self.repo.get_by_id(product_id)
        if not product:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
        return product


# ── Cart Service ──────────────────────────────────────────────
class CartService:
    def __init__(self, db: Session):
        self.db = db
        self.cart_repo = CartRepository(db)
        self.product_repo = ProductRepository(db)

    def get_cart(self, user_id: int) -> Cart:
        cart = self.cart_repo.get_with_items(user_id)
        if not cart:
            cart = self.cart_repo.get_or_create(user_id)
        return cart

    def add_item(self, user_id: int, product_id: int, quantity: int) -> Cart:
        product = self.product_repo.get_by_id(product_id)
        if not product:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
        if product.stock < quantity:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Only {product.stock} in stock")

        cart = self.cart_repo.get_or_create(user_id)
        self.cart_repo.add_item(cart, product_id, quantity)
        self.db.commit()
        return self.cart_repo.get_with_items(user_id)

    def remove_item(self, user_id: int, product_id: int) -> Cart:
        cart = self.cart_repo.get_with_items(user_id)
        if not cart:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Cart not found")
        if not self.cart_repo.remove_item(cart, product_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not in cart")
        self.db.commit()
        return self.cart_repo.get_with_items(user_id)

    @staticmethod
    def compute_total(cart: Cart) -> Decimal:
        return sum(
            item.product.price * item.quantity
            for item in cart.items
            if item.product
        )


# ── Order Service ─────────────────────────────────────────────
class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.order_repo = OrderRepository(db)
        self.cart_repo = CartRepository(db)
        self.product_repo = ProductRepository(db)
        self.addr_repo = AddressRepository(db)

    def create_order(self, user_id: int, req: OrderCreate) -> Order:
        # 1. Validate address ownership
        address = self.addr_repo.get_by_id_and_user(req.address_id, user_id)
        if not address:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found")

        # 2. Load cart
        cart = self.cart_repo.get_with_items(user_id)
        if not cart or not cart.items:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart is empty")

        # 3. Lock stock and build order items (SELECT FOR UPDATE per product)
        order_items = []
        total = Decimal("0")
        for ci in cart.items:
            ok = self.product_repo.decrement_stock(ci.product_id, ci.quantity)
            if not ok:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"Insufficient stock for product '{ci.product.name}'",
                )
            snapshot_price = ci.product.price      # price at purchase moment
            order_items.append({
                "product_id": ci.product_id,
                "product_name": ci.product.name,
                "price_at_purchase": snapshot_price,
                "quantity": ci.quantity,
            })
            total += snapshot_price * ci.quantity

        # 4. Create order in a single transaction
        order = self.order_repo.create(
            user_id=user_id,
            address_id=req.address_id,
            total_amount=total,
            items=order_items,
            notes=req.notes,
        )

        # 5. Clear cart
        self.cart_repo.clear(cart)
        self.db.commit()
        logger.info("order_created", order_id=order.id, user_id=user_id, total=str(total))
        return order

    def list_orders(self, user_id: int, page: int = 1, limit: int = 10):
        orders, total = self.order_repo.list_for_user(user_id, page, limit)
        return orders, total

    def get_order(self, order_id: int, user_id: int) -> Order:
        order = self.order_repo.get_by_id(order_id, user_id)
        if not order:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
        return order


# ── Payment Service ───────────────────────────────────────────
class PaymentService:
    def __init__(self, db: Session):
        self.db = db
        self.order_repo = OrderRepository(db)

    def create_payment_intent(self, order_id: int, user_id: int) -> dict:
        order = self.order_repo.get_by_id(order_id, user_id)
        if not order:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
        if order.status != "pending":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Order is not pending")

        # Amount in cents (Stripe requires integer cents)
        amount_cents = int(order.total_amount * 100)
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=order.currency.lower(),
            metadata={"order_id": order_id, "user_id": user_id},
        )
        return {
            "client_secret": intent.client_secret,    # safe to send to client
            "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
        }
