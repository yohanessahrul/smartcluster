"use client";

import Link from "next/link";
import { CalendarClock, Wallet } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDateTimeUnified } from "@/lib/date-time";

export default function WargaDashboardPage() {
  return (
    <WargaAccessGuard>
      {(data) => {
        const latestBill = [...data.houseBills].sort((a, b) => b.id.localeCompare(a.id))[0];

        return (
          <div>
            <DashboardHeader
              title="Dashboard Warga"
              description={`Profil rumah ${data.house?.id} - Blok ${data.house?.blok} No ${data.house?.nomor}`}
            />

            <section className="mb-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
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
                      <Badge variant={latestBill.status === "Lunas" ? "success" : "warning"}>{latestBill.status}</Badge>
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

              <Card>
                <CardHeader>
                  <CardTitle>Transparansi Dana</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>Kebersihan Lingkungan</span>
                      <span>40%</span>
                    </div>
                    <Progress value={40} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>Keamanan</span>
                      <span>30%</span>
                    </div>
                    <Progress value={30} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>Perbaikan Fasilitas</span>
                      <span>20%</span>
                    </div>
                    <Progress value={20} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>Dana Cadangan</span>
                      <span>10%</span>
                    </div>
                    <Progress value={10} />
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
                      <p className="text-sm font-medium">{formatDateTimeUnified(item.date)}</p>
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
