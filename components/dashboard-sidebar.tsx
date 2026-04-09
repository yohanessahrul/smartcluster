"use client";

import { usePathname } from "next/navigation";
import { History, Home, House, ReceiptText, ShieldEllipsis, Users, WalletCards } from "lucide-react";

import { useAuthSession } from "@/lib/auth-client";
import { BrandMark } from "@/components/brand-mark";
import { DashboardNavLinks } from "@/components/dashboard-nav-links";
import { isAdminLikeRole, isFinanceRole } from "@/lib/role-access";

const baseAdminMenus = [
  { href: "/dashboard/admin", label: "Beranda", icon: Home },
  { href: "/dashboard/admin/history", label: "Riwayat", icon: History },
  { href: "/dashboard/admin/users", label: "Pengguna", icon: Users },
  { href: "/dashboard/admin/houses", label: "Rumah", icon: House },
  { href: "/dashboard/admin/bills", label: "IPL", icon: ReceiptText },
  { href: "/dashboard/admin/transactions", label: "Transaksi", icon: WalletCards },
] as const;

const devOnlyMenu = {
  href: "/dashboard/admin/dev-only",
  label: "Dev Only",
  icon: ShieldEllipsis,
  tone: "dev-only" as const,
};

const financeMenus = baseAdminMenus.filter(
  (menu) =>
    menu.href === "/dashboard/admin" ||
    menu.href === "/dashboard/admin/bills" ||
    menu.href === "/dashboard/admin/transactions"
);

export function AdminSidebar() {
  const pathname = usePathname();
  const { loading, session } = useAuthSession();
  const role = session?.role;
  const isFinance = isFinanceRole(role);
  const isAdmin = isAdminLikeRole(role);
  const isSuperadmin = role === "superadmin";
  const visibleMenus = loading
    ? []
    : isFinance
      ? financeMenus
      : isSuperadmin
        ? [...baseAdminMenus, devOnlyMenu]
        : isAdmin
          ? baseAdminMenus
          : [];
  const panelLabel = isFinance ? "Finance Panel" : "Admin Panel";

  return (
    <aside className="h-full overflow-y-auto bg-[hsl(var(--menu-bg))] p-0 text-[hsl(var(--menu-fg))] lg:rounded-none lg:border lg:border-border lg:p-4">
      <div className="mb-6 hidden items-center gap-3 rounded-lg bg-[hsl(var(--menu-note))] p-3 lg:flex">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/85 p-1">
          <BrandMark className="h-7 w-7" />
        </div>
        <div>
          <p className="font-heading text-base">Hunita</p>
          <p className="text-xs text-[hsl(var(--menu-muted))]">{panelLabel}</p>
        </div>
      </div>

      <nav className="space-y-1">
        <DashboardNavLinks menus={visibleMenus} pathname={pathname} />
        {!loading && !visibleMenus.length ? (
          <p className="px-3 py-2 text-xs text-[hsl(var(--menu-muted))]">Menu tidak tersedia untuk role ini.</p>
        ) : null}
      </nav>
    </aside>
  );
}
