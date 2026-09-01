"use client";

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CodeDoc - AI Codebase Doctor",
  description: "Self-hostable AI codebase diagnosis, findings, and dependency risk",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>
          <div className="min-h-screen bg-background">
            {sidebarOpen && (
              <div
                className="fixed inset-0 z-10 bg-black/50 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className={`transition-all duration-300 ease-out-expo ${sidebarOpen ? "lg:pl-60" : ""}`}>
              <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-sm">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background transition-colors duration-200 hover:bg-muted"
                  aria-label={sidebarOpen ? "Close menu" : "Open menu"}
                >
                  {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
              </div>
              <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
