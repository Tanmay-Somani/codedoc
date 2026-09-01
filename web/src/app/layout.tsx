import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>
          <div className="min-h-screen bg-background">
            <AppSidebar />
            <main className="pl-60">
              <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
