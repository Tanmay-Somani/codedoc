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
import { motion } from "framer-motion";

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge, exact: true },
  { href: "/repositories", label: "Repositories", icon: Boxes },
  { href: "/findings", label: "Findings", icon: Radar },
  { href: "/dependencies", label: "Dependencies", icon: ShieldCheck },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

function HealthIndicator() {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary/60" />
      <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 ring-2 ring-primary">
        <Bug className="h-3.5 w-3.5 text-primary" />
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-border/50 bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-3 border-b border-white/5 px-4">
        <HealthIndicator />
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight">CodeDoc</div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-primary/70">
            AI Doctor
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {navItems.map(({ href, label, icon: Icon, exact }, i) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ease-out-expo",
                  active
                    ? "text-white"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/5"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-primary/15"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className={cn("relative z-10 h-4 w-4 transition-colors duration-200", active && "text-primary")} />
                <span className="relative z-10">{label}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/50"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-breathe rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          All systems operational
        </motion.div>
      </div>
    </aside>
  );
}
