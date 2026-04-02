"""
app/api/v1/endpoints/webhooks.py
──────────────────────────────────
Stripe webhook — verifies signature before processing.
Security: never trust webhook body without signature verification.
"""
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.models import Order, Payment
from app.utils.logger import get_logger
from fastapi import Depends

settings = get_settings()
logger = get_logger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid webhook signature")

    if event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        order_id = int(pi["metadata"].get("order_id", 0))

        order = db.get(Order, order_id)
        if order and order.status == "pending":
            order.status = "confirmed"

            payment = Payment(
                order_id=order_id,
                gateway="stripe",
                transaction_id=pi["id"],
                payment_intent_id=pi["id"],
                amount=pi["amount"] / 100,
                currency=pi["currency"].upper(),
                status="succeeded",
                paid_at=datetime.now(timezone.utc),
            )
            db.add(payment)
            db.commit()
            logger.info("payment_succeeded", order_id=order_id, pi_id=pi["id"])

    elif event["type"] == "payment_intent.payment_failed":
        pi = event["data"]["object"]
        order_id = int(pi["metadata"].get("order_id", 0))
        order = db.get(Order, order_id)
        if order:
            order.status = "cancelled"
            db.commit()
        logger.warning("payment_failed", order_id=order_id)

    return {"status": "ok"}
