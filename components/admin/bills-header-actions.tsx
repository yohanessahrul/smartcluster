"use client";

import { ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth-client";

const OPEN_GENERATE_IPL_EVENT = "smart-open-generate-ipl";

export function BillsHeaderActions() {
  const { session } = useAuthSession();
  const hasAccess = session?.role === "admin" || session?.role === "superadmin" || session?.role === "finance";

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
