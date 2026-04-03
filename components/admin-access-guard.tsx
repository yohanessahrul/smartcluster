"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoadingScreen } from "@/components/ui/page-loading-screen";
import { useAuthSession } from "@/lib/auth-client";

type AdminAccessGuardProps = {
  children: ReactNode;
};

export function AdminAccessGuard({ children }: AdminAccessGuardProps) {
  const { loading, session } = useAuthSession();
  const pathname = usePathname();

  if (loading) {
    return <PageLoadingScreen />;
  }

  if (!session?.email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Belum login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Silakan login dulu untuk mengakses dashboard admin.</p>
          <Button asChild>
            <Link href="/login">Login Sekarang</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (session.role !== "admin" && session.role !== "superadmin" && session.role !== "finance") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Akun tidak sesuai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Email {session.email} terdaftar sebagai warga. Gunakan akun admin, superadmin, atau finance untuk panel ini.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (session.role === "finance") {
    const financeAllowedPaths = new Set(["/dashboard/admin", "/dashboard/admin/bills", "/dashboard/admin/transactions"]);
    if (!financeAllowedPaths.has(pathname)) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Akses finance dibatasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Role finance hanya bisa mengakses menu Beranda, IPL, dan Transaksi.
            </p>
            <Button asChild>
              <Link href="/dashboard/admin">Buka Beranda</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }
  }

  return <>{children}</>;
}
