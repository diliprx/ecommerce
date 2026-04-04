"""
app/repositories/repositories.py
──────────────────────────────────
Data-access layer. Only SQLAlchemy ORM — never raw SQL strings.
This is the ONLY place that touches the DB session.

Security: ORM parameterizes all queries automatically → SQL injection immune.
Performance: uses joinedload to avoid N+1 queries.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.models import (
    Address, Cart, CartItem, Category, Order, OrderItem, Payment,
    Product, RefreshToken, User,
)


# ── Users ─────────────────────────────────────────────────────
class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email, User.deleted_at.is_(None))
        return self.db.execute(stmt).scalar_one_or_none()

    def create(self, email: str, password_hash: str, first_name: str, last_name: str) -> User:
        user = User(
            email=email,
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
        )
        self.db.add(user)
        self.db.flush()   # get id before commit
        return user

    def soft_delete(self, user: User) -> None:
        user.deleted_at = datetime.now(timezone.utc)


# ── Refresh Tokens ────────────────────────────────────────────
class RefreshTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user_id: int, token_hash: str, expires_at: datetime) -> RefreshToken:
        rt = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        self.db.add(rt)
        self.db.flush()
        return rt

    def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def revoke(self, rt: RefreshToken) -> None:
        rt.revoked = True

    def revoke_all_for_user(self, user_id: int) -> None:
        """Used on logout or suspected breach."""
        stmt = select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,
        )
        for rt in self.db.execute(stmt).scalars():
            rt.revoked = True


# ── Products ──────────────────────────────────────────────────
class ProductRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, product_id: int) -> Optional[Product]:
        stmt = (
            select(Product)
            .options(joinedload(Product.category))
            .where(Product.id == product_id, Product.deleted_at.is_(None), Product.is_active == True)
        )
        return self.db.execute(stmt).unique().scalar_one_or_none()

    def list_products(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        min_price: Optional[Decimal] = None,
        max_price: Optional[Decimal] = None,
    ) -> Tuple[List[Product], int]:
        base = (
            select(Product)
            .options(joinedload(Product.category))
            .where(Product.deleted_at.is_(None), Product.is_active == True)
        )
        if search:
            # Use LIKE — for production scale use MySQL FULLTEXT or Elasticsearch
            term = f"%{search}%"
            base = base.where(or_(Product.name.ilike(term), Product.description.ilike(term)))
        if category_id:
            base = base.where(Product.category_id == category_id)
        if min_price is not None:
            base = base.where(Product.price >= min_price)
        if max_price is not None:
            base = base.where(Product.price <= max_price)

        count_stmt = select(func.count()).select_from(base.subquery())
        total = self.db.execute(count_stmt).scalar_one()

        offset = (page - 1) * limit
        items_stmt = base.order_by(Product.created_at.desc()).offset(offset).limit(limit)
        items = list(self.db.execute(items_stmt).unique().scalars())
        return items, total

    def create(self, data: dict) -> Product:
        product = Product(**data)
        self.db.add(product)
        self.db.flush()
        return product

    def decrement_stock(self, product_id: int, quantity: int) -> bool:
        """
        Pessimistic locking via SELECT FOR UPDATE.
        Returns False if insufficient stock.
        """
        stmt = select(Product).where(Product.id == product_id).with_for_update()
        product = self.db.execute(stmt).scalar_one_or_none()
        if not product or product.stock < quantity:
            return False
        product.stock -= quantity
        return True

    def get_by_slug(self, slug: str) -> Optional[Product]:
        """Get active product by slug."""
        stmt = (
            select(Product)
            .where(Product.slug == slug, Product.deleted_at.is_(None))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_sku(self, sku: str) -> Optional[Product]:
        """Get product by SKU (any status)."""
        stmt = (
            select(Product)
            .where(Product.sku == sku)
        )
        return self.db.execute(stmt).scalar_one_or_none()


# ── Cart ──────────────────────────────────────────────────────
class CartRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, user_id: int) -> Cart:
        cart = self.db.execute(
            select(Cart)
            .options(selectinload(Cart.items).joinedload(CartItem.product).joinedload(Product.category))
            .where(Cart.user_id == user_id)
        ).unique().scalar_one_or_none()
        if not cart:
            cart = Cart(user_id=user_id)
            self.db.add(cart)
            self.db.flush()
        return cart

    def get_with_items(self, user_id: int) -> Optional[Cart]:
        return self.db.execute(
            select(Cart)
            .options(selectinload(Cart.items).joinedload(CartItem.product).joinedload(Product.category))
            .where(Cart.user_id == user_id)
        ).unique().scalar_one_or_none()

    def add_item(self, cart: Cart, product_id: int, quantity: int) -> CartItem:
        stmt = select(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.product_id == product_id,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()
        if existing:
            existing.quantity += quantity
            return existing
        item = CartItem(cart_id=cart.id, product_id=product_id, quantity=quantity)
        self.db.add(item)
        self.db.flush()
        return item

    def remove_item(self, cart: Cart, product_id: int) -> bool:
        stmt = select(CartItem).where(
            CartItem.cart_id == cart.id,
            CartItem.product_id == product_id,
        )
        item = self.db.execute(stmt).scalar_one_or_none()
        if not item:
            return False
        self.db.delete(item)
        return True

    def clear(self, cart: Cart) -> None:
        for item in cart.items:
            self.db.delete(item)


# ── Orders ────────────────────────────────────────────────────
class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        user_id: int,
        address_id: int,
        total_amount: Decimal,
        items: List[dict],
        notes: Optional[str] = None,
    ) -> Order:
        order = Order(
            user_id=user_id,
            address_id=address_id,
            total_amount=total_amount,
            notes=notes,
        )
        self.db.add(order)
        self.db.flush()
        for item_data in items:
            oi = OrderItem(order_id=order.id, **item_data)
            self.db.add(oi)
        return order

    def get_by_id(self, order_id: int, user_id: int) -> Optional[Order]:
        stmt = (
            select(Order)
            .options(
                selectinload(Order.items),
                joinedload(Order.address),
                joinedload(Order.payment),
            )
            .where(Order.id == order_id, Order.user_id == user_id)
        )
        return self.db.execute(stmt).unique().scalar_one_or_none()

    def list_for_user(self, user_id: int, page: int = 1, limit: int = 10) -> Tuple[List[Order], int]:
        base = select(Order).where(Order.user_id == user_id)
        total = self.db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
        orders = list(
            self.db.execute(
                base.options(selectinload(Order.items), joinedload(Order.address), joinedload(Order.payment))
                .order_by(Order.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            ).unique().scalars()
        )
        return orders, total


# ── Addresses ─────────────────────────────────────────────────
class AddressRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id_and_user(self, address_id: int, user_id: int) -> Optional[Address]:
        stmt = select(Address).where(Address.id == address_id, Address.user_id == user_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def create(self, user_id: int, data: dict) -> Address:
        addr = Address(user_id=user_id, **data)
        self.db.add(addr)
        self.db.flush()
        return addr
