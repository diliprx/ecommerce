/**
 * src/app/cart/page.tsx
 * Client Component — cart requires authentication and real-time state.
 */
"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";

export default function CartPage() {
  const { cart, fetchCart, removeItem, isLoading } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchCart();
  }, [isAuthenticated, fetchCart, router]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;

  if (isEmpty) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <ShoppingBag className="mx-auto h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-8">Start shopping to add items</p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Browse Products <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

      <div className="space-y-4">
        {cart.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4"
          >
            {/* Product image */}
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
              {item.product.image_url ? (
                <Image
                  src={item.product.image_url}
                  alt={item.product.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-300 text-xs">No img</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Link
                href={`/products/${item.product.id}`}
                className="font-semibold text-gray-900 hover:text-blue-600 truncate block"
              >
                {item.product.name}
              </Link>
              <p className="text-gray-500 text-sm mt-0.5">Qty: {item.quantity}</p>
            </div>

            {/* Price */}
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-gray-900">
                ${(Number(item.product.price) * item.quantity).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">${Number(item.product.price).toFixed(2)} each</p>
            </div>

            {/* Remove */}
            <button
              onClick={() => removeItem(item.product.id)}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Remove item"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-medium text-gray-700">Total</span>
          <span className="text-2xl font-extrabold text-gray-900">
            ${Number(cart.total).toFixed(2)}
          </span>
        </div>
        <Link
          href="/orders/checkout"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Proceed to Checkout <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
