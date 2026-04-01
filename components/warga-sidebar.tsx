"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ClipboardList, Home, LogOut, Receipt, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logout, useWargaResolvedData } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const overviewMenu = { href: "/dashboard/warga", label: "Overview", icon: Home } as const;

const protectedMenus = [
  { href: "/dashboard/warga", label: "Overview", icon: Home },
  { href: "/dashboard/warga/profile", label: "Profil", icon: UserRound },
  { href: "/dashboard/warga/tagihan", label: "IPL", icon: Receipt },
  { href: "/dashboard/warga/riwayat", label: "Riwayat Bayar", icon: ClipboardList },
  { href: "/dashboard/warga/laporan", label: "Laporan Dana", icon: BarChart3 },
] as const;

export function WargaSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, house, loading } = useWargaResolvedData();
  const hasHouse = Boolean(house);
  const menus = hasHouse ? protectedMenus : [overviewMenu];

  async function onLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside className="rounded-2xl border border-border bg-[hsl(var(--menu-bg))] p-4 text-[hsl(var(--menu-fg))]">
      <div className="mb-6 rounded-lg bg-[hsl(var(--menu-note))] p-3">
        <p className="font-heading text-sm">Portal Warga</p>
        <p className="text-xs text-[hsl(var(--menu-muted))]">Akses tagihan dan transparansi dana</p>
        {session?.email ? <p className="mt-1 text-xs text-[hsl(var(--menu-muted))]">{session.email}</p> : null}
        {!loading && !hasHouse ? (
          <p className="mt-2 rounded-md border border-[hsl(var(--menu-border))] bg-white/70 px-2 py-1 text-[11px] leading-relaxed text-[hsl(var(--menu-muted))]">
            Akun masih dalam proses verifikasi data rumah. Untuk sementara, menu yang tersedia hanya Overview.
          </p>
        ) : null}
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
      </nav>

      <p className="mt-6 flex items-center gap-2 rounded-lg bg-[hsl(var(--menu-note))] px-3 py-2 text-xs text-[hsl(var(--menu-muted))]">
        <ShieldCheck className="h-3.5 w-3.5" />
        Data pembayaran dapat dipantau warga secara real-time.
      </p>

      <Button type="button" variant="outline" size="sm" className="mt-3 w-full border-[hsl(var(--menu-border))] bg-transparent" onClick={onLogout}>
        <LogOut className="mr-1 h-4 w-4" />
        Logout
      </Button>
    </aside>
  );
}
