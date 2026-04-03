/**
 * src/components/layout/Navbar.tsx
 * Client Component — reads auth state and cart count reactively.
 */
"use client";

import Link from "next/link";
import { ShoppingCart, User, LogOut, Package } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useAuth } from "@/hooks/useAuth";

export function Navbar() {
  const { isAuthenticated, user } = useAuthStore();
  const { cart } = useCartStore();
  const { logout } = useAuth();

  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/products" className="text-xl font-extrabold text-blue-600 tracking-tight">
          ShopNext
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link href="/products" className="hover:text-blue-600 transition-colors">
            Products
          </Link>
          {isAuthenticated && user?.role === "admin" && (
            <>
              <Link href="/admin" className="hover:text-blue-600 transition-colors flex items-center gap-1 font-semibold text-orange-600">
                🛠️ Admin
              </Link>
              <Link href="/admin/add" className="hover:text-blue-600 transition-colors flex items-center gap-1">
                ➕ Add Product
              </Link>
            </>
          )}
          {isAuthenticated && user?.role !== "admin" && (
            <Link href="/orders" className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <Package className="h-4 w-4" /> Orders
            </Link>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Cart */}
          {isAuthenticated && (
            <Link
              href="/cart"
              className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart className="h-6 w-6" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="hidden md:block text-sm text-gray-700 font-medium">
                {user?.first_name}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-red-600 transition-colors"
                aria-label="Logout"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
