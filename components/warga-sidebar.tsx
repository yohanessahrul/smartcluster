"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Receipt, ShieldCheck, UserRound } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { useAuthSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const overviewMenu = { href: "/dashboard/warga", label: "Beranda", icon: Home } as const;

const protectedMenus = [
  { href: "/dashboard/warga", label: "Beranda", icon: Home },
  { href: "/dashboard/warga/profile", label: "Profil", icon: UserRound },
  { href: "/dashboard/warga/tagihan", label: "IPL", icon: Receipt },
  { href: "/dashboard/warga/laporan", label: "Laporan Dana", icon: BarChart3 },
] as const;

export function WargaSidebar() {
  const pathname = usePathname();
  const { loading, session } = useAuthSession();
  const isWarga = session?.role === "warga";
  const hasHouse = session?.hasHouse ?? true;
  const menus = loading ? [] : isWarga ? (hasHouse ? protectedMenus : [overviewMenu]) : [];

  return (
    <aside className="h-full overflow-y-auto bg-[hsl(var(--menu-bg))] p-0 text-[hsl(var(--menu-fg))] lg:rounded-none lg:border lg:border-border lg:p-4">
      <div className="mb-6 hidden items-center gap-3 rounded-lg bg-[hsl(var(--menu-note))] p-3 lg:flex">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/85 p-1">
          <BrandMark className="h-7 w-7" />
        </div>
        <div>
          <p className="font-heading text-sm">Hunita</p>
          <p className="text-xs text-[hsl(var(--menu-muted))]">Portal Warga</p>
        </div>
      </div>

      <nav className="space-y-1">
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
                  : "text-[hsl(var(--menu-fg))] hover:bg-[hsl(var(--menu-note))]"
              )}
            >
              <menu.icon className="h-4 w-4" />
              <span>{menu.label}</span>
            </Link>
          );
        })}
        {!loading && !menus.length ? (
          <p className="px-3 py-2 text-xs text-[hsl(var(--menu-muted))]">Menu tidak tersedia untuk role ini.</p>
        ) : null}
      </nav>

      <p className="mt-6 flex items-center gap-2 rounded-lg bg-[hsl(var(--menu-note))] px-3 py-2 text-xs text-[hsl(var(--menu-muted))]">
        <ShieldCheck className="h-3.5 w-3.5" />
        Data pembayaran dapat dipantau warga secara real-time.
      </p>
    </aside>
  );
}
