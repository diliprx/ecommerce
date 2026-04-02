/**
 * src/components/product/AddToCartButton.tsx
 * Client Component — handles add-to-cart with auth gate.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Check } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import type { Product } from "@/types";
import { AxiosError } from "axios";

interface Props {
  product: Product;
  disabled?: boolean;
}

export function AddToCartButton({ product, disabled }: Props) {
  const { addItem, isLoading } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    setError(null);
    try {
      await addItem(product.id, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail: string }>;
      setError(axiosErr.response?.data?.detail ?? "Failed to add to cart");
    }
  };

  return (
    <div className="space-y-3">
      {/* Quantity selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Qty</label>
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors font-medium"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="px-4 py-2 text-sm font-semibold min-w-10 text-center">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
            className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors font-medium"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        onClick={handleAdd}
        disabled={disabled || isLoading}
        className={`
          w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-base transition-all duration-200
          ${added
            ? "bg-green-600 text-white"
            : disabled
            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
          }
        `}
      >
        {added ? (
          <>
            <Check className="h-5 w-5" /> Added to cart!
          </>
        ) : isLoading ? (
          <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <ShoppingCart className="h-5 w-5" />
            {disabled ? "Out of stock" : "Add to cart"}
          </>
        )}
      </button>
    </div>
  );
}
