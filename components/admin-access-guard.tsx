"use client";

import Link from "next/link";
import { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthSession } from "@/lib/auth-client";

type AdminAccessGuardProps = {
  children: ReactNode;
};

export function AdminAccessGuard({ children }: AdminAccessGuardProps) {
  const { loading, session } = useAuthSession();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Memuat sesi admin...</CardTitle>
        </CardHeader>
      </Card>
    );
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

  if (session.role !== "admin" && session.role !== "finance") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Akun tidak sesuai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Email {session.email} terdaftar sebagai warga. Gunakan akun admin atau finance untuk panel ini.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/warga">Buka Dashboard Warga</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
