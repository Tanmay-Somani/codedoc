import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CodedoC - AI Codebase Doctor",
  description: "AI-powered codebase diagnosis in your own infrastructure",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}