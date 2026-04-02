/**
 * src/hooks/useAuth.ts
 * ─────────────────────
 * React hook encapsulating all auth actions.
 * Keeps components clean — they call login/register/logout,
 * never touch the store or API client directly.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import type { TokenResponse, User } from "@/types";

export function useAuth() {
  const router = useRouter();
  const { setAccessToken, setUser, clearAuth, user, isAuthenticated } = useAuthStore();
  const { fetchCart, clearLocalCart } = useCartStore();

  const login = useCallback(
    async (email: string, password: string) => {
      const tokenResp = await api.post<TokenResponse>("/auth/login", { email, password });
      setAccessToken(tokenResp.access_token);

      const me = await api.get<User>("/auth/me");
      setUser(me);
      await fetchCart();

      router.push("/products");
    },
    [setAccessToken, setUser, fetchCart, router]
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
    }) => {
      await api.post("/auth/register", data);
      // Auto-login after registration
      await login(data.email, data.password);
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Even if the request fails, clear client-side state
    }
    clearAuth();
    clearLocalCart();
    router.push("/auth/login");
  }, [clearAuth, clearLocalCart, router]);

  return { login, register, logout, user, isAuthenticated };
}
