"use client";

import { DashboardHeader } from "@/components/dashboard-header";
import { ApiLoadingState } from "@/components/ui/api-loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthSession } from "@/lib/auth-client";

export default function AdminProfilePage() {
  const { loading, session } = useAuthSession();

  return (
    <div>
      <DashboardHeader title="Profile" description="Informasi akun yang sedang login." />

      <Card>
        <CardHeader>
          <CardTitle>Detail Akun</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {loading ? (
            <ApiLoadingState message="Memuat data akun..." />
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">Nama:</span> {session?.name ?? "-"}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span> {session?.email ?? "-"}
              </p>
              <p>
                <span className="text-muted-foreground">Role:</span> {session?.role ?? "-"}
              </p>
              <p>
                <span className="text-muted-foreground">User ID:</span> {session?.userId ?? "-"}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
