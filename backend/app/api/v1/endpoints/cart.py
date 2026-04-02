"""app/api/v1/endpoints/cart.py"""
from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DB
from app.schemas.schemas import CartItemAdd, CartItemRemove, CartOut
from app.services.services import CartService

router = APIRouter(prefix="/cart", tags=["cart"])


def _cart_out(cart, svc: CartService) -> CartOut:
    total = svc.compute_total(cart)
    return CartOut(id=cart.id, items=cart.items, total=total)


@router.get("", response_model=CartOut)
async def get_cart(current_user: CurrentUser, db: DB):
    svc = CartService(db)
    cart = svc.get_cart(current_user.id)
    return _cart_out(cart, svc)


@router.post("/add", response_model=CartOut)
async def add_to_cart(body: CartItemAdd, current_user: CurrentUser, db: DB):
    svc = CartService(db)
    cart = svc.add_item(current_user.id, body.product_id, body.quantity)
    return _cart_out(cart, svc)


@router.delete("/remove", response_model=CartOut)
async def remove_from_cart(body: CartItemRemove, current_user: CurrentUser, db: DB):
    svc = CartService(db)
    cart = svc.remove_item(current_user.id, body.product_id)
    return _cart_out(cart, svc)
