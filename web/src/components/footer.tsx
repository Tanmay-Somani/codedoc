"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, GitBranch, HeartHandshake, Mail, Package } from "lucide-react";
import { resetTour } from "@/lib/tour";

export function Footer() {
  const router = useRouter();

  const startTour = () => {
    resetTour();
    router.push("/repositories?tour=1");
  };

  return (
    <footer className="mx-auto mt-24 max-w-6xl px-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-6 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" />
          CodeDoc v0.1.0
          <span className="mx-1 text-border">·</span>
          <button
            onClick={startTour}
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Compass className="h-3.5 w-3.5" />
            Guided tour
          </button>
          <span className="mx-1 text-border">·</span>
          <Link href="/integrations" className="transition-colors hover:text-foreground">
            Platform health
          </Link>
        </p>
        <p className="flex flex-wrap items-center gap-1.5">
          <HeartHandshake className="h-3.5 w-3.5" />
          Built by Tanmay Somani
          <span className="mx-1 text-border">·</span>
          <a
            href="https://github.com/Tanmay-Somani"
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <GitBranch className="h-3.5 w-3.5" />
            GitHub
          </a>
          <span className="mx-1 text-border">·</span>
          <a
            href="mailto:tanmaysomani2003@gmail.com"
            className="flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
            Contact
          </a>
        </p>
      </div>
    </footer>
  );
}