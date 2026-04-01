"use client";

import Link from "next/link";
import { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWargaResolvedData } from "@/lib/auth-client";

type WargaAccessGuardProps = {
  children: (data: ReturnType<typeof useWargaResolvedData>) => ReactNode;
};

export function WargaAccessGuard({ children }: WargaAccessGuardProps) {
  const data = useWargaResolvedData();

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

  if (!data.house) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>House profile tidak ditemukan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Email {data.session.email} belum terhubung ke house mana pun. Hubungkan dulu dari menu Admin Houses.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/admin/houses">Buka Houses Admin</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children(data)}</>;
}
