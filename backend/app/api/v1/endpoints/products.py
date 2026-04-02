"""app/api/v1/endpoints/products.py"""
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.deps import AdminUser, CurrentUser, DB
from app.schemas.schemas import ProductCreate, ProductListResponse, ProductOut
from app.services.services import ProductService

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


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, db: DB):
    """Get single product detail."""
    svc = ProductService(db)
    return svc.get_product(product_id)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductCreate, db: DB, _admin: AdminUser):
    """Admin only — create a new product."""
    from app.repositories.repositories import ProductRepository
    import re

    repo = ProductRepository(db)
    slug = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")
    product = repo.create({
        "category_id": body.category_id,
        "name": body.name,
        "slug": slug,
        "description": body.description,
        "price": body.price,
        "stock": body.stock,
        "image_url": body.image_url,
        "sku": body.sku,
    })
    db.commit()
    db.refresh(product)
    return product
