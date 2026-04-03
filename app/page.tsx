import {
  Building2,
  CalendarClock,
  Database,
  HardDrive,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { UserMenuCta } from "@/components/user-menu-cta";
import { readSessionFromToken } from "@/lib/server/auth-session";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
    title: "Status Server + Refresh",
    copy: "Di Beranda admin tersedia CTA Status Server dan Refresh Data untuk monitoring dan update snapshot.",
  },
  {
    title: "Riwayat Global",
    copy: "Riwayat perubahan dipusatkan pada menu Riwayat agar loading halaman data utama tetap ringan.",
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
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-border/70 bg-white/90 p-1 shadow-sm">
              <BrandMark className="h-8 w-8" />
            </div>
            <div>
              <p className="font-heading text-base font-semibold">Hunita</p>
              <p className="text-sm text-muted-foreground">Sistem Management Perumahan yang transparan.</p>
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
            <CardTitle>Mockup Dashboard Terbaru</CardTitle>
            <CardDescription>Preview visual tampilan dashboard web dan mobile sesuai implementasi saat ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Mockup Dashboard Web (MacBook)</p>
                <div className="rounded-2xl border border-border/80 bg-zinc-900/95 p-3 shadow-xl">
                  <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-zinc-700" />
                  <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[hsl(var(--background))]">
                    <div className="flex items-center gap-2 border-b border-border bg-zinc-100 px-3 py-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      <div className="ml-2 rounded-md bg-white px-2 py-0.5 text-[10px] text-muted-foreground">
                        hunita.vercel.app/dashboard/admin
                      </div>
                    </div>

                    <div className="grid grid-cols-[170px_1fr]">
                      <aside className="border-r border-border bg-[hsl(var(--menu-bg))] p-3 text-[hsl(var(--menu-fg))]">
                        <p className="mb-3 text-xs text-[hsl(var(--menu-muted))]">Admin Panel</p>
                        <div className="space-y-1 text-xs">
                          <div className="rounded-md bg-[hsl(var(--menu-active))] px-2 py-1.5 text-white">Beranda</div>
                          <div className="rounded-md px-2 py-1.5">Riwayat</div>
                          <div className="rounded-md px-2 py-1.5">Pengguna</div>
                          <div className="rounded-md px-2 py-1.5">Rumah</div>
                          <div className="rounded-md px-2 py-1.5">IPL</div>
                          <div className="rounded-md px-2 py-1.5">Transaksi</div>
                        </div>
                      </aside>

                      <div className="space-y-3 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">Beranda Admin</p>
                            <p className="text-[11px] text-muted-foreground">Ringkasan operasional IPL terbaru</p>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="h-6 px-2 text-[10px]">
                              Status Server
                            </Badge>
                            <Badge variant="outline" className="h-6 px-2 text-[10px]">
                              Refresh Data
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div className="rounded-lg border border-border p-2">
                            <p className="text-[10px] text-muted-foreground">Total Rumah</p>
                            <p className="text-sm font-semibold">284</p>
                          </div>
                          <div className="rounded-lg border border-border p-2">
                            <p className="text-[10px] text-muted-foreground">Total Warga</p>
                            <p className="text-sm font-semibold">276</p>
                          </div>
                          <div className="rounded-lg border border-border p-2">
                            <p className="text-[10px] text-muted-foreground">Tagihan Lunas</p>
                            <p className="text-sm font-semibold">212</p>
                          </div>
                          <div className="rounded-lg border border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))] p-2">
                            <p className="text-[10px] text-muted-foreground">Belum Bayar</p>
                            <p className="text-sm font-semibold">72</p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-border p-2">
                          <p className="mb-2 text-[10px] text-muted-foreground">IPL Perlu Tindakan</p>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1">
                              <span>Blok A11 • April 2026</span>
                              {statusBadge("Menunggu Verifikasi")}
                            </div>
                            <div className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1">
                              <span>Blok B03 • April 2026</span>
                              {statusBadge("Belum bayar")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mx-auto mt-2 h-2 w-48 rounded-b-xl bg-zinc-700" />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Mockup Dashboard Mobile (Handphone)</p>
                <div className="mx-auto w-[290px] rounded-[28px] border border-border/70 bg-[hsl(var(--phone-bg))] p-3 text-[hsl(var(--phone-fg))] shadow-xl">
                  <div className="mx-auto mb-3 h-4 w-24 rounded-full bg-[hsl(var(--phone-notch))]" />
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-[hsl(var(--phone-muted))]">Dashboard Warga</p>
                      <p className="font-heading text-lg">Halo, Budi</p>
                    </div>
                    <div className="rounded-lg bg-white p-3 text-[hsl(var(--phone-card-ink))]">
                      <p className="text-[11px] text-[hsl(var(--phone-card-muted))]">Tagihan IPL April 2026</p>
                      <p className="my-1 font-heading text-2xl">Rp150.000</p>
                      <p className="text-[11px] text-[hsl(var(--phone-card-muted))]">Status: Menunggu Verifikasi</p>
                    </div>
                    <div className="rounded-lg border border-[hsl(var(--phone-chip-border))] p-3">
                      <p className="mb-2 text-[11px] text-[hsl(var(--phone-muted))]">Riwayat Tagihan</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span>Maret 2026</span>
                          {statusBadge("Lunas")}
                        </div>
                        <div className="flex items-center justify-between">
                          <span>April 2026</span>
                          {statusBadge("Menunggu Verifikasi")}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[hsl(var(--phone-chip-border))] p-3">
                      <p className="mb-2 text-[11px] text-[hsl(var(--phone-muted))]">Menu Warga</p>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <Badge variant="secondary">Beranda</Badge>
                        <Badge variant="secondary">Profil</Badge>
                        <Badge variant="secondary">IPL</Badge>
                        <Badge variant="secondary">Riwayat Bayar</Badge>
                        <Badge variant="secondary">Laporan Dana</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
          <span>Landing page disesuaikan dengan dashboard terbaru Hunita.</span>
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
