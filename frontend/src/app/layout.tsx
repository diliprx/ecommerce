// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

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
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <main className="min-h-screen bg-gray-50">{children}</main>
        <footer className="bg-white border-t py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} ShopNext. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
