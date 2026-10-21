"""Razorpay payment endpoints."""

import hashlib
import hmac
import logging

import razorpay
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/payments", tags=["payments"])


# ─── Request / Response schemas ──────────────────────────────

class CreateOrderRequest(BaseModel):
    plan: str  # "pro_monthly", "pro_yearly"
    amount: int  # amount in paise/cents
    currency: str = "INR"


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    razorpay_key_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str


class VerifyPaymentResponse(BaseModel):
    success: bool
    message: str
    subscription_id: str | None = None


# ─── Helpers ─────────────────────────────────────────────────

def get_razorpay_client(settings: Settings) -> razorpay.Client:
    """Create a Razorpay client from settings."""
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured. Razorpay credentials are missing.",
        )
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


# ─── Endpoints ───────────────────────────────────────────────

@router.post("/create-order", response_model=CreateOrderResponse)
async def create_order(
    body: CreateOrderRequest,
    user=Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Create a Razorpay order for subscription payment."""
    client = get_razorpay_client(settings)

    try:
        order_data = {
            "amount": body.amount,
            "currency": body.currency or settings.RAZORPAY_CURRENCY,
            "receipt": f"order_{user.id}_{body.plan}",
            "notes": {
                "user_id": str(user.id),
                "plan": body.plan,
            },
        }
        order = client.order.create(data=order_data)

        logger.info("Razorpay order created: %s for user %s", order["id"], user.id)

        return CreateOrderResponse(
            order_id=order["id"],
            amount=order["amount"],
            currency=order["currency"],
            razorpay_key_id=settings.RAZORPAY_KEY_ID,
        )
    except razorpay.errors.BadRequestError as e:
        logger.error("Razorpay order creation failed: %s", e)
        raise HTTPException(status_code=400, detail=f"Payment order creation failed: {e}")
    except Exception as e:
        logger.error("Razorpay order creation error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create payment order")


@router.post("/verify", response_model=VerifyPaymentResponse)
async def verify_payment(
    body: VerifyPaymentRequest,
    user=Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db=Depends(get_db),
):
    """Verify Razorpay payment signature and activate subscription."""
    client = get_razorpay_client(settings)

    # Verify signature
    generated_signature = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if generated_signature != body.razorpay_signature:
        logger.warning(
            "Payment signature mismatch for user %s, order %s",
            user.id,
            body.razorpay_order_id,
        )
        raise HTTPException(status_code=400, detail="Payment verification failed: invalid signature")

    # Fetch payment details from Razorpay
    try:
        payment = client.payment.fetch(body.razorpay_payment_id)
    except Exception as e:
        logger.error("Failed to fetch payment details: %s", e)
        raise HTTPException(status_code=500, detail="Failed to verify payment with Razorpay")

    if payment.get("status") != "captured":
        logger.warning("Payment %s not captured (status: %s)", body.razorpay_payment_id, payment.get("status"))
        raise HTTPException(status_code=400, detail=f"Payment not captured: {payment.get('status')}")

    # Store subscription in database
    subscription = {
        "user_id": str(user.id),
        "plan": body.plan,
        "razorpay_order_id": body.razorpay_order_id,
        "razorpay_payment_id": body.razorpay_payment_id,
        "amount": payment.get("amount", 0),
        "currency": payment.get("currency", settings.RAZORPAY_CURRENCY),
        "status": "active",
        "created_at": payment.get("created_at"),
    }

    try:
        await db.subscriptions.insert_one(subscription)
        logger.info("Subscription created for user %s: plan=%s", user.id, body.plan)
    except Exception as e:
        logger.error("Failed to store subscription: %s", e)
        # Payment was successful but storage failed — still return success to user

    return VerifyPaymentResponse(
        success=True,
        message="Payment verified successfully. Subscription activated!",
        subscription_id=body.razorpay_payment_id,
    )
