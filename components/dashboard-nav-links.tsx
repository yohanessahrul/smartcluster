"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type DashboardMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone?: "default" | "dev-only";
};

type DashboardNavLinksProps = {
  menus: readonly DashboardMenuItem[];
  pathname: string;
};

export function DashboardNavLinks({ menus, pathname }: DashboardNavLinksProps) {
  return (
    <>
      {menus.map((menu) => {
        const active = pathname === menu.href;
        const isDevOnly = menu.tone === "dev-only";
        return (
          <Link
            key={menu.href}
            href={menu.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active && isDevOnly && "bg-black text-white ring-1 ring-white/20",
              !active && isDevOnly && "bg-black text-white hover:bg-black/90",
              active && !isDevOnly && "bg-[hsl(var(--menu-active))] text-white",
              !active && !isDevOnly && "text-[hsl(var(--menu-fg))] hover:bg-[hsl(var(--menu-note))]",
            )}
          >
            <menu.icon className="h-4 w-4" />
            <span>{menu.label}</span>
          </Link>
        );
      })}
    </>
  );
}
