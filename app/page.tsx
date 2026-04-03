import {
  BellRing,
  Building2,
  CalendarClock,
  Database,
  HardDrive,
  Home,
  NotebookText,
  ReceiptText,
  ShieldCheck,
  Users,
  Wallet,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserMenuCta } from "@/components/user-menu-cta";
import { readSessionFromToken } from "@/lib/server/auth-session";

type Metric = {
  label: string;
  value: string;
  icon: typeof Home;
  tone?: "warning";
};

const adminMetrics: Metric[] = [
  { label: "Total Rumah", value: "284", icon: Home },
  { label: "Total Warga", value: "276", icon: Users },
  { label: "Tagihan Lunas", value: "212", icon: NotebookText },
  { label: "Belum Bayar", value: "72 Rumah", icon: BellRing, tone: "warning" },
];

const financeMetrics: Metric[] = [
  { label: "Success Payment", value: "212 • Rp31,8 Jt", icon: Wallet },
  { label: "Pending Payment", value: "48 • Rp7,2 Jt", icon: BellRing, tone: "warning" },
  { label: "Unit Active", value: "248 Rumah", icon: Home },
];

const bills = [
  { name: "Budi Santoso", unit: "A-12", period: "April 2026", amount: "Rp150.000", status: "Lunas" },
  { name: "Sri Wulandari", unit: "B-03", period: "April 2026", amount: "Rp150.000", status: "Menunggu Verifikasi" },
  { name: "Agus Pratama", unit: "C-21", period: "April 2026", amount: "Rp150.000", status: "Verifikasi" },
  { name: "Nadia Putri", unit: "A-07", period: "April 2026", amount: "Rp150.000", status: "Belum bayar" },
] as const;

const financeQueue = [
  { unit: "B-03", period: "April 2026", amount: "Rp150.000", status: "Menunggu Verifikasi" },
  { unit: "C-21", period: "April 2026", amount: "Rp150.000", status: "Verifikasi" },
  { unit: "D-18", period: "April 2026", amount: "Rp150.000", status: "Menunggu Verifikasi" },
] as const;

const paymentStages = [
  { label: "Belum bayar", note: "Tagihan sudah dibuat, belum ada bukti pembayaran." },
  { label: "Menunggu Verifikasi", note: "Warga sudah upload bukti, menunggu pengecekan finance." },
  { label: "Verifikasi", note: "Data pembayaran sedang diverifikasi." },
  { label: "Lunas", note: "Pembayaran valid dan tercatat sebagai pemasukan." },
] as const;

const features = [
  {
    title: "Dashboard Role-Based",
    copy: "Admin, Finance, dan Warga memiliki menu dan hak akses berbeda sesuai kebutuhan operasional.",
  },
  {
    title: "Generate IPL Massal",
    copy: "Satu CTA untuk generate IPL semua rumah per bulan dengan status default Belum bayar.",
  },
  {
    title: "Verifikasi Pembayaran",
    copy: "Finance memproses alur status pembayaran sampai Lunas dengan histori perubahan yang jelas.",
  },
  {
    title: "Jurnal Umum Warga",
    copy: "Warga melihat ringkasan jurnal dari transaksi yang sudah lunas per periode.",
  },
  {
    title: "Status Server",
    copy: "Admin dapat memantau kapasitas database 500MB dan storage bucket 1GB langsung dari dashboard.",
  },
  {
    title: "Audit & Histori",
    copy: "Semua table utama memiliki histori perubahan dengan before/after value dan author.",
  },
] as const;

const futureFeature = ["Notifikasi Tagihan", "Reminder Belum Bayar", "Booking Fasilitas", "Marketplace Warga", "Laporan Pengeluaran Detail"] as const;

function statusBadge(status: string) {
  return <PaymentStatusBadge status={status} />;
}

