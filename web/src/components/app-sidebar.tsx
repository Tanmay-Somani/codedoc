"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bug,
  Gauge,
  Plug,
  Radar,
  Settings,
  ShieldCheck,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge, exact: true },
  { href: "/repositories", label: "Repositories", icon: Boxes },
  { href: "/findings", label: "Findings", icon: Radar },
  { href: "/dependencies", label: "Dependencies", icon: ShieldCheck },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bug className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">CodeDoc</div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
            AI Codebase Doctor
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/20 text-white"
                  : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-sidebar-foreground/60">
          <Activity className="h-4 w-4 text-emerald-400" />
          System online
        </div>
      </div>
    </aside>
  );
}
