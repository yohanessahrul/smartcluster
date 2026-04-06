"use client";

import { Badge } from "@/components/ui/badge";

type PaymentStatus = "Belum bayar" | "Menunggu Verifikasi" | "Verifikasi" | "Lunas";

type PaymentStatusBadgeProps = {
  status: string | null | undefined;
};

function normalizePaymentStatus(status: string | null | undefined): PaymentStatus | null {
  if (!status) return null;
  const lowered = status.trim().toLowerCase();
  if (lowered === "lunas") return "Lunas";
  if (lowered === "pending" || lowered === "menunggu verifikasi" || lowered === "menunggu_verifikasi") {
    return "Menunggu Verifikasi";
  }
  if (lowered === "verifikasi") return "Verifikasi";
  if (lowered === "belum bayar" || lowered === "belum dibayar") return "Belum bayar";
  return null;
}

function variantByStatus(status: PaymentStatus) {
  if (status === "Lunas") return "success" as const;
  if (status === "Menunggu Verifikasi") return "warning" as const;
  if (status === "Verifikasi") return "info" as const;
  return "danger" as const;
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const normalized = normalizePaymentStatus(status);
  if (!normalized) return <Badge variant="outline">{status || "-"}</Badge>;
  return <Badge variant={variantByStatus(normalized)}>{normalized}</Badge>;
}
