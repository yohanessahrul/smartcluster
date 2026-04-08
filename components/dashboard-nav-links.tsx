"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type DashboardMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
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
        return (
          <Link
            key={menu.href}
            href={menu.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[hsl(var(--menu-active))] text-white"
                : "text-[hsl(var(--menu-fg))] hover:bg-[hsl(var(--menu-note))]",
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

