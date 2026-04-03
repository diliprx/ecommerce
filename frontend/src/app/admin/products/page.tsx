"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, Search, ChevronLeft, ChevronRight, Edit3 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Product {
  id: number;
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  image_url?: string;
  sku?: string;
  category: { id: number; name: string };
  is_active: boolean;
}

interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState(searchParams.get("search") || "");

  // Auth guard + redirect if not admin
  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin") {
      router.push("/admin");
      return;
    }
  }, [isAuthenticated, user?.role, router]);

  const fetchProducts = useCallback(async (pageNum: number = page, searchTerm: string = search) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      });
      if (searchTerm) params.append("search", searchTerm);
      
      const response = await api.get<ProductListResponse>(`/products?${params}`);
      // Defensive: ensure products is always array
      setProducts(Array.isArray(response.products) ? response.products : []);
      setTotal(response.total || 0);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError("Failed to load products. Please try again.");
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Fetch on mount + search/page changes
  useEffect(() => {
    if (!isAuthenticated) return; // Wait for auth
    fetchProducts();
  }, [search, page, isAuthenticated, fetchProducts]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
  };

  const handleDelete = async (id: number) => {
    const productName = products.find(p => p.id === id)?.name || "this product";
    if (!confirm(`Delete "${productName}"?`)) return;
    
    try {
      setDeleting(id);
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (error) {
      alert("Delete failed. Check if product is in use.");
      console.error(error);
    } finally {
      setDeleting(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Unified render: auth + data + no errors
  if (!isAuthenticated || !user) {
    return <div className="min-h-screen flex items-center justify-center text-lg">Checking authentication...</div>;
  }

  if (user.role !== "admin") {
    return <div className="min-h-screen flex items-center justify-center text-lg text-red-600">Access denied. Admins only.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Manage Products</h1>
            <p className="text-xl text-gray-600 mt-2">
              {total} products | Page {page}
            </p>
          </div>
          <Link
            href="/admin/add"
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
          >
            ➕ Add New Product
          </Link>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-8 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-4 py-3 border-gray-200 focus:ring-orange-500"
            />
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-800">{error}</p>
            <Button variant="outline" onClick={() => fetchProducts()} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {/* Products Table */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <p className="text-2xl text-gray-500 mb-4">No products found</p>
            <p className="text-gray-500 mb-8">{search ? `for "${search}"` : "Get started by adding your first product."}</p>
            <Link href="/admin/add" className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-3 rounded-xl font-semibold">
              ➕ Add First Product
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Image</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">  
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {product.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-12 w-12 object-cover rounded-lg" />
                        ) : (
                          <div className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500">
                            No img
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.sku}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold text-green-600">
                        ${product.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.category.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="text-blue-600 hover:text-blue-900 p-2 -m-2 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deleting === product.id}
                          className="text-red-600 hover:text-red-900 p-2 -m-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between mt-8 px-4 py-3 bg-white border-t border-gray-200 rounded-b-2xl shadow-sm sm:px-6">
                <div className="text-sm text-gray-700">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} products
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page * limit >= total}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
