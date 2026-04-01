"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { logout, useAuthSession } from "@/lib/auth-client";

type DashboardHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function DashboardHeader({ title, description, actions }: DashboardHeaderProps) {
  const router = useRouter();
  const { session } = useAuthSession();
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const displayName = session?.name?.trim() || "User";
  const displayRole = session?.role?.trim() || "-";

  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl tracking-tight md:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {session ? (
          <div ref={menuRef} className="relative hidden lg:block">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg px-3"
              aria-label="Buka menu akun"
              aria-expanded={openMenu}
              onClick={() => setOpenMenu((prev) => !prev)}
            >
              <span className="max-w-[180px] truncate text-left text-sm">Hi, {displayName}</span>
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>

            {openMenu ? (
              <div className="absolute right-0 z-30 mt-2 w-48 rounded-lg border border-border bg-background p-1 shadow-md">
                <div className="rounded-md px-3 py-2">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{`Role : ${displayRole}`}</p>
                </div>
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
        ) : null}
      </div>
    </header>
  );
}
