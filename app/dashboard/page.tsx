import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <h1 className="font-heading text-3xl tracking-tight md:text-4xl">Pilih Dashboard Sesuai Role</h1>
      <p className="mt-2 text-muted-foreground">
        Dashboard admin dan warga dipisahkan agar menu, data, dan alur kerja lebih fokus.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Role Admin
            </CardTitle>
            <CardDescription>Kelola data warga, rumah, tagihan, transaksi, dan monitoring pembayaran.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-full">
              <Link href="/dashboard/admin">Masuk Dashboard Admin</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Role Warga
            </CardTitle>
            <CardDescription>Lihat tagihan IPL, riwayat pembayaran, dan laporan penggunaan dana lingkungan.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/dashboard/warga">Masuk Dashboard Warga</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
