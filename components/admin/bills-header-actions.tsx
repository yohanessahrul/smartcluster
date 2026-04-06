"use client";

import { ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth-client";
import { canAccessAdminPanel } from "@/lib/role-access";

const OPEN_GENERATE_IPL_EVENT = "smart-open-generate-ipl";

export function BillsHeaderActions() {
  const { session } = useAuthSession();
  const hasAccess = canAccessAdminPanel(session?.role);

  if (!hasAccess) return null;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.dispatchEvent(new Event(OPEN_GENERATE_IPL_EVENT))}
    >
      <ReceiptText className="mr-2 h-4 w-4" />
      Generate IPL
    </Button>
  );
}
