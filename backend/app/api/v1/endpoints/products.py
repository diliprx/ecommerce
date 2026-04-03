from decimal import Decimal
from typing import Optional

import re
from sqlalchemy.orm import Session
from app.models.models import Category

from fastapi import APIRouter, Query, status, HTTPException
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
    """Get single product detail."""
    svc = ProductService(db)
    return svc.get_product(product_id)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductCreate, db: DB, _admin: AdminUser):
    """Admin only — create a new product."""
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
    
    product = repo.create({
        "category_id": category.id,
        "name": body.name,
        "slug": slug,
        "description": body.description,
        "price": body.price,
        "stock": body.stock,
        "image_url": body.image_url or f"https://picsum.photos/400/300?random={body.name.replace(' ', '-')}",
        "sku": body.sku,
    })
    db.commit()
    db.refresh(product)
    return product
