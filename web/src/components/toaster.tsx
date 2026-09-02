"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      richColors
      closeButton
      toastOptions={{
        style: {
          border: "1px solid hsl(216 26% 15%)",
          background: "hsl(223 44% 5%)",
        },
      }}
    />
  );
}