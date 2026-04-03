import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="container py-10">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader className="space-y-4">
            <div className="rounded-lg border border-[hsl(var(--menu-border))] bg-gradient-to-br from-[hsl(var(--menu-bg))] to-[hsl(var(--menu-note))] p-4 text-[hsl(var(--menu-fg))]">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/90 p-1 shadow-sm ring-1 ring-[hsl(var(--menu-border))]">
                <BrandMark className="h-9 w-9" />
              </div>
              <p className="font-heading text-lg">Smart Cluster</p>
              <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--menu-muted))]">
                Sistem manajemen transaksi dan IPL perumahan yang transparan, rapi, dan mudah dipantau.
              </p>
            </div>
            <div>
              <CardTitle>Masuk ke Dashboard</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Login menggunakan Google, lalu sistem akan verifikasi akses berdasarkan tabel user.
              </p>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
