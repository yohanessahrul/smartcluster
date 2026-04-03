import {
  BellRing,
  Building2,
  CalendarClock,
  Database,
  FileCheck2,
  HardDrive,
  Home,
  NotebookText,
  ReceiptText,
  ShieldCheck,
  Upload,
  Users,
  Wallet,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { LandingTypingWord } from "@/components/landing-typing-word";
import { LandingGenerateIplWidget } from "@/components/landing-generate-ipl-widget";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserMenuCta } from "@/components/user-menu-cta";
import { readSessionFromToken } from "@/lib/server/auth-session";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
  { label: "Need Verification", value: "48 • Rp7,2 Jt", icon: BellRing, tone: "warning" },
  { label: "Need Follow Up", value: "24 • Rp3,6 Jt", icon: WalletCards },
  { label: "Unit Summary", value: "248 Rumah • 220 Dihuni", icon: Home },
];

const financeQueue = [
  { unit: "B-03", period: "April 2026", amount: "Rp150.000", status: "Menunggu Verifikasi" },
  { unit: "C-21", period: "April 2026", amount: "Rp150.000", status: "Menunggu Verifikasi" },
  { unit: "D-18", period: "April 2026", amount: "Rp150.000", status: "Menunggu Verifikasi" },
] as const;

const financeLatestTransactions = [
  {
    detail: "Pembayaran IPL Warga",
    amount: "Rp150.000",
    method: "Transfer Bank",
    status: "Menunggu Verifikasi",
  },
  {
    detail: "Pembayaran IPL Cluster",
    amount: "Rp300.000",
    method: "QRIS",
    status: "Menunggu Verifikasi",
  },
] as const;

const features = [
  {
    title: "Timeline Status IPL Transparan",
    copy: "Status pembayaran terlihat runtut dari ditagihkan, upload bukti, sampai diverifikasi finance.",
  },
  {
    title: "Dashboard Role-Based",
    copy: "Admin/Superadmin, Finance, dan Warga memiliki menu serta hak akses yang dipisah sesuai tanggung jawab.",
  },
  {
    title: "Generate IPL Massal",
    copy: "Satu CTA untuk generate IPL semua rumah per bulan, dan tombol otomatis nonaktif jika periode sudah pernah digenerate.",
  },
  {
    title: "Verifikasi Pembayaran",
    copy: "Finance memproses alur status pembayaran sampai Lunas dengan histori perubahan yang jelas.",
  },
  {
    title: "Riwayat Global Terpusat",
    copy: "Riwayat perubahan dipusatkan pada menu Riwayat khusus admin/superadmin agar loading halaman data utama tetap ringan.",
  },
  {
    title: "Status Server + Refresh Widget",
    copy: "Di Beranda admin/superadmin tersedia CTA Status Server dan Refresh widget untuk monitoring server serta pembaruan snapshot.",
  },
] as const;

