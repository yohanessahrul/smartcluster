"use client";

import { ReactNode, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

type DashboardShellProps = {
  roleLabel: string;
  sidebar: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ roleLabel, sidebar, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function closeMobileMenu() {
      setOpen(false);
    }

    window.addEventListener("smart-close-mobile-menu", closeMobileMenu);
    return () => {
      window.removeEventListener("smart-close-mobile-menu", closeMobileMenu);
    };
  }, []);

  return (
    <>
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-white/90 p-1">
            <BrandMark className="h-6 w-6" />
          </div>
          <div>
            <p className="font-heading text-base">Smart Cluster</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Menu className="mr-1 h-4 w-4" />
          Menu
        </Button>
      </div>

      <div className="relative lg:min-h-screen">
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-[260px]">
          <div className="h-full">{sidebar}</div>
        </div>
        <main className="min-w-0 lg:ml-[272px]">{children}</main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-[hsl(var(--menu-bg))] text-[hsl(var(--menu-fg))] lg:hidden">
          <div className="flex min-h-full flex-col overflow-y-auto p-4 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-white/90 p-1">
                  <BrandMark className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-heading text-base">Smart Cluster</p>
                  <p className="text-xs text-[hsl(var(--menu-muted))]">{roleLabel}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[hsl(var(--menu-border))] bg-white/80 text-black hover:bg-white"
                onClick={() => setOpen(false)}
              >
                <X className="mr-1 h-4 w-4" />
                Tutup
              </Button>
            </div>

            <div className="flex-1">
              <div className="rounded-lg bg-white/45 p-3 shadow-sm [&>aside]:h-full [&>aside]:rounded-none [&>aside]:border-0 [&>aside]:bg-transparent [&>aside]:p-0">
                {sidebar}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
