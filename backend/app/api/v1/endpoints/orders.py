"""app/api/v1/endpoints/orders.py"""
from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DB
from app.schemas.schemas import (
    OrderCreate, OrderListResponse, OrderOut,
    PaymentIntentCreate, PaymentIntentResponse,
)
from app.services.services import OrderService, PaymentService

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/create", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(body: OrderCreate, current_user: CurrentUser, db: DB):
    """
    Create order from current cart.
    Atomically decrements stock (SELECT FOR UPDATE) and clears cart.
    """
    svc = OrderService(db)
    order = svc.create_order(current_user.id, body)
    # Re-fetch with all relationships for response
    order = svc.get_order(order.id, current_user.id)
    return order


@router.get("", response_model=OrderListResponse)
async def list_orders(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=50),
):
    svc = OrderService(db)
    orders, total = svc.list_orders(current_user.id, page, limit)
    return OrderListResponse(items=orders, total=total, page=page, limit=limit)


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: int, current_user: CurrentUser, db: DB):
    svc = OrderService(db)
    return svc.get_order(order_id, current_user.id)


@router.post("/payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(body: PaymentIntentCreate, current_user: CurrentUser, db: DB):
    """
    Create Stripe PaymentIntent for a pending order.
    Returns client_secret — never exposes server key.
    """
    svc = PaymentService(db)
    data = svc.create_payment_intent(body.order_id, current_user.id)
    return PaymentIntentResponse(**data)
