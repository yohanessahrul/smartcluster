import {
  BellRing,
  Building2,
  CalendarClock,
  CreditCard,
  Home,
  NotebookText,
  Wallet,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTimeUnified } from "@/lib/date-time";

type Metric = {
  label: string;
  value: string;
  icon: typeof Home;
  tone?: "warning";
};

const metrics: Metric[] = [
  { label: "Total Rumah", value: "284", icon: Home },
  { label: "Total Warga", value: "276", icon: Users },
  { label: "Tagihan Bulan Ini", value: "Rp42,6 Jt", icon: NotebookText },
  { label: "Pembayaran Masuk", value: "Rp31,8 Jt", icon: Wallet },
  { label: "Belum Bayar", value: "72 Rumah", icon: BellRing, tone: "warning" },
];

const bills = [
  { name: "Budi Santoso", unit: "Blok A-12", amount: "Rp150.000", status: "Lunas" },
  { name: "Sri Wulandari", unit: "Blok B-03", amount: "Rp150.000", status: "Belum Bayar" },
  { name: "Agus Pratama", unit: "Blok C-21", amount: "Rp150.000", status: "Verifikasi" },
] as const;

type TransactionItem = {
  date: string;
  title: string;
  detail: string;
  amount: string;
  expense?: boolean;
};

const transactions: TransactionItem[] = [
  { date: "2026-01-10 08:10", title: "Pembayaran IPL", detail: "Budi Santoso via Transfer", amount: "Rp150.000" },
  { date: "2026-01-11 09:05", title: "Pembayaran IPL", detail: "Nadia Putri via QRIS", amount: "Rp150.000" },
  {
    date: "2026-01-12 14:20",
    title: "Pengeluaran Kebersihan",
    detail: "Vendor Cleaning Service",
    amount: "-Rp1.500.000",
    expense: true,
  },
];

const features = [
  { title: "Manajemen Warga", copy: "Data rumah, pemilik, blok, nomor unit, dan status penghuni aktif." },
  { title: "Set IPL", copy: "Nominal iuran, periode bulanan, dan aturan jatuh tempo otomatis." },
  { title: "Tagihan Otomatis", copy: "Generate IPL per rumah tiap bulan lengkap dengan status pembayaran." },
  { title: "Pencatatan Pembayaran", copy: "Transfer, cash, QRIS, e-wallet, termasuk upload bukti transaksi." },
  { title: "Riwayat & Audit", copy: "Semua transaksi tersimpan rapi untuk rekonsiliasi kas lingkungan." },
  { title: "Laporan Keuangan", copy: "Total pemasukan, pengeluaran, saldo awal, dan saldo akhir kas." },
] as const;

const futureFeature = [
  "Notifikasi Tagihan",
  "Reminder Belum Bayar",
  "Booking Fasilitas",
  "Laporan Pengeluaran Detail",
  "Marketplace Warga",
] as const;

