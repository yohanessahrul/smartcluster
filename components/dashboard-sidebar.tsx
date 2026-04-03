"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Home, House, ReceiptText, Users, WalletCards } from "lucide-react";

import { useAuthSession } from "@/lib/auth-client";
import { BrandMark } from "@/components/brand-mark";
import { UserMenuCta } from "@/components/user-menu-cta";
import { cn } from "@/lib/utils";

const adminMenus = [
  { href: "/dashboard/admin", label: "Beranda", icon: Home },
  { href: "/dashboard/admin/history", label: "Riwayat", icon: History },
  { href: "/dashboard/admin/users", label: "Pengguna", icon: Users },
  { href: "/dashboard/admin/houses", label: "Rumah", icon: House },
  { href: "/dashboard/admin/bills", label: "IPL", icon: ReceiptText },
  { href: "/dashboard/admin/transactions", label: "Transaksi", icon: WalletCards },
] as const;

const financeMenus = adminMenus.filter(
  (menu) =>
    menu.href === "/dashboard/admin" ||
    menu.href === "/dashboard/admin/bills" ||
    menu.href === "/dashboard/admin/transactions"
);

export function AdminSidebar() {
  const pathname = usePathname();
  const { loading, session } = useAuthSession();
  const role = session?.role;
  const isFinance = role === "finance";
  const isAdmin = role === "admin" || role === "superadmin";
  const visibleMenus = loading ? [] : isFinance ? financeMenus : isAdmin ? adminMenus : [];
  const panelLabel = isFinance ? "Finance Panel" : "Admin Panel";
  const displayName = session?.name?.trim() || "User";
  const displayEmail = session?.email?.trim() || "-";

  return (
    <aside className="h-full overflow-y-auto rounded-lg border border-border bg-[hsl(var(--menu-bg))] p-4 text-[hsl(var(--menu-fg))] lg:rounded-none">
      <div className="mb-6 hidden items-center gap-3 rounded-lg bg-[hsl(var(--menu-note))] p-3 lg:flex">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/85 p-1">
          <BrandMark className="h-7 w-7" />
        </div>
        <div>
          <p className="font-heading text-base">Hunita</p>
          <p className="text-xs text-[hsl(var(--menu-muted))]">{panelLabel}</p>
        </div>
      </div>

      {session ? (
        <div className="mb-4 lg:hidden">
          <UserMenuCta
            name={displayName}
            email={displayEmail}
            className="w-full"
            buttonClassName="w-full justify-between border-[hsl(var(--menu-border))] bg-white/80 text-black hover:bg-white"
            dropdownClassName="left-0 right-0 w-full border-[hsl(var(--menu-border))] bg-white/95"
          />
        </div>
      ) : null}

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
        {!loading && !visibleMenus.length ? (
          <p className="px-3 py-2 text-xs text-[hsl(var(--menu-muted))]">Menu tidak tersedia untuk role ini.</p>
        ) : null}
      </nav>
    </aside>
  );
}
