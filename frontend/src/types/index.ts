// Shared TypeScript types for frontend/backend alignment
// Generated from backend Pydantic schemas

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description?: string;
  price: number;
  stock: number;
  image_url?: string;  // Legacy first image
  image_urls?: string[];
  sku?: string;
  category_id: number;
  is_active: boolean;
  category: { id: number; name: string };
}

export interface Category {
  id: number;
  name: string;
}

export interface ApiError {
  detail: string;
}

