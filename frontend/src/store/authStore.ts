/**
 * src/store/authStore.ts
 * ───────────────────────
 * Global auth state using Zustand.
 *
 * Security: accessToken lives in JS memory (Zustand state), never in
 * localStorage or sessionStorage — those are vulnerable to XSS.
 * The refresh token is stored in an HTTP-only cookie managed by the server.
 */
import { create } from "zustand";
import { api } from "@/lib/api";
import type { User, TokenResponse } from "@/types";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;

  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isInitialized: false,

  setAccessToken: (token) =>
    set({ accessToken: token, isAuthenticated: !!token }),

  setUser: (user) => set({ user }),

  clearAuth: () =>
    set({ accessToken: null, user: null, isAuthenticated: false, isInitialized: true }),

  initAuth: async () => {
    set({ isInitialized: false });
    try {
      // First refresh using cookie to get new access token
      const tokenResp = await api.post<TokenResponse>("/auth/refresh-token");
      set({ accessToken: tokenResp.access_token });
      
      // Then get user profile with new token
      const user = await api.get<User>("/auth/me");
      set({ user, isAuthenticated: true, isInitialized: true });
    } catch {
      // clearAuth already sets isInitialized: true
    }
  },
}));

