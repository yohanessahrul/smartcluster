import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Home,
  NotebookText,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { OverviewSnapshotRow } from "@/lib/api-client";
import { formatRupiah } from "@/lib/currency";
import { BillRow } from "@/lib/mock-data";

export type MasterWidgetTone = "default" | "warning" | "success" | "info";

export type MasterWidget = {
  id: string;
  title: string;
  value: string;
  note?: string;
  icon: LucideIcon;
  tone?: MasterWidgetTone;
};

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

function countByStatus(bills: BillRow[], status: string) {
  const target = normalizeStatus(status);
  return bills.filter((item) => normalizeStatus(item.status) === target).length;
}

export function buildAdminWidgets(admin: OverviewSnapshotRow["admin"]): MasterWidget[] {
  return [
    {
      id: "admin-total-houses",
      title: "Total Rumah",
      value: String(admin?.total_houses ?? 0),
      icon: Home,
    },
    {
      id: "admin-total-warga",
      title: "Total Warga",
      value: String(admin?.total_warga ?? 0),
      icon: Users,
    },
    {
      id: "admin-paid-count",
      title: "Tagihan Lunas",
      value: String(admin?.paid_count ?? 0),
      icon: NotebookText,
      tone: "success",
    },
    {
      id: "admin-unpaid-count",
      title: "Belum Bayar",
      value: String(admin?.unpaid_count ?? 0),
      icon: Wallet,
      tone: "warning",
    },
  ];
}

export function buildFinanceWidgets(finance: OverviewSnapshotRow["finance"]): MasterWidget[] {
  return [
    {
      id: "finance-success-payment",
      title: "Success Payment",
      value: String(finance?.success_count ?? 0),
      note: formatRupiah(finance?.success_total ?? 0),
      icon: CheckCircle2,
      tone: "success",
    },
    {
      id: "finance-need-verification",
      title: "Need Verification",
      value: String(finance?.need_verification_count ?? 0),
      note: formatRupiah(finance?.need_verification_total ?? 0),
      icon: Clock3,
      tone: "info",
    },
    {
      id: "finance-need-follow-up",
      title: "Need Follow Up",
      value: String(finance?.need_follow_up_count ?? 0),
      note: formatRupiah(finance?.need_follow_up_total ?? 0),
      icon: AlertCircle,
      tone: "warning",
    },
    {
      id: "finance-unit-summary",
      title: "Unit Summary",
      value: `${finance?.total_unit_count ?? 0} Rumah`,
      note: `${finance?.occupied_unit_count ?? 0} Dihuni`,
      icon: Home,
    },
  ];
}

export function buildWargaWidgets(houseBills: BillRow[]): MasterWidget[] {
  const totalTagihan = houseBills.length;
  const totalLunas = countByStatus(houseBills, "Lunas");
  const totalVerifikasi = countByStatus(houseBills, "Menunggu Verifikasi");
  const totalBelumBayar = countByStatus(houseBills, "Belum bayar");

  return [
    {
      id: "warga-total-tagihan",
      title: "Total Tagihan",
      value: String(totalTagihan),
      icon: NotebookText,
    },
    {
      id: "warga-total-lunas",
      title: "Lunas",
      value: String(totalLunas),
      icon: CheckCircle2,
      tone: "success",
    },
    {
      id: "warga-menunggu-verifikasi",
      title: "Menunggu Verifikasi",
      value: String(totalVerifikasi),
      icon: Clock3,
      tone: "info",
    },
    {
      id: "warga-belum-bayar",
      title: "Belum Bayar",
      value: String(totalBelumBayar),
      icon: Wallet,
      tone: "warning",
    },
  ];
}
