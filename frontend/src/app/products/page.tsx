/**
 * src/app/products/page.tsx
 * ──────────────────────────
 * Server Component: fetches product data on the server for SSR/SEO.
 * Search and filters are driven by URL search params (shareable URLs).
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductFiltersBar } from "@/components/product/ProductFiltersBar";
import { Pagination } from "@/components/ui/Pagination";
import type { ProductListResponse } from "@/types";

export const metadata: Metadata = { title: "Products" };

interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
    category_id?: string;
    min_price?: string;
    max_price?: string;
  };
}

async function fetchProducts(params: PageProps["searchParams"]): Promise<ProductListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", params.page ?? "1");
  qs.set("limit", "12");
  if (params.search) qs.set("search", params.search);
  if (params.category_id) qs.set("category_id", params.category_id);
  if (params.min_price) qs.set("min_price", params.min_price);
  if (params.max_price) qs.set("max_price", params.max_price);

  const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
  const res = await fetch(`${BASE_URL}/products?${qs.toString()}`, {
    cache: 'no-store',  // Dynamic fetch for dev/filter updates
  });

  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const data = await fetchProducts(searchParams);
  const currentPage = Number(searchParams.page ?? 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Products</h1>

      <ProductFiltersBar />

      <Suspense fallback={<div className="text-center py-20">Loading products…</div>}>
        {data.items.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            No products found. Try different filters.
          </div>
        ) : (
          <ProductGrid products={data.items} />
        )}
      </Suspense>

      <div className="mt-10 flex justify-center">
        <Pagination currentPage={currentPage} totalPages={data.pages} />
      </div>

      <p className="text-center text-sm text-gray-500 mt-4">
        Showing {data.items.length} of {data.total} products
      </p>
    </div>
  );
}
