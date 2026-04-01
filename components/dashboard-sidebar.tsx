"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Home, House, LogOut, ReceiptText, Users, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logout, useAuthSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const menus = [
  { href: "/dashboard/admin", label: "Overview", icon: Home },
  { href: "/dashboard/admin/users", label: "Users", icon: Users },
  { href: "/dashboard/admin/houses", label: "Houses", icon: House },
  { href: "/dashboard/admin/bills", label: "IPL", icon: ReceiptText },
  { href: "/dashboard/admin/transactions", label: "Transactions", icon: WalletCards },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuthSession();
  const visibleMenus =
    session?.role === "finance"
      ? menus.filter((menu) => menu.href === "/dashboard/admin" || menu.href === "/dashboard/admin/bills")
      : menus;
  const panelLabel = session?.role === "finance" ? "Finance Panel" : "Admin Panel";

  async function onLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside className="rounded-2xl border border-border bg-[hsl(var(--menu-bg))] p-4 text-[hsl(var(--menu-fg))]">
      <div className="mb-6 flex items-center gap-3 rounded-lg bg-[hsl(var(--menu-note))] p-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <div>
          <p className="font-heading text-sm">Smart Perumahan</p>
          <p className="text-xs text-[hsl(var(--menu-muted))]">{panelLabel}</p>
          {session?.email ? <p className="text-xs text-[hsl(var(--menu-muted))]">{session.email}</p> : null}
        </div>
      </div>

      <nav className="space-y-1">
        {visibleMenus.map((menu) => {
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

      <p className="mt-6 rounded-lg bg-[hsl(var(--menu-note))] px-3 py-2 text-xs text-[hsl(var(--menu-muted))]">
        IPL Bulanan Rp150.000 • Jatuh tempo setiap tanggal 10
      </p>

      <Button type="button" variant="outline" size="sm" className="mt-3 w-full border-[hsl(var(--menu-border))] bg-transparent" onClick={onLogout}>
        <LogOut className="mr-1 h-4 w-4" />
        Logout
      </Button>
    </aside>
  );
}
