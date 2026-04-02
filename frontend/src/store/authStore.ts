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
import type { User } from "@/types";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;

  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAccessToken: (token) =>
    set({ accessToken: token, isAuthenticated: true }),

  setUser: (user) => set({ user }),

  clearAuth: () =>
    set({ accessToken: null, user: null, isAuthenticated: false }),
}));