export default async function Page() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("smart_perumahan_session")?.value;
  const session = readSessionFromToken(sessionToken);
  const hasActiveSession = Boolean(session);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute -left-24 bottom-[-180px] h-80 w-80 rounded-full bg-[hsl(var(--spark-amber))] blur-3xl" />
      <div className="absolute -right-14 -top-20 h-72 w-72 rounded-full bg-[hsl(var(--spark-teal))] blur-3xl" />

      <div className="container relative z-10 py-6 md:py-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-border/70 bg-white/90 p-1 shadow-sm">
              <BrandMark className="h-8 w-8" />
            </div>
            <div>
              <p className="font-heading text-base font-semibold">Smart Cluster</p>
              <p className="text-sm text-muted-foreground">Sistem Manajemen Transaksi & IPL</p>
            </div>
          </div>
          {!hasActiveSession ? (
            <Button asChild className="rounded-full">
              <Link href="/login">Login dengan Google</Link>
            </Button>
          ) : session ? (
            <UserMenuCta name={session.name || "User"} email={session.email} role={session.role} variant="landing" />
          ) : null}
        </header>

        <section className="mb-6">
          <Badge variant="outline" className="mb-3 rounded-full px-3 py-1 text-xs">
            Transparan • Tercatat • Verifikasi Terstruktur
          </Badge>
          <h1 className="max-w-4xl font-heading text-3xl leading-tight tracking-tight md:text-5xl">
            Operasional keuangan perumahan jadi lebih rapi dengan dashboard Admin, Finance, dan Warga.
          </h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Aplikasi berjalan dengan Google OAuth login, API Next.js, PostgreSQL/Supabase, serta tampilan responsive untuk web admin
            dan mobile warga.
          </p>
        </section>

        <Card className="mb-6 border-border/90 bg-card/95">
          <CardHeader className="pb-4">
            <CardTitle>Simulasi Dashboard Terbaru</CardTitle>
            <CardDescription>Ringkasan halaman yang saat ini tersedia di aplikasi.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="admin">
              <TabsList>
                <TabsTrigger value="admin">Admin</TabsTrigger>
                <TabsTrigger value="finance">Finance</TabsTrigger>
                <TabsTrigger value="warga">Warga</TabsTrigger>
              </TabsList>

              <TabsContent value="admin">
                <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
                  <Card className="border-0 bg-[hsl(var(--menu-bg))] text-[hsl(var(--menu-fg))] shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-[hsl(var(--menu-muted))]">Menu Admin</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0 text-sm">
                      <div className="rounded-lg bg-[hsl(var(--menu-active))] px-3 py-2 font-medium">Beranda</div>
                      <div className="rounded-lg px-3 py-2">Status Server</div>
                      <div className="rounded-lg px-3 py-2">Pengguna</div>
                      <div className="rounded-lg px-3 py-2">Rumah</div>
                      <div className="rounded-lg px-3 py-2">IPL</div>
                      <div className="rounded-lg px-3 py-2">Transaksi</div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {adminMetrics.map((metric) => (
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

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>Daftar IPL Bulanan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table className="min-w-[700px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Warga</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead>Periode</TableHead>
                              <TableHead>Nominal</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bills.map((bill) => (
                              <TableRow key={`${bill.name}-${bill.unit}`}>
                                <TableCell>{bill.name}</TableCell>
                                <TableCell>{bill.unit}</TableCell>
                                <TableCell>{bill.period}</TableCell>
                                <TableCell>{bill.amount}</TableCell>
                                <TableCell>{statusBadge(bill.status)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="finance">
                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
                  <Card className="border-0 bg-[hsl(var(--menu-bg))] text-[hsl(var(--menu-fg))] shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-[hsl(var(--menu-muted))]">Menu Finance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0 text-sm">
                      <div className="rounded-lg bg-[hsl(var(--menu-active))] px-3 py-2 font-medium">Beranda</div>
                      <div className="rounded-lg px-3 py-2">IPL</div>
                      <div className="rounded-lg px-3 py-2">Transaksi</div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {financeMetrics.map((metric) => (
                        <Card
                          key={metric.label}
                          className={metric.tone === "warning" ? "border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))]" : ""}
                        >
                          <CardContent className="flex items-start justify-between p-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                              <p className="mt-2 font-heading text-lg">{metric.value}</p>
                            </div>
                            <metric.icon className="h-4 w-4 text-muted-foreground" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>Antrian Verifikasi IPL</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table className="min-w-[620px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Unit</TableHead>
                              <TableHead>Periode</TableHead>
                              <TableHead>Nominal</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {financeQueue.map((item) => (
                              <TableRow key={`${item.unit}-${item.period}`}>
                                <TableCell>{item.unit}</TableCell>
                                <TableCell>{item.period}</TableCell>
                                <TableCell>{item.amount}</TableCell>
                                <TableCell>{statusBadge(item.status)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
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
                      <div className="rounded-lg bg-white p-4 text-[hsl(var(--phone-card-ink))]">
                        <p className="text-xs text-[hsl(var(--phone-card-muted))]">Tagihan IPL April 2026</p>
                        <p className="my-1 font-heading text-2xl">Rp150.000</p>
                        <p className="text-xs text-[hsl(var(--phone-card-muted))]">Status: Menunggu Verifikasi (bukti sudah diupload)</p>
                      </div>
                      <Button variant="secondary" className="w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                        Bayar / Upload Bukti
                      </Button>
                      <div className="rounded-lg border border-[hsl(var(--phone-chip-border))] p-3 text-sm">
                        <p className="mb-2 text-xs text-[hsl(var(--phone-muted))]">Riwayat Tagihan</p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span>
                              <DateTimeText value="2026-03-10" /> - Lunas
                            </span>
                            <strong>Rp150.000</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>
                              <DateTimeText value="2026-04-10" /> - Menunggu Verifikasi
                            </span>
                            <strong>Rp150.000</strong>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Laporan Keuangan (Jurnal Umum)</CardTitle>
                      <CardDescription>Warga melihat jurnal dari transaksi yang sudah lunas dan terkelompok per periode.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table className="min-w-[620px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Periode</TableHead>
                            <TableHead>Keterangan</TableHead>
                            <TableHead>Tipe</TableHead>
                            <TableHead>Nominal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>Maret 2026</TableCell>
                            <TableCell>Pembayaran IPL Warga (populate)</TableCell>
                            <TableCell>
                              <Badge variant="success">Pemasukan</Badge>
                            </TableCell>
                            <TableCell>Rp5.100.000</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Maret 2026</TableCell>
                            <TableCell>Pembelian Barang Inventaris</TableCell>
                            <TableCell>
                              <Badge variant="warning">Pengeluaran</Badge>
                            </TableCell>
                            <TableCell>Rp1.350.000</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {paymentStages.map((item) => (
            <Card key={item.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{statusBadge(item.label)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.note}</p>
              </CardContent>
            </Card>
          ))}
        </section>

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
            <CardDescription>Ruang pengembangan lanjutan setelah MVP stabil.</CardDescription>
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
          <span>Landing page disesuaikan dengan dashboard terbaru Smart Cluster.</span>
          <Building2 className="ml-2 h-4 w-4" />
          <ShieldCheck className="h-4 w-4" />
          <ReceiptText className="h-4 w-4" />
          <WalletCards className="h-4 w-4" />
          <Database className="h-4 w-4" />
          <HardDrive className="h-4 w-4" />
        </footer>
      </div>
    </div>
  );
}
