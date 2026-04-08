"use client";

import Link from "next/link";
import { CalendarClock, RefreshCw, ShieldCheck, Sparkles, Wallet } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";

function badgeClassForCreditCard(status: string | null | undefined) {
  const lowered = status?.trim().toLowerCase() ?? "";
  const base = "border-0 shadow-[0_8px_18px_-12px_rgba(0,0,0,0.7)]";
  if (lowered === "belum bayar" || lowered === "belum dibayar") return `${base} !bg-rose-500 !text-white`;
  if (lowered === "pending" || lowered === "menunggu verifikasi" || lowered === "menunggu_verifikasi") {
    return `${base} !bg-amber-300 !text-amber-950`;
  }
  if (lowered === "verifikasi") return `${base} !bg-sky-300 !text-sky-950`;
  if (lowered === "lunas") return `${base} !bg-emerald-300 !text-emerald-950`;
  return `${base} !bg-white/90 !text-slate-900`;
}

function normalizeAmountLabel(amount: string | null | undefined) {
  if (!amount) return "-";
  return amount.replace(/^rp\.?\s*/i, "").trim();
}

function normalizePeriode(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function currentPeriodeLabel() {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

export default function WargaDashboardPage() {
  const shouldLogTableData = process.env.NODE_ENV !== "production";

  return (
    <WargaAccessGuard>
      {(data) => {
        if (shouldLogTableData) {
          console.log("[Table][Warga Overview] houseBills:", data.houseBills);
          console.log("[Table][Warga Overview] houseTransactions:", data.houseTransactions);
        }

        if (!data.house) {
          return (
            <div>
              <DashboardHeader
                title="Dashboard Warga"
                description="Akun kamu sedang menunggu proses sinkronisasi dengan data unit rumah."
              />

              <section className="mb-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <Card className="border-[hsl(var(--warning-border))] bg-gradient-to-br from-[hsl(var(--warning-bg))] to-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-[hsl(var(--warning-ink))]" />
                      Akun Sedang Diverifikasi
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Akun kamu masih belum terhubung dengan data rumah, admin sedang mengevaluasi dulu. Reload
                      berkala atau segera hubungi admin agar prosesnya lebih cepat.
                    </p>
                    <div className="space-y-2 rounded-lg border border-[hsl(var(--warning-border))] bg-white/70 p-3 text-sm">
                      <p className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-[hsl(var(--warning-ink))]" />
                        Selama verifikasi berlangsung, akses menu dibatasi hanya ke Beranda.
                      </p>
                      <p className="flex items-start gap-2">
                        <RefreshCw className="mt-0.5 h-4 w-4 text-[hsl(var(--warning-ink))]" />
                        Lakukan refresh status secara berkala untuk cek apakah data unit sudah terhubung.
                      </p>
                    </div>
                    <div>
                      <Button type="button" onClick={() => void data.refresh()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reload Status
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Yang Akan Aktif Setelah Terhubung</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Tagihan IPL per periode beserta status pembayarannya.</p>
                    <p>Riwayat transaksi pembayaran untuk unit rumah kamu.</p>
                    <p>Laporan dana lingkungan agar penggunaan kas lebih transparan.</p>
                  </CardContent>
                </Card>
              </section>
            </div>
          );
        }

        const currentPeriode = currentPeriodeLabel();
        const currentPeriodBills = data.houseBills.filter(
          (item) => normalizePeriode(item.periode) === normalizePeriode(currentPeriode),
        );
        const activeBill = [...currentPeriodBills].sort((a, b) => b.id.localeCompare(a.id))[0];
        const billPeriodeById = new Map(data.houseBills.map((bill) => [bill.id, bill.periode]));
        return (
          <div>
            <DashboardHeader
              title="Dashboard Warga"
              description="Monitoring pembayaranmu."
            />

            <section className="mb-4">
              <Link
                href="/dashboard/warga/tagihan"
                aria-label="Buka menu IPL"
                className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]"
              >
                <Card className="relative overflow-hidden border-0 bg-[linear-gradient(140deg,hsl(176_56%_16%)_0%,hsl(168_63%_24%)_45%,hsl(176_45%_12%)_100%)] text-white shadow-[0_22px_45px_-26px_rgba(4,41,36,0.95)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_28px_48px_-24px_rgba(4,41,36,0.95)]">
                  <div className="pointer-events-none absolute -right-16 -top-14 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_65%)]" />
                  <div className="pointer-events-none absolute -bottom-20 -left-14 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,204,128,0.34)_0%,rgba(255,204,128,0)_68%)]" />

                  <CardHeader className="relative pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.26em] text-white/70">Tagihan Aktif</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {activeBill ? (
                          <PaymentStatusBadge
                            status={activeBill.status}
                            className={badgeClassForCreditCard(activeBill.status)}
                          />
                        ) : (
                          <Badge variant="outline" className="bg-transparent text-white">
                            Belum Ada Tagihan
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="relative space-y-3.5 pb-7 pr-[220px] sm:pr-[260px]">
                    <div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/70">Periode</p>
                        <p className="font-heading text-2xl leading-tight text-white">{activeBill?.periode ?? "-"}</p>
                      </div>
                    </div>

                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/70">Nominal IPL</p>
                    <p className="font-heading text-2xl font-bold leading-tight text-white whitespace-nowrap">
                      Rp&nbsp;{normalizeAmountLabel(activeBill?.amount)}
                    </p>
                  </div>

                    <div className="pointer-events-none absolute right-3 top-[calc(46%-30px)] -translate-y-1/2 sm:right-5">
                      <img
                        src="/brand/cluster-lisse-logo.png"
                        alt="Cluster Lisse"
                        className="h-[96px] w-auto max-w-[210px] object-contain sm:h-[112px] sm:max-w-[240px]"
                      />
                    </div>

                    <div className="pointer-events-none absolute bottom-2 right-2">
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80 backdrop-blur-[2px]">
                        <CalendarClock className="mr-1 h-3 w-3" />
                        Jatuh tempo tiap tanggal 10
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </section>

            <Card>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle>Pembayaran Terakhir Anda</CardTitle>
                <Badge variant="outline">{data.houseTransactions.length} transaksi</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.houseTransactions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {item.bill_id ? billPeriodeById.get(item.bill_id) ?? "-" : "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <DateTimeText value={item.date} /> • {item.payment_method}
                      </p>
                    </div>
                    <p className="inline-flex items-center text-sm font-semibold">
                      <Wallet className="mr-1 h-3.5 w-3.5" />
                      {item.amount}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        );
      }}
    </WargaAccessGuard>
  );
}
