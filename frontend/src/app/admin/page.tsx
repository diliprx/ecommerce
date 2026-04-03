"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.push("/products");
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.role !== "admin") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-xl text-gray-600 mt-2">Welcome, {user.first_name}!</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link 
            href="/admin/add"
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 group"
          >
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">➕</div>
            <h2 className="text-2xl font-bold mb-2">Add Product</h2>
            <p className="opacity-90">Add new products with images, prices, and descriptions</p>
          </Link>

          <Link 
            href="/admin/products"
            className="bg-white border-2 border-gray-200 p-8 rounded-2xl shadow-lg hover:shadow-xl hover:border-orange-200 transition-all duration-300"
          >
            <div className="text-3xl mb-4 text-orange-500">📦</div>
            <h2 className="text-xl font-bold mb-2 text-gray-900">Manage Products</h2>
            <p className="text-gray-600">View, edit, and delete products</p>
          </Link>

          <div className="bg-white border-2 border-gray-200 p-8 rounded-2xl shadow-lg">
            <div className="text-3xl mb-4 text-blue-500">👥</div>
            <h2 className="text-xl font-bold mb-2 text-gray-900">Users</h2>
            <p className="text-gray-600">Manage user accounts and roles (coming soon)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
