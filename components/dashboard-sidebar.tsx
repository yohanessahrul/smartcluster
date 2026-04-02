"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChevronDown, Home, House, LogOut, ReceiptText, Server, Users, WalletCards } from "lucide-react";
import { useState } from "react";

import { logout, useAuthSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
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
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const visibleMenus =
    session?.role === "finance"
      ? menus.filter(
          (menu) =>
            menu.href === "/dashboard/admin" ||
            menu.href === "/dashboard/admin/bills" ||
            menu.href === "/dashboard/admin/transactions"
        )
      : menus;
  const panelLabel = session?.role === "finance" ? "Finance Panel" : "Admin Panel";
  const displayName = session?.name?.trim() || "User";
  const displayRole = session?.role?.trim() || "-";
  const serverStatusHref = pathname === "/dashboard/admin" ? "/dashboard/admin" : "/dashboard/admin?statusServer=1";

  async function onLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside className="h-full overflow-y-auto rounded-lg border border-border bg-[hsl(var(--menu-bg))] p-4 text-[hsl(var(--menu-fg))] lg:rounded-none">
      <div className="mb-6 flex items-center gap-3 rounded-lg bg-[hsl(var(--menu-note))] p-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <div>
          <p className="font-heading text-base">Smart Cluster</p>
          <p className="text-xs text-[hsl(var(--menu-muted))]">{panelLabel}</p>
        </div>
      </div>

      {session ? (
        <div className="mb-4 lg:hidden">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-between rounded-lg border-[hsl(var(--menu-border))] bg-white/80 px-3 text-black hover:bg-white"
            aria-label="Buka menu akun"
            aria-expanded={mobileAccountOpen}
            onClick={() => setMobileAccountOpen((prev) => !prev)}
          >
            <span className="max-w-[220px] truncate text-left text-sm">Hi, {displayName}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileAccountOpen ? "rotate-180" : ""}`} />
          </Button>

          {mobileAccountOpen ? (
            <div className="mt-2 rounded-lg border border-[hsl(var(--menu-border))] bg-white/70 p-3">
              <p className="truncate text-sm font-semibold text-[hsl(var(--menu-fg))]">{displayName}</p>
              <p className="text-xs text-[hsl(var(--menu-muted))]">{`Role : ${displayRole}`}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-9 w-full justify-start rounded-lg border-destructive bg-white text-destructive hover:bg-destructive/10"
                onClick={onLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <nav className="space-y-1">
        {session?.role === "admin" ? (
          <Link
            href={serverStatusHref}
            onClick={() => {
              if (typeof window === "undefined") return;
              window.dispatchEvent(new Event("smart-close-mobile-menu"));
              if (pathname === "/dashboard/admin") {
                window.dispatchEvent(new Event("smart-open-server-status"));
              }
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[hsl(var(--menu-fg))] transition-colors hover:bg-[hsl(var(--menu-note))] lg:hidden"
          >
            <Server className="h-4 w-4" />
            <span>Status Server</span>
          </Link>
        ) : null}
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
    </aside>
  );
}