function statusBadge(status: string) {
  if (status === "Lunas") return <Badge variant="success">{status}</Badge>;
  if (status === "Belum Bayar") return <Badge variant="warning">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default function Page() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute -left-24 bottom-[-180px] h-80 w-80 rounded-full bg-[hsl(var(--spark-amber))] blur-3xl" />
      <div className="absolute -right-14 -top-20 h-72 w-72 rounded-full bg-[hsl(var(--spark-teal))] blur-3xl" />
      <div className="container relative z-10 py-6 md:py-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-sm font-heading font-semibold text-primary-foreground">
              SP
            </div>
            <div>
              <p className="font-heading text-base font-semibold">Smart Perumahan</p>
              <p className="text-sm text-muted-foreground">Sistem Manajemen Transaksi & IPL</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/login">Login</Link>
            </Button>
            <Button className="rounded-full">Mulai Trial</Button>
          </div>
        </header>

        <section className="mb-6">
          <Badge variant="outline" className="mb-3 rounded-full px-3 py-1 text-xs">
            Transparan • Tercatat • Mudah Dibayar
          </Badge>
          <h1 className="max-w-4xl font-heading text-3xl leading-tight tracking-tight md:text-5xl">
            Keuangan lingkungan lebih rapi dengan dashboard Admin dan panel Warga dalam satu alur.
          </h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            UI ini menggunakan komponen shadcn agar konsisten, scalable, dan siap dihubungkan ke backend
            Node.js/Express + PostgreSQL + Midtrans.
          </p>
        </section>

        <Card className="mb-6 border-border/90 bg-card/95">
          <CardHeader className="pb-4">
            <CardTitle>Simulasi User Flow</CardTitle>
            <CardDescription>Flow Admin dan Warga sesuai urutan PRD.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="admin">
              <TabsList>
                <TabsTrigger value="admin">Flow Admin</TabsTrigger>
                <TabsTrigger value="warga">Flow Warga</TabsTrigger>
              </TabsList>

              <TabsContent value="admin">
                <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
                  <Card className="border-0 bg-[hsl(var(--menu-bg))] text-[hsl(var(--menu-fg))] shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-[hsl(var(--menu-muted))]">Menu Admin</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0 text-sm">
                      <div className="rounded-lg bg-[hsl(var(--menu-active))] px-3 py-2 font-medium">Dashboard</div>
                      <div className="rounded-lg px-3 py-2">Kelola Warga</div>
                      <div className="rounded-lg px-3 py-2">Set IPL</div>
                      <div className="rounded-lg px-3 py-2">Generate Tagihan</div>
                      <div className="rounded-lg px-3 py-2">Input Pembayaran</div>
                      <div className="rounded-lg px-3 py-2">Laporan Keuangan</div>
                      <Separator className="my-2 bg-[hsl(var(--menu-border))]" />
                      <p className="rounded-lg bg-[hsl(var(--menu-note))] px-3 py-2 text-xs text-[hsl(var(--menu-fg))]">
                        Jatuh tempo IPL: setiap tanggal 10
                      </p>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {metrics.map((metric) => (
                        <Card
                          key={metric.label}
                          className={metric.tone === "warning" ? "border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))]" : ""}
                        >
                          <CardContent className="flex items-start justify-between p-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                              <p className="mt-2 font-heading text-xl">{metric.value}</p>
                            </div>
                            <metric.icon className="h-4 w-4 text-muted-foreground" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                      <Card>
                        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                          <CardTitle>Tagihan IPL Otomatis</CardTitle>
                          <Badge variant="secondary">Maret 2026</Badge>
                        </CardHeader>
                        <CardContent>
                          <Table className="min-w-[640px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Warga</TableHead>
                                <TableHead>Unit</TableHead>
                                <TableHead>Nominal</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bills.map((bill) => (
                                <TableRow key={bill.name}>
                                  <TableCell>{bill.name}</TableCell>
                                  <TableCell>{bill.unit}</TableCell>
                                  <TableCell>{bill.amount}</TableCell>
                                  <TableCell>{statusBadge(bill.status)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                          <CardTitle>Riwayat Transaksi Terbaru</CardTitle>
                          <Badge variant="outline">Realtime</Badge>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {transactions.map((item) => (
                            <div key={`${item.date}-${item.title}`} className="rounded-lg border border-border p-3">
                              <p className="text-sm font-semibold">{formatDateTimeUnified(item.date)}</p>
                              <p className="text-sm">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.detail}</p>
                              <p className={`mt-1 text-sm font-semibold ${item.expense ? "text-destructive" : "text-foreground"}`}>
                                {item.amount}
                              </p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Saldo Awal</p>
                          <p className="mt-2 font-heading text-lg">Rp10.000.000</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Pemasukan IPL</p>
                          <p className="mt-2 font-heading text-lg">Rp5.000.000</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-xs text-muted-foreground">Pengeluaran</p>
                          <p className="mt-2 font-heading text-lg">Rp1.500.000</p>
                        </CardContent>
                      </Card>
                      <Card className="border-0 bg-primary text-primary-foreground">
                        <CardContent className="p-4">
                          <p className="text-xs text-primary-foreground/80">Saldo Akhir</p>
                          <p className="mt-2 font-heading text-lg">Rp13.500.000</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="warga">
                <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
                  <Card className="overflow-hidden border-0 bg-[hsl(var(--phone-bg))] text-[hsl(var(--phone-fg))]">
                    <CardContent className="space-y-4 p-4">
                      <div className="mx-auto h-4 w-24 rounded-full bg-[hsl(var(--phone-notch))]" />
                      <div>
                        <p className="text-sm text-[hsl(var(--phone-muted))]">Dashboard Warga</p>
                        <h3 className="font-heading text-lg">Halo, Budi</h3>
                      </div>
                      <div className="rounded-2xl bg-white p-4 text-[hsl(var(--phone-card-ink))]">
                        <p className="text-xs text-[hsl(var(--phone-card-muted))]">Tagihan IPL Januari 2026</p>
                        <p className="my-1 font-heading text-2xl">Rp150.000</p>
                        <p className="text-xs text-[hsl(var(--phone-card-muted))]">
                          Jatuh tempo {formatDateTimeUnified("2026-01-10")}
                        </p>
                      </div>
                      <div>
                        <p className="mb-2 text-sm text-[hsl(var(--phone-muted))]">Pilih metode bayar</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {["Transfer", "QRIS", "E-wallet", "Cash"].map((item) => (
                            <span key={item} className="rounded-full border border-[hsl(var(--phone-chip-border))] px-3 py-1">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button variant="secondary" className="w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                        Bayar Sekarang
                      </Button>
                      <div className="rounded-lg border border-[hsl(var(--phone-chip-border))] p-3 text-sm">
                        <p className="mb-2 text-xs text-[hsl(var(--phone-muted))]">Riwayat Terakhir</p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span>{formatDateTimeUnified("2025-12-10")} - Lunas</span>
                            <strong>Rp150.000</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{formatDateTimeUnified("2025-11-10")} - Lunas</span>
                            <strong>Rp150.000</strong>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Transparansi Penggunaan Dana</CardTitle>
                      <CardDescription>Warga dapat memantau penggunaan dana kas secara langsung.</CardDescription>
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
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader className="pb-2">
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.copy}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Roadmap Future Feature</CardTitle>
            <CardDescription>Ruang pengembangan tahap berikutnya.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {futureFeature.map((item) => (
              <Badge key={item} variant="secondary" className="rounded-full bg-primary/10 text-primary">
                {item}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <footer className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          <span>Prototype UI Smart Perumahan - shadcn styling dengan palet asli.</span>
          <Building2 className="ml-2 h-4 w-4" />
          <CreditCard className="h-4 w-4" />
        </footer>
      </div>
    </div>
  );
}
