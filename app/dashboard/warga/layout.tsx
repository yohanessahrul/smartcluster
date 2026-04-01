import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard-shell";
import { WargaSidebar } from "@/components/warga-sidebar";

export default function WargaLayout({ children }: { children: ReactNode }) {
  return <DashboardShell roleLabel="Portal Warga" sidebar={<WargaSidebar />}>{children}</DashboardShell>;
}
