import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen px-4 py-6 md:px-6 md:py-8">{children}</div>;
}
