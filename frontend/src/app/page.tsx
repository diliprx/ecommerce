/**
 * src/app/page.tsx - ShopNext Landing Page
 * Server Component: Hero + Featured Products for root route (/).
 * Production-ready: Env-aware API, caching, error handling.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Users, Truck, Shield, Headphones } from "lucide-react";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { ProductListResponse } from "@/types";

async function fetchFeaturedProducts(): Promise<ProductListResponse> {
  const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
  const res = await fetch(`${BASE_URL}/products?page=1&limit=6`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    console.error("Failed to fetch featured products:", res.statusText);
    throw new Error("Failed to load products");
  }
  return res.json();
}

function StatsRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 text-center">
      <div>
        <ShoppingBag className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <div className="text-3xl font-bold text-gray-900 mb-2">1,200+</div>
        <div className="text-gray-600">Products Available</div>
      </div>
      <div>
        <Users className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <div className="text-3xl font-bold text-gray-900 mb-2">10K+</div>
        <div className="text-gray-600">Happy Customers</div>
      </div>
      <div>
        <Truck className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <div className="text-3xl font-bold text-gray-900 mb-2">Free</div>
        <div className="text-gray-600">Shipping Over $50</div>
      </div>
    </div>
  );
}

function FeaturesGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
      <div className="text-center p-8 rounded-2xl bg-white shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100">
        <Truck className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-3">Free Shipping</h3>
        <p className="text-gray-600">Orders over $50 ship free.</p>
      </div>
      <div className="text-center p-8 rounded-2xl bg-white shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100">
        <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-3">Secure Payment</h3>
        <p className="text-gray-600">Your data protection is our priority.</p>
      </div>
      <div className="text-center p-8 rounded-2xl bg-white shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100">
        <Headphones className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-3">24/7 Support</h3>
        <p className="text-gray-600">Get help whenever you need it.</p>
      </div>
    </div>
  );
}

export default async function HomePage() {
  let featuredProducts: ProductListResponse | null = null;
  
  try {
    featuredProducts = await fetchFeaturedProducts();
  } catch (error) {
    console.error("Home page products fetch error:", error);
    featuredProducts = null;
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-black mb-8 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent drop-shadow-2xl leading-tight">
              ShopNext
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-2xl mx-auto leading-relaxed opacity-90">
              Premium electronics at unbeatable prices. Fast shipping. Lifetime warranty.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/products"
                className="group bg-white text-gray-900 px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 whitespace-nowrap"
              >
                Shop Now
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StatsRow />
        </div>
      </section>

      {/* Featured */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6">
              Featured Products
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover our top picks. Limited stock.
            </p>
          </div>
          
          {featuredProducts && featuredProducts.items.length > 0 ? (
            <Suspense fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array(8).fill(0).map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-96" />
                ))}
              </div>
            }>
              <ProductGrid products={featuredProducts.items} />
            </Suspense>
          ) : (
            <div className="text-center py-24">
              <div className="w-24 h-24 bg-gray-200 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <ShoppingBag className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No products available</h3>
              <p className="text-gray-600 mb-8">Check back soon for our latest collection.</p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-xl transition-colors"
              >
                Browse All Products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FeaturesGrid />
        </div>
      </section>
    </div>
  );
}

