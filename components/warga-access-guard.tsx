"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Home, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWargaResolvedData } from "@/lib/auth-client";

type WargaAccessGuardProps = {
  children: (data: ReturnType<typeof useWargaResolvedData>) => ReactNode;
};

export function WargaAccessGuard({ children }: WargaAccessGuardProps) {
  const data = useWargaResolvedData();
  const pathname = usePathname();

  if (data.loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Memuat profil warga...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!data.session?.email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Belum login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Silakan login menggunakan email yang terdaftar pada house.</p>
          <Button asChild>
            <Link href="/login">Login Sekarang</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (data.session.role !== "warga") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Akun tidak sesuai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Akun ini bukan role warga. Silakan login ulang sebagai warga.</p>
          <Button asChild>
            <Link href="/login">Login Ulang</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const houseNotLinked = !data.house;
  const isOverviewPage = pathname === "/dashboard/warga" || pathname === "/dashboard/warga/";

  if (houseNotLinked && !isOverviewPage) {
    return (
      <Card className="border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))]">
        <CardHeader>
          <CardTitle>Akun Belum Terhubung ke Data Rumah</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Akun kamu masih belum terhubung dengan data rumah. Admin sedang melakukan evaluasi data agar akses menu
            warga tetap aman dan tepat sasaran.
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sementara ini hanya menu Overview yang tersedia. Reload berkala atau segera hubungi admin.
          </p>
          <Button asChild>
            <Link href="/dashboard/warga">
              <Home className="mr-1 h-4 w-4" />
              Kembali ke Overview
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children(data)}</>;
}
