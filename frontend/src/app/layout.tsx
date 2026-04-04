// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/layout/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "ShopNext",
    template: "%s | ShopNext",
  },
  description: "Modern e-commerce store",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <footer className="bg-white border-t py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} ShopNext. All rights reserved.
        </footer>
      </body>
    </html>
  );
}

