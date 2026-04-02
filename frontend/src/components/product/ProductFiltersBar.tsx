/**
 * src/components/product/ProductFiltersBar.tsx
 * Client Component — updates URL search params for filter state.
 * This keeps filters shareable and enables browser back/forward.
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";

export function ProductFiltersBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set("page", "1"); // reset to first page on filter change
      startTransition(() => {
        router.push(`/products?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-3 mb-8">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          placeholder="Search products…"
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          aria-label="Search products"
        />
      </div>

      {/* Min price */}
      <input
        type="number"
        placeholder="Min price"
        min={0}
        defaultValue={searchParams.get("min_price") ?? ""}
        onChange={(e) => updateFilter("min_price", e.target.value)}
        className="w-32 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        aria-label="Minimum price"
      />

      {/* Max price */}
      <input
        type="number"
        placeholder="Max price"
        min={0}
        defaultValue={searchParams.get("max_price") ?? ""}
        onChange={(e) => updateFilter("max_price", e.target.value)}
        className="w-32 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        aria-label="Maximum price"
      />

      {isPending && (
        <div className="flex items-center text-sm text-gray-500 gap-2">
          <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Filtering…
        </div>
      )}
    </div>
  );
}