const futureFeature = ["Notifikasi Tagihan", "Reminder Belum Bayar", "Booking Fasilitas", "Marketplace Warga", "Laporan Pengeluaran Detail"] as const;

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Hunita",
  description: "Sistem Management Perumahan yang transparan.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: APP_URL,
};

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <div className="absolute -left-24 bottom-[-180px] h-80 w-80 rounded-full bg-[hsl(var(--spark-amber))] blur-3xl" />
      <div className="absolute -right-14 -top-20 h-72 w-72 rounded-full bg-[hsl(var(--spark-teal))] blur-3xl" />

      <div className="container relative z-10 py-6 md:py-9">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center p-1">
              <BrandMark className="h-8 w-8" />
            </div>
            <div>
              <p className="font-heading text-xl font-semibold">Hunita</p>
            </div>
          </div>
          {!hasActiveSession ? (
            <Button asChild className="rounded-full">
              <Link href="/login">Login</Link>
            </Button>
          ) : session ? (
            <UserMenuCta name={session.name || "User"} email={session.email} role={session.role} variant="landing" />
          ) : null}
        </header>

        <section className="relative mb-6 overflow-visible pb-6 md:pb-8">
          <div className="relative z-10 w-full pr-0 sm:pr-[170px] lg:pr-[260px]">
            <h1 className="w-full max-w-none font-heading text-[1.75rem] leading-[1.3] tracking-tight sm:max-w-4xl sm:text-5xl sm:leading-[1.2] md:text-6xl">
              <span className="relative inline-block font-black after:absolute after:bottom-0 after:left-0 after:h-[0.2em] after:w-full after:rounded-full after:bg-[hsl(var(--primary)/0.26)]">
                Solusi digital
              </span>{" "}
              untuk
              <br />
              administrasi perumahan
              <br />
              yang lebih <LandingTypingWord />
            </h1>
            <p className="mt-4 w-full max-w-none text-muted-foreground sm:max-w-3xl">
              Semua kebutuhan administrasi perumahan kini bisa dikelola lebih mudah dalam satu tempat
            </p>
          </div>

          <div className="pointer-events-none absolute right-[30px] top-1/2 z-0 hidden w-full max-w-[180px] -translate-y-1/2 sm:block sm:right-3 sm:max-w-[250px] lg:right-6 lg:max-w-[325px]">
            <Image
              src="/brand/finance-hero-illustration.svg"
              alt="Ilustrasi transaksi keuangan"
              width={900}
              height={780}
              priority
              className="animate-cloud-bounce relative mx-auto h-auto w-full drop-shadow-[0_14px_26px_hsl(var(--primary)/0.2)]"
            />
          </div>
        </section>

        <Card className="mb-6 mt-10 border-border/90 bg-card/95 md:mt-12">
          <CardHeader className="pb-4">
            <CardTitle>Mockup Dashboard Terbaru</CardTitle>
            <CardDescription>Preview visual tampilan dashboard web dan mobile sesuai implementasi saat ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="admin" className="w-full">
              <TabsList className="flex w-full max-w-full justify-start gap-1 overflow-x-auto">
                <TabsTrigger value="admin" className="shrink-0">
                  Admin
                </TabsTrigger>
                <TabsTrigger value="finance" className="shrink-0">
                  Finance
                </TabsTrigger>
                <TabsTrigger value="warga" className="shrink-0">
                  Warga
                </TabsTrigger>
              </TabsList>

              <TabsContent value="admin">
                <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
                  <Card className="border-0 bg-[hsl(var(--menu-bg))] text-[hsl(var(--menu-fg))] shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-[hsl(var(--menu-muted))]">Menu Admin</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0 text-sm">
                      <div className="rounded-lg bg-[hsl(var(--menu-active))] px-3 py-2 font-medium">Beranda</div>
                      <div className="rounded-lg px-3 py-2">Riwayat</div>
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
                        <CardTitle>Aksi Cepat Beranda Admin</CardTitle>
                        <CardDescription>CTA yang tersedia di halaman Beranda admin saat ini.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full">
                            CTA: Status Server
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            CTA: Refresh widget
                          </Badge>
                        </div>
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
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                        <CardTitle>IPL Perlu Tindakan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="w-full overflow-x-auto">
                          <Table className="min-w-[560px]">
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
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>5 Transaksi Terakhir (Menunggu Verifikasi)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="w-full overflow-x-auto">
                          <Table className="min-w-[560px]">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Detail Transaksi</TableHead>
                                <TableHead>Nominal</TableHead>
                                <TableHead>Metode</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {financeLatestTransactions.map((item, index) => (
                                <TableRow key={`${item.detail}-${index}`}>
                                  <TableCell>{item.detail}</TableCell>
                                  <TableCell>{item.amount}</TableCell>
                                  <TableCell>{item.method}</TableCell>
                                  <TableCell>{statusBadge(item.status)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="warga">
                <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
                  <Card className="overflow-hidden border-0 bg-[hsl(var(--phone-bg))] text-[hsl(var(--phone-fg))]">
                    <CardContent className="space-y-4 p-4">
                      <div className="mx-auto h-4 w-24 rounded-full bg-[hsl(var(--phone-notch))]" />
                      <div>
                        <p className="text-sm text-[hsl(var(--phone-muted))]">Dashboard Warga</p>
                        <h3 className="font-heading text-lg">Halo, Budi</h3>
                      </div>
                      <div className="rounded-lg bg-white p-4 text-[hsl(var(--phone-card-ink))]">
                        <p className="text-xs text-[hsl(var(--phone-card-muted))]">Periode</p>
                        <p className="text-sm font-medium">April 2026</p>
                        <p className="mt-2 font-heading text-3xl">Rp150.000</p>
                        <p className="mt-2 text-xs text-[hsl(var(--phone-card-muted))]">Status: Menunggu Verifikasi</p>
                      </div>
                      <Button variant="secondary" className="w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                        Bayar
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
                      <div className="w-full overflow-x-auto">
                        <Table className="min-w-[560px]">
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

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card className="flex h-full w-full flex-col border-border/90 bg-card/95 lg:col-span-1">
            <CardHeader>
              <CardTitle>Generate tagihan otomatis</CardTitle>
              <CardDescription>Kamu tidak perlu mengingatkan setiap orang terkait kewajibannya 👮🏻‍♂️</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <LandingGenerateIplWidget />
            </CardContent>
          </Card>

          <Card className="flex h-full w-full flex-col border-border/90 bg-card/95 lg:col-span-1">
            <CardHeader>
              <CardTitle>Riwayat tagihan tertata</CardTitle>
              <CardDescription>Tenang saja, setiap proses tercatat rapih disini. Kamu juga bisa memantaunya 👀</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="h-full rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                <ol className="space-y-3">
                  <li className="relative pl-11">
                    <div className="timeline-dash-flow absolute left-[15px] top-8 h-[calc(100%+6px)] w-[2px]" aria-hidden />
                    <span className="absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background">
                      <ReceiptText className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
                      <p className="text-sm leading-relaxed">
                        <span className="font-medium">Ditagihkan oleh </span>
                        <span className="font-semibold">Admin</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">3 April 2026, 23:40</p>
                    </div>
                  </li>
                  <li className="relative pl-11">
                    <div className="timeline-dash-flow absolute left-[15px] top-8 h-[calc(100%+6px)] w-[2px]" aria-hidden />
                    <span className="absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
                      <p className="text-sm leading-relaxed">
                        <span className="font-medium">Upload bukti pembayaran oleh </span>
                        <span className="font-semibold">kamu</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">4 April 2026, 01:10</p>
                    </div>
                  </li>
                  <li className="relative pl-11">
                    <span className="absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary bg-primary">
                      <FileCheck2 className="h-4 w-4 text-primary-foreground" />
                    </span>
                    <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
                      <p className="text-sm leading-relaxed">
                        <span className="font-medium">Diverifikasi oleh </span>
                        <span className="font-semibold">Finance</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">4 April 2026, 02:42</p>
                    </div>
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
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
          <ShieldCheck className="h-4 w-4" />
          <span>Developed by Yohanes Sahrul</span>
        </footer>
      </div>
    </div>
  );
}
