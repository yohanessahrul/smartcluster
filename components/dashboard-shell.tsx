"use client";

import { ReactNode, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

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

  return (
    <>
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <div>
          <p className="font-heading text-base">Smart Perumahan</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Menu className="mr-1 h-4 w-4" />
          Menu
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block">{sidebar}</div>
        <main className="min-w-0">{children}</main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/45"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          />
          <div className="absolute right-0 top-0 h-full w-[86%] max-w-[320px] overflow-y-auto p-3">
            <div className="mb-2 flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                <X className="mr-1 h-4 w-4" />
                Tutup
              </Button>
            </div>
            {sidebar}
          </div>
        </div>
      ) : null}
    </>
  );
}
