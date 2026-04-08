"use client";

import { ReactNode } from "react";

import { UserMenuCta } from "@/components/user-menu-cta";
import { useAuthSession } from "@/lib/auth-client";

type DashboardHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function DashboardHeader({ title, description, actions }: DashboardHeaderProps) {
  const { session } = useAuthSession();

  const displayName = session?.name?.trim() || "User";
  const displayEmail = session?.email?.trim() || "-";

  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl tracking-tight md:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {session ? <UserMenuCta name={displayName} email={displayEmail} className="hidden lg:block" /> : null}
      </div>
    </header>
  );
}
