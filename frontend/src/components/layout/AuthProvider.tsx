"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { Navbar } from "./Navbar";

interface Props {
  children: React.ReactNode;
}

export function AuthProvider({ children }: Props) {
  const { initAuth, isInitialized } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

