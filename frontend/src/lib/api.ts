/**
 * src/lib/api.ts
 * ──────────────
 * Axios instance configured for the FastAPI backend.
 *
 * Security decisions:
 *  • Access token stored in memory (Zustand) — NOT localStorage (XSS risk)
 *  • Refresh token stored in HTTP-only cookie (set by server) — JS cannot read it
 *  • On 401, silently attempts token refresh before retrying the request
 *  • withCredentials: true — required for the HTTP-only refresh cookie to be sent
 *  • Axios automatically sets Content-Type and validates JSON
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/store/authStore";
import type { TokenResponse } from "@/types";

const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000/api/v1";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,     // send HTTP-only refresh cookie on every request
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

// ── Request interceptor: attach access token ──────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // SSR-safe: only add token from store on client-side
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor: handle 401 → refresh ────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue requests while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers["Authorization"] = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const resp = await axios.post<TokenResponse>(
          `${BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }    // sends the HTTP-only refresh cookie
        );
        const newToken = resp.data.access_token;
        if (typeof window !== 'undefined') {
          useAuthStore.getState().setAccessToken(newToken);
        }
        processQueue(null, newToken);
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          useAuthStore.getState().clearAuth();
          window.location.href = "/auth/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Typed helpers ──────────────────────────────────────────────
export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    apiClient.get<T>(url, { params }).then((r) => r.data),

  post: <T>(url: string, data?: unknown) =>
    apiClient.post<T>(url, data).then((r) => r.data),

  put: <T>(url: string, data?: unknown) =>
    apiClient.put<T>(url, data).then((r) => r.data),

  delete: <T>(url: string, data?: unknown) =>
    apiClient.delete<T>(url, { data }).then((r) => r.data),
};

export default apiClient;
