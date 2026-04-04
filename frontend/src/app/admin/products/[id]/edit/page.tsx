"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { ArrowLeft, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface Product {
  id: number;
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  image_url?: string;
  sku?: string;
  category_id: number;
  is_active: boolean;
}

export default function EditProduct() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Auth guard
  useEffect(() => {
    if (user?.role !== "admin") {
      startTransition(() => {
        router.push("/admin");
      });
    }
  }, [user, router]);

  // Fetch product and categories
  useEffect(() => {
    const fetchData = async () => {
      if (!productId) return;
      try {
        setLoading(true);
        const [prodData, catsData] = await Promise.all([
          api.get<Product>(`/products/${productId}`),
          api.get<Category[]>("/products/categories"),
        ]);
        setProduct(prodData);
        setCategories(catsData);
        
        // Populate form
        setValue("name", prodData.name);
        setValue("description", prodData.description || "");
        setValue("price", prodData.price);
        setValue("stock", prodData.stock);
        setValue("image_url", prodData.image_url || "");
        setValue("sku", prodData.sku || "");
        setValue("category_id", prodData.category_id);
      } catch (err: any) {
        setError("Product not found or access denied");
        console.error(err);
      } finally {
        setLoading(false);
        setCategoriesLoading(false);
      }
    };
    fetchData();
  }, [productId, setValue]);

  const onSubmit = async (data: FormData) => {
    if (!productId) return;
    setSaveLoading(true);
    try {
      await api.put(`/products/${productId}`, data);
      setSuccess(true);
      setTimeout(() => {
        startTransition(() => router.push("/admin/products"));
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update product");
    } finally {
      setSaveLoading(false);
    }
  };

  if (!user) return <div className=\"min-h-screen flex items-center justify-center\">Loading...</div>;

  if (loading) return (
    <div className=\"min-h-screen flex items-center justify-center\">
      <div className=\"text-lg\">Loading product...</div>
    </div>
  );

  if (!product) return (
    <div className=\"min-h-screen flex items-center justify-center text-red-600\">
      <div>{error || \"Product not found\"}</div>
    </Link>
  );

  return (
    <div className=\"min-h-screen bg-gray-50 p-8\">
      <div className=\"max-w-2xl mx-auto\">
        <div className=\"flex items-center justify-between mb-8\">
          <Link 
            href=\"/admin/products\" 
            className=\"inline-flex items-center text-blue-600 hover:text-blue-700 font-medium\"
          >
            <ArrowLeft className=\"h-5 w-5 mr-2\" /> Back to Products
          </Link>
          <div className=\"text-sm text-gray-500\">Editing: {product.name}</div>
        </div>

        <div className=\"bg-white rounded-2xl shadow-xl p-8 border border-gray-200\">
          <h1 className=\"text-3xl font-bold text-gray-900 mb-6\">Edit Product</h1>
          
          {error && (
            <div className=\"mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800\">
              {error}
            </div>
          )}
          {success && (
            <div className=\"mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800\">
              Product updated successfully!
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className=\"space-y-6\">
            {/* Name */}
            <div>
              <label className=\"block text-sm font-medium text-gray-700 mb-2\">Product Name *</label>
              <Input
                {...register(\"name\")}
                className=\"w-full\"
                placeholder=\"Product name\"
              />
              {errors.name && <p className=\"text-red-500 text-sm mt-1\">{errors.name.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label className=\"block text-sm font-medium text-gray-700 mb-2\">Description</label>
              <Input
                as=\"textarea\"
                rows={4}
                {...register(\"description\")}
                className=\"w-full resize-vertical\"
                placeholder=\"Product description...\"
              />
              {errors.description && <p className=\"text-red-500 text-sm mt-1\">{errors.description.message}</p>}
            </div>

            {/* Price & Stock */}
            <div className=\"grid grid-cols-2 gap-6\">
              <div>
                <label className=\"block text-sm font-medium text-gray-700 mb-2\">Price * ($)</label>
                <Input
                  type=\"number\"
                  step=\"0.01\"
                  {...register(\"price\", { valueAsNumber: true })}
                  className=\"w-full\"
                />
                {errors.price && <p className=\"text-red-500 text-sm mt-1\">{errors.price.message}</p>}
              </div>
              <div>
                <label className=\"block text-sm font-medium text-gray-700 mb-2\">Stock *</label>
                <Input
                  type=\"number\"
                  {...register(\"stock\", { valueAsNumber: true })}
                  className=\"w-full\"
                />
                {errors.stock && <p className=\"text-red-500 text-sm mt-1\">{errors.stock.message}</p>}
              </div>
            </div>

            {/* Image & SKU */}
            <div className=\"grid grid-cols-2 gap-6\">
              <div>
                <label className=\"block text-sm font-medium text-gray-700 mb-2\">Image URL</label>
                <Input
                  {...register(\"image_url\")}
                  className=\"w-full\"
                  placeholder=\"https://picsum.photos/400/300\"
                />
                {errors.image_url && <p className=\"text-red-500 text-sm mt-1\">{errors.image_url.message}</p>}
              </div>
              <div>
                <label className=\"block text-sm font-medium text-gray-700 mb-2\">SKU</label>
                <Input
                  {...register(\"sku\")}
                  className=\"w-full\"
                />
                {errors.sku && <p className=\"text-red-500 text-sm mt-1\">{errors.sku.message}</p>}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className=\"block text-sm font-medium text-gray-700 mb-2\">Category *</label>
              <select
                {...register(\"category_id\", { valueAsNumber: true })}
                disabled={categoriesLoading}
                className=\"w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500\"
              >
                <option value=\"\">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category_id && <p className=\"text-red-500 text-sm mt-1\">{errors.category.message}</p>}
            </div>

            {/* Buttons */}
            <div className=\"flex gap-4 pt-4\">
              <button
                type=\"submit\"
                disabled={saveLoading}
                className=\"flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50\"
              >
                {saveLoading ? (
                  <>
                    <Upload className=\"h-4 w-4 mr-2 animate-spin\" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className=\"h-4 w-4 mr-2\" />
                    Update Product
                  </>
                )}
              </button>
              <Link
                href=\"/admin/products\"
                className=\"flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-center\"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

