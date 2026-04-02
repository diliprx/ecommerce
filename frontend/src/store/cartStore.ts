/**
 * src/store/cartStore.ts
 * ───────────────────────
 * Cart state mirrors server cart — single source of truth is the backend.
 * Client state is a cache that is refreshed after every mutation.
 */
import { create } from "zustand";
import { api } from "@/lib/api";
import type { Cart } from "@/types";

interface CartState {
  cart: Cart | null;
  isLoading: boolean;

  fetchCart: () => Promise<void>;
  addItem: (productId: number, quantity: number) => Promise<void>;
  removeItem: (productId: number) => Promise<void>;
  clearLocalCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  isLoading: false,

  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const cart = await api.get<Cart>("/cart");
      set({ cart });
    } catch {
      set({ cart: null });
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (productId, quantity) => {
    set({ isLoading: true });
    try {
      const cart = await api.post<Cart>("/cart/add", { product_id: productId, quantity });
      set({ cart });
    } finally {
      set({ isLoading: false });
    }
  },

  removeItem: async (productId) => {
    set({ isLoading: true });
    try {
      const cart = await api.delete<Cart>("/cart/remove", { product_id: productId });
      set({ cart });
    } finally {
      set({ isLoading: false });
    }
  },

  clearLocalCart: () => set({ cart: null }),
}));
