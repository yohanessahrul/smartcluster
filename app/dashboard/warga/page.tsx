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

        const latestBill = [...data.houseBills].sort((a, b) => b.id.localeCompare(a.id))[0];

        return (
          <div>
            <DashboardHeader
              title="Dashboard Warga"
              description={`Profil rumah ${data.house.id} - Blok ${data.house.blok} No ${data.house.nomor}`}
            />

            <section className="mb-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tagihan Aktif</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Periode</p>
                  <p className="font-heading text-xl">{latestBill?.periode ?? "-"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Nominal IPL</p>
                  <p className="font-heading text-3xl">{latestBill?.amount ?? "-"}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {latestBill ? (
                      <PaymentStatusBadge status={latestBill.status} />
                    ) : (
                      <Badge variant="outline">Belum Ada Tagihan</Badge>
                    )}
                    <span className="inline-flex items-center text-xs text-muted-foreground">
                      <CalendarClock className="mr-1 h-3.5 w-3.5" />
                      Jatuh tempo tiap tanggal 10
                    </span>
                  </div>
                  <div className="mt-4">
                    <Button asChild className="rounded-full">
                      <Link href="/dashboard/warga/tagihan">Lihat Tagihan</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
                        <DateTimeText value={item.date} />
                      </p>
                      <p className="text-xs text-muted-foreground">{item.payment_method}</p>
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
