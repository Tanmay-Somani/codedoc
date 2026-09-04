"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Gauge,
  Boxes,
  Radar,
  ShieldCheck,
  Plug,
  Settings,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/repositories", label: "Repositories", icon: Boxes },
  { href: "/findings", label: "Findings", icon: Radar },
  { href: "/dependencies", label: "Dependencies", icon: ShieldCheck },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-border/50 bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-out-expo lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <nav aria-label="Main navigation" className="flex-1 space-y-0.5 overflow-y-auto p-2 pt-4">
        {navItems.map(({ href, label, icon: Icon }, i) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            >
              <Link
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out-expo",
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
    </aside>
  );
}
