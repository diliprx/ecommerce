/**
 * src/components/product/ProductGrid.tsx
 * Server-safe — no client state, pure rendering.
 * Uses next/image for automatic WebP conversion + lazy loading.
 */
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/types";

interface Props {
  products: Product[];
}

export function ProductGrid({ products }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const inStock = product.stock > 0;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="lazy"      // lazy load below-the-fold cards
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300 text-sm">
            No image
          </div>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="bg-white text-gray-600 text-xs font-medium px-3 py-1 rounded-full border">
              Out of stock
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs text-blue-600 font-medium mb-1">{product.category.name}</p>
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-extrabold text-gray-900">
            ${Number(product.price).toFixed(2)}
          </span>
          {inStock && (
            <span className="text-xs text-green-600 font-medium">{product.stock} left</span>
          )}
        </div>
      </div>
    </Link>
  );
}
