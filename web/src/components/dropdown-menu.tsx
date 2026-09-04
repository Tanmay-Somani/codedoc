"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export interface DropdownItem {
  label: string;
  icon?: React.ElementType;
  description?: string;
  onSelect?: () => void;
}

interface DropdownMenuProps {
  items: DropdownItem[];
  trigger: (open: boolean) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({
  items,
  trigger,
  align = "right",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute z-50 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-border/60 bg-popover p-1 shadow-xl shadow-black/10",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {items.map((item, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect?.();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
                >
                  {item.icon && <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="flex flex-col">
                    <span>{item.label}</span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
