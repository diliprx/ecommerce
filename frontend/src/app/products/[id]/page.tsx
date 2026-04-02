/**
 * src/app/products/[id]/page.tsx
 * Server Component — generates static paths for popular products.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import type { Product } from "@/types";
import { AddToCartButton } from "@/components/product/AddToCartButton";

interface Props {
  params: { id: string };
}

async function fetchProduct(id: string): Promise<Product | null> {
  const res = await fetch(`${process.env.API_BASE_URL}/products/${id}`, {
    next: { revalidate: 120 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch product");
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await fetchProduct(params.id);
  if (!product) return { title: "Product Not Found" };
  return {
    title: product.name,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      images: product.image_url ? [product.image_url] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const product = await fetchProduct(params.id);
  if (!product) notFound();

  const inStock = product.stock > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* ── Image ── */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority                              // LCP — load eagerly
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No image
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="flex flex-col gap-6">
          <div>
            <span className="text-sm text-blue-600 font-medium">
              {product.category.name}
            </span>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">{product.name}</h1>
          </div>

          <div className="text-4xl font-extrabold text-gray-900">
            ${Number(product.price).toFixed(2)}
          </div>

          <div className={`text-sm font-medium ${inStock ? "text-green-600" : "text-red-500"}`}>
            {inStock ? `${product.stock} in stock` : "Out of stock"}
          </div>

          {product.description && (
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          )}

          {/* Client component — needs interactivity */}
          <AddToCartButton product={product} disabled={!inStock} />
        </div>
      </div>
    </div>
  );
}
