import type { ReactNode } from "react";

import { AdminAccessGuard } from "@/components/admin-access-guard";
import { AdminSidebar } from "@/components/dashboard-sidebar";
import { DashboardShell } from "@/components/dashboard-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAccessGuard>
      <DashboardShell roleLabel="Admin Panel" sidebar={<AdminSidebar />}>
        {children}
      </DashboardShell>
    </AdminAccessGuard>
  );
}
