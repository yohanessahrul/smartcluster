import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="container py-16">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Kamu sedang offline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Beberapa data mungkin belum bisa dimuat. Coba cek koneksi internet lalu kembali ke dashboard.
          </p>
          <Button asChild>
            <Link href="/">Kembali ke Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
