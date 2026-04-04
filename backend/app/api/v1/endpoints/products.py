from decimal import Decimal
from typing import Optional

import re
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, or_
from app.models.models import Category, Product

from fastapi import APIRouter, Query, status, HTTPException
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
import random
from app.api.deps import AdminUser, DB
from typing import List
from app.schemas.schemas import ProductCreate, ProductListResponse, ProductOut, CategoryOut
from app.services.services import ProductService
from app.repositories.repositories import ProductRepository

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductListResponse)
async def list_products(
    db: DB,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=200),
    category_id: Optional[int] = Query(default=None, gt=0),
    min_price: Optional[Decimal] = Query(default=None, ge=0),
    max_price: Optional[Decimal] = Query(default=None, ge=0),
):
    """
    Public product listing with pagination, full-text search, and filters.
    No auth required — public endpoint.
    """
    svc = ProductService(db)
    return svc.list_products(
        page=page, limit=limit, search=search,
        category_id=category_id, min_price=min_price, max_price=max_price,
    )


@router.get("/categories", response_model=List[CategoryOut])
async def list_categories(db: DB):
    """Get all active categories for forms."""
    categories = db.query(Category).filter(Category.is_active == True).all()
    return categories


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, db: DB):
    \"\"\"Get single product detail.\"\"\"
    svc = ProductService(db)
    return svc.get_product(product_id)


@router.get("/admin", response_model=ProductListResponse)
async def list_admin_products(
    db: DB,
    _admin: AdminUser,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=200),
):
    \"\"\"Admin: list ALL products (incl inactive).\"\"\"
    repo = ProductRepository(db)
    # For admin, override is_active filter
    base = (
        select(Product)
        .options(joinedload(Product.category))
        .where(Product.deleted_at.is_(None))
    )
    if search:
        term = f"%{search}%"
        base = base.where(or_(Product.name.ilike(term), Product.description.ilike(term)))
    
    count_stmt = select(func.count()).select_from(base.subquery())
    total = db.execute(count_stmt).scalar_one()
    
    offset = (page - 1) * limit
    items_stmt = base.order_by(Product.created_at.desc()).offset(offset).limit(limit)
    items = list(db.execute(items_stmt).unique().scalars())
    
    pages = (total + limit - 1) // limit
    return ProductListResponse(items=items, total=total, page=page, limit=limit, pages=pages)



@router.put("/{product_id}", response_model=ProductOut)
async def update_product(product_id: int, body: ProductCreate, db: DB, admin: AdminUser):
    \"\"\"Admin only — update product.\"\"\"
    repo = ProductRepository(db)
    product = repo.get_by_id(product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    
    update_data = body.dict(exclude_unset=True)
    
    # Update basic fields
    for key, value in update_data.items():
        if key != 'name':
            setattr(product, key, value)
    
    # Handle name/slug change
    if 'name' in update_data:
        base_slug = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")
        slug = base_slug
        counter = 2
        existing_stmt = select(Product).where(Product.slug == slug, Product.deleted_at.is_(None))
        while db.execute(existing_stmt).scalar_one_or_none() and slug != product.slug:
            slug = f"{base_slug}-{counter}"
            counter += 1
            existing_stmt = select(Product).where(Product.slug == slug, Product.deleted_at.is_(None))
        product.name = body.name
        product.slug = slug
    
    product.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(product)
    return product


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductCreate, db: DB, _admin: AdminUser):
    \"\"\"Admin only — create a new product.\"\"\"
    # Ensure default category exists (Electronics id=1)
    category = db.query(Category).filter(Category.id == 1).first()
    if not category:
        category = Category(id=1, name="Electronics", slug="electronics", is_active=True)
        db.add(category)
        db.flush()
        db.refresh(category)
    elif not category.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Category inactive")
    
    repo = ProductRepository(db)
    
    # Generate unique slug
    base_slug = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")
    slug = base_slug
    counter = 2
    while repo.get_by_slug(slug):
        slug = f"{base_slug}-{counter}"
        counter += 1
        if counter > 10:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unable to generate unique slug for '{body.name}'. Too many similar products exist. Please use a more specific name.")
    
    # Handle SKU: validate uniqueness if provided, auto-generate if empty
    sku = body.sku
    if sku:
        existing = repo.get_by_sku(sku)
        if existing:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, 
                f"SKU '{sku}' already exists (product: {existing.name}). Please use a unique SKU."
            )
    else:
        # Auto-generate: first 10 chars of slug + random 4 digits
        sku = f"{slug[:10]}-{random.randint(1000, 9999)}"
    
product_data = {
        'category_id': category.id,
        'name': body.name,
        'slug': slug,
        'description': body.description,
        'price': body.price,
        'stock': body.stock,
        'image_url': body.image_url or f"https://picsum.photos/400/300?random={body.name.replace(' ', '-')}",
        'sku': sku,
    }
    
    try:
        product = repo.create(product_data)
        db.commit()
        db.refresh(product)
        return product
    except IntegrityError as e:
        db.rollback()
        if "uq_prod_sku" in str(e.orig):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"SKU conflict for '{sku}'. Please choose another."
            )
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Database constraint violation")


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: int, db: DB, _admin: AdminUser):
    """Admin only — soft delete product (set deleted_at)."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    
    if product.deleted_at:
        raise HTTPException(status.HTTP_410_GONE, "Product already deleted")
    
    product.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return None
