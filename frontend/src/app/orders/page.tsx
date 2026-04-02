/**
 * src/app/orders/page.tsx
 * Client Component — requires auth, uses client-side fetching.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Order, OrderListResponse } from "@/types";
import { Package, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};

export default function OrdersPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    api.get<OrderListResponse>("/orders")
      .then((data) => setOrders(data.items))
      .catch(() => setError("Failed to load orders"))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-4">
          {[1, 2].map((n) => <div key={n} className="h-32 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="max-w-4xl mx-auto px-4 py-10 text-red-600">{error}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Package className="mx-auto h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">No orders yet</h2>
        <Link href="/products" className="text-blue-600 hover:underline">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">Order #{order.id}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  ${Number(order.total_amount).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {order.status}
                </span>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-1 text-blue-600 text-sm hover:underline"
                >
                  View details <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {order.items.length} item{order.items.length !== 1 ? "s" : ""} ·{" "}
                {order.items.map((i) => i.product_name).join(", ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
