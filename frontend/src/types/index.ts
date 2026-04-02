// src/types/index.ts
// Central type definitions — mirror backend Pydantic schemas

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "user" | "admin";
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: string; // Decimal comes as string from JSON
  stock: number;
  image_url: string | null;
  category: Category;
  created_at: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CartItem {
  id: number;
  product: Product;
  quantity: number;
}

export interface Cart {
  id: number;
  items: CartItem[];
  total: string;
}

export interface Address {
  id: number;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  is_default: boolean;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  price_at_purchase: string;
  quantity: number;
}

export interface Payment {
  id: number;
  gateway: string;
  transaction_id: string;
  amount: string;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  paid_at: string | null;
}

export interface Order {
  id: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  total_amount: string;
  currency: string;
  notes: string | null;
  items: OrderItem[];
  address: Address;
  payment: Payment | null;
  created_at: string;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  page: number;
  limit: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ApiError {
  detail: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

// ── Query param types ─────────────────────────────────────────
export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: number;
  min_price?: number;
  max_price?: number;
}
