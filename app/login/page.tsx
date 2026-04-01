import { LoginForm } from "@/components/login-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { users } from "@/lib/mock-data";

export default function LoginPage() {
  const demoAdmin = users.find((item) => item.role === "admin");
  const demoFinance = users.find((item) => item.role === "finance");
  const demoWarga = users.filter((item) => item.role === "warga").slice(0, 3);

  return (
    <div className="container py-10">
      <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Login Smart Perumahan</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Akun Demo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Gunakan email pada daftar ini. Password ditentukan saat login pertama (minimal 8 karakter).
            </p>
            <p className="text-xs text-muted-foreground">Jika lupa password, gunakan tombol `Lupa Password? Reset` di form login.</p>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Admin</p>
              <p className="font-medium">{demoAdmin?.email}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Finance</p>
              <p className="font-medium">{demoFinance?.email}</p>
            </div>
            {demoWarga.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-medium">{item.name}</p>
                  <Badge variant="outline">warga</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.email}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
