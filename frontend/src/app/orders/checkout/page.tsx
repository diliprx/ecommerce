/**
 * src/app/orders/checkout/page.tsx
 * Client Component — Stripe Elements integration.
 *
 * Payment security:
 *  • Card data goes DIRECTLY from browser → Stripe (never touches our server)
 *  • We only receive a payment_intent_id and status from Stripe webhooks
 *  • Stripe publishable key is safe to expose (it's designed to be public)
 *  • Server key NEVER appears in frontend code
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { api } from "@/lib/api";

// Load Stripe outside component to avoid recreating on render
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

interface PaymentIntentResponse {
  client_secret: string;
  publishable_key: string;
}

// ── Inner form ────────────────────────────────────────────────
function CheckoutForm({ orderId }: { orderId: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { clearLocalCart } = useCartStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMsg(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders/${orderId}?paid=1`,
      },
    });

    if (error) {
      // Show only user-friendly message — never internal Stripe details
      setErrorMsg(error.message ?? "Payment failed. Please try again.");
      setIsProcessing(false);
    } else {
      // Redirect handled by Stripe via return_url
      clearLocalCart();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? "Processing…" : "Pay now"}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function CheckoutPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    // 1. Create order from cart
    api.post<{ id: number }>("/orders/create", { address_id: 1 }) // simplified: address_id should come from UI
      .then(async (order) => {
        setOrderId(order.id);
        // 2. Get Stripe PaymentIntent
        const pi = await api.post<PaymentIntentResponse>("/orders/payment-intent", {
          order_id: order.id,
        });
        setClientSecret(pi.client_secret);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail ?? "Failed to initialize checkout");
      });
  }, [isAuthenticated, router]);

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => router.back()} className="text-blue-600 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  if (!clientSecret || !orderId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 mt-4">Preparing checkout…</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { theme: "stripe" },
          }}
        >
          <CheckoutForm orderId={orderId} />
        </Elements>
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Payments secured by Stripe. We never store card details.
      </p>
    </div>
  );
}
