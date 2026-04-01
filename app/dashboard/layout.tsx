import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="container py-6 md:py-8">{children}</div>;
}
