"use client";

import { Badge } from "@/components/ui/badge";
import { CanonicalPaymentStatus, normalizePaymentStatus } from "@/lib/payment-status";
import { cn } from "@/lib/utils";

type PaymentStatusBadgeProps = {
  status: string | null | undefined;
  className?: string;
};

function variantByStatus(status: CanonicalPaymentStatus) {
  if (status === "Lunas") return "success" as const;
  if (status === "Menunggu Verifikasi") return "warning" as const;
  if (status === "Verifikasi") return "info" as const;
  return "danger" as const;
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const normalized = normalizePaymentStatus(status);
  if (!normalized) return <Badge variant="outline" className={className}>{status || "-"}</Badge>;
  return <Badge variant={variantByStatus(normalized)} className={cn(className)}>{normalized}</Badge>;
}
