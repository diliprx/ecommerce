"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Too long"),
  description: z.string().max(5000, "Description too long").optional(),
  price: z.number().positive("Price must be positive").max(999999, "Too expensive"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  image_url: z.string().url("Invalid URL").or(z.literal("")).optional(),
  sku: z.string().max(100, "SKU too long").optional(),
  category_id: z.number().int().min(1, "Select category"),
});

type FormData = z.infer<typeof schema>;

interface Category {
  id: number;
  name: string;
}

export default function AddProduct() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Auth guard
  useEffect(() => {
    if (user?.role !== "admin") {
      startTransition(() => {
        router.push("/products");
      });
    }
  }, [user, router]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        const cats = await api.get<Category[]>("/products/categories");
        setCategories(cats);
      } catch (err) {
        setCategoriesError("Failed to load categories. Using defaults.");
        console.error(err);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const productData = {
        category_id: data.category_id,
        name: data.name,
        description: data.description || undefined,
        price: Number(data.price).toFixed(2),  // Fix: Ensure Decimal-compatible string "23.00"
        stock: data.stock,
        image_url: data.image_url || undefined,
        sku: data.sku || undefined,
      };
      await api.post("/products", productData);
      setSuccess(true);
      reset();
      startTransition(() => {
        router.push("/admin");
      });
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setSubmitError(err.response.data.detail);
      } else {
        setSubmitError("Failed to create product");
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;


  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link 
          href="/admin" 
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-8 font-medium"
        >
          <ArrowLeft className="h-5 w-5 mr-1" /> Back to Dashboard
        </Link>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Add New Product</h1>
          {categoriesError && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800">
              {categoriesError}
            </div>
          )}
          {submitError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800">
              {submitError}
            </div>
          )}
          {categoriesLoading && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800">
              Loading categories...
            </div>
          )}
          <p className="text-gray-600 mb-8">Fill in product details to add it to the store</p>

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
              Product created successfully! Redirecting...
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
              <input
                {...register("name", { valueAsNumber: false })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g. Wireless Headphones"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                {...register("description")}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-vertical"
                placeholder="Product features, specs, etc."
              />
              {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price * ($)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("price", { valueAsNumber: true })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="99.99"
                />
                {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock *</label>
                <input
                  type="number"
                  {...register("stock", { valueAsNumber: true })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="100"
                />
                {errors.stock && <p className="text-red-500 text-sm mt-1">{errors.stock.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                <input
                  {...register("image_url")}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
placeholder="https://picsum.photos/400/300?random=1"
                />
                {errors.image_url && <p className="text-red-500 text-sm mt-1">{errors.image_url.message}</p>}
                <p className="text-xs text-gray-500 mt-1">Paste direct image URL or use Picsum (Google images alternative)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
                <input
                  {...register("sku")}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="WH-123"
                />
                {errors.sku && <p className="text-red-500 text-sm mt-1">{errors.sku.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category ID *</label>
              <select
                {...register("category_id", { valueAsNumber: true })}
                disabled={categoriesLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
                {categories.length === 0 && !categoriesLoading && (
                  <option disabled>No categories available</option>
                )}
              </select>
              {errors.category_id && <p className="text-red-500 text-sm mt-1">{errors.category_id.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || categoriesLoading || categories.length === 0}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-2xl font-bold text-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 transition-all shadow-xl hover:shadow-2xl"
            >
              {loading ? (
                <>
                  <Upload className="h-5 w-5 animate-spin mr-2 inline" />
                  Creating...
                </>
              ) : "Create Product"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
