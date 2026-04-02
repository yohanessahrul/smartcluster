"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { SessionRole, logout } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type UserMenuCtaProps = {
  name: string;
  email: string;
  role?: SessionRole;
  variant?: "app" | "landing";
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
};

export function UserMenuCta({
  name,
  email,
  role,
  variant = "app",
  className,
  buttonClassName,
  dropdownClassName,
}: UserMenuCtaProps) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dashboardHref = role === "warga" ? "/dashboard/warga" : "/dashboard/admin";
  const showDashboardCta = variant === "landing" && Boolean(role);
  const showRoleBadge = variant === "landing" && Boolean(role);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setOpenMenu(false);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  async function onLogout() {
    await logout();
    setOpenMenu(false);
    router.push("/login");
  }

  function onOpenDashboard() {
    setOpenMenu(false);
    router.push(dashboardHref);
  }

  const roleLabel = role ? role : null;

  return (
    <div ref={menuRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        className={cn("h-10 rounded-lg px-3", buttonClassName)}
        aria-label="Buka menu akun"
        aria-expanded={openMenu}
        onClick={() => setOpenMenu((prev) => !prev)}
      >
        <span className="max-w-[180px] truncate text-left text-sm">Hi, {name}</span>
        <ChevronDown className="ml-2 h-4 w-4" />
      </Button>

      {openMenu ? (
        <div className={cn("absolute right-0 z-30 mt-2 w-56 rounded-lg border border-border bg-background p-1 shadow-md", dropdownClassName)}>
          <div className="rounded-md px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            {showRoleBadge && roleLabel ? (
              <div className="mt-1">
                <RoleBadge role={roleLabel} />
              </div>
            ) : null}
          </div>
          {showDashboardCta ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
              onClick={onOpenDashboard}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
