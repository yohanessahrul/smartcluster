"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw, ScanSearch, Server } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { MasterWidgetGrid } from "@/components/dashboard/master-widget-grid";
import { ServerStatusModal } from "@/components/admin/server-status-modal";
import { DashboardHeader } from "@/components/dashboard-header";
import { PageLoadingScreen } from "@/components/ui/page-loading-screen";
import { Badge } from "@/components/ui/badge";
import { ApiTableLoadingHead, ApiTableLoadingRow } from "@/components/ui/api-loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SuccessToast } from "@/components/ui/success-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthSession } from "@/lib/auth-client";
import { apiClient, emitDataChanged, OverviewSnapshotRow } from "@/lib/api-client";
import { formatRupiahFromAny } from "@/lib/currency";
import { buildAdminWidgets, buildFinanceWidgets } from "@/lib/master-widgets";
import { isAdminLikeRole, isFinanceRole } from "@/lib/role-access";

const EMPTY_SNAPSHOT: OverviewSnapshotRow = {
  generated_at: "",
  generated_by: "",
  admin: {
    total_houses: 0,
    owner_count: 0,
    contract_count: 0,
    total_warga: 0,
    connected_users: 0,
    manager_count: 0,
    total_bills: 0,
    pending_verification_count: 0,
    paid_count: 0,
    unpaid_count: 0,
  },
  finance: {
    success_count: 0,
    success_total: 0,
    need_verification_count: 0,
    need_verification_total: 0,
    need_follow_up_count: 0,
    need_follow_up_total: 0,
    total_unit_count: 0,
    occupied_unit_count: 0,
    need_action_rows: [],
    latest_transactions: [],
  },
  warga: {
    total_lunas: 0,
    total_menunggu_verifikasi: 0,
    total_belum_bayar: 0,
  },
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { loading: sessionLoading, session } = useAuthSession();
  const actorEmail = session?.email ?? "system@smart-cluster";
  const [snapshot, setSnapshot] = useState<OverviewSnapshotRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [showServerStatus, setShowServerStatus] = useState(false);
  const [openedFromQuery, setOpenedFromQuery] = useState(false);
  const shouldLogTableData = process.env.NODE_ENV !== "production";

  const isFinance = isFinanceRole(session?.role);
  const isAdmin = isAdminLikeRole(session?.role);

  useEffect(() => {
    void loadDashboardData();
    window.addEventListener("smart-perumahan-data-changed", loadDashboardData);
    return () => window.removeEventListener("smart-perumahan-data-changed", loadDashboardData);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const params = new URLSearchParams(window.location.search);
    const shouldOpen = params.get("statusServer") === "1";
    if (shouldOpen) {
      setShowServerStatus(true);
      setOpenedFromQuery(true);
    } else {
      setOpenedFromQuery(false);
    }
  }, [isAdmin, pathname]);

  useEffect(() => {
    function onOpenServerStatus() {
      setShowServerStatus(true);
    }

    window.addEventListener("smart-open-server-status", onOpenServerStatus);
    return () => {
      window.removeEventListener("smart-open-server-status", onOpenServerStatus);
    };
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setLoadError("");
      const response = await apiClient.getOverviewSnapshot();
      setSnapshot(response.snapshot ?? EMPTY_SNAPSHOT);
    } catch (error) {
      setSnapshot(null);
      setLoadError(error instanceof Error ? error.message : "Gagal memuat dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSnapshotData() {
    try {
      setRefreshing(true);
      setLoadError("");
      const response = await apiClient.refreshOverviewSnapshot({ actorEmail });
      setSnapshot(response.snapshot ?? EMPTY_SNAPSHOT);
      setSuccessToast("Beranda berhasil diperbarui.");
      emitDataChanged();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal refresh data overview.");
    } finally {
      setRefreshing(false);
    }
  }

  function openBillVerification(billId: string) {
    router.push(`/dashboard/admin/bills?verifyBill=${encodeURIComponent(billId)}&focus=pending-verification`);
  }

  function closeServerStatusModal() {
    setShowServerStatus(false);
    if (openedFromQuery) {
      setOpenedFromQuery(false);
      router.replace("/dashboard/admin");
    }
  }

  const safeSnapshot = snapshot ?? EMPTY_SNAPSHOT;
  const financeMetrics = safeSnapshot.finance ?? EMPTY_SNAPSHOT.finance!;
  const financeBillsNeedAction = financeMetrics.need_action_rows ?? [];
  const financeLatestTransactions = (financeMetrics.latest_transactions ?? []).filter(
    (item) => item.status === "Menunggu Verifikasi"
  );
  const adminWidgets = useMemo(() => buildAdminWidgets(safeSnapshot.admin), [safeSnapshot.admin]);
  const financeWidgets = useMemo(() => buildFinanceWidgets(financeMetrics), [financeMetrics]);

  const snapshotGeneratedLabel = useMemo(() => {
    if (!safeSnapshot.generated_at) return "";
    return "Snapshot beranda terbaru";
  }, [safeSnapshot.generated_at]);

  useEffect(() => {
    if (!shouldLogTableData) return;
    console.log("[Table][Dashboard Overview Snapshot]:", safeSnapshot);
  }, [shouldLogTableData, safeSnapshot]);

  const headerActions = isAdmin ? (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" onClick={() => setShowServerStatus(true)}>
        <Server className="mr-2 h-4 w-4" />
        Status Server
      </Button>
      <Button type="button" variant="outline" loading={refreshing} loadingText="Refreshing widget..." onClick={refreshSnapshotData}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh widget
      </Button>
    </div>
  ) : isFinance ? (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" loading={refreshing} loadingText="Refreshing widget..." onClick={refreshSnapshotData}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh widget
      </Button>
    </div>
  ) : null;

  if (sessionLoading) {
    return <PageLoadingScreen />;
  }

  if (isFinance) {
    return (
      <div>
        <DashboardHeader
          title="Dashboard Finance"
          description="Monitoring iuran dan transaksi."
          actions={headerActions}
        />
        {safeSnapshot.generated_at ? (
          <p className="mb-3 text-xs text-muted-foreground">
            {snapshotGeneratedLabel} • <DateTimeText value={safeSnapshot.generated_at} />
          </p>
        ) : null}
        {loadError ? <p className="mb-3 text-sm text-destructive">{loadError}</p> : null}

        <MasterWidgetGrid widgets={financeWidgets} />

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>Menunggu verifikasi anda</CardTitle>
              <Badge variant="outline">{loading ? "Memuat..." : `${financeBillsNeedAction.length} data`}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                {loading ? (
                  <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">Memuat data IPL...</div>
                ) : financeBillsNeedAction.length ? (
                  financeBillsNeedAction.map((item) => (
                    <div key={item.id} className="relative rounded-lg border border-border bg-background p-3 pb-14">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{item.unit || "-"}</p>
                        <PaymentStatusBadge status={item.status} />
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                        <p>Periode: {item.periode}</p>
                        <p>Amount: {formatRupiahFromAny(item.amount)}</p>
                      </div>
                      <Button
                        size="sm"
                        className="absolute bottom-3 right-3 h-9 px-4"
                        aria-label={`Verifikasi pembayaran IPL ${item.id}`}
                        title="Verifikasi pembayaran"
                        onClick={() => openBillVerification(item.id)}
                      >
                        Verifikasi
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-border bg-background p-4 text-center text-sm text-muted-foreground">
                    No record available
                  </div>
                )}
              </div>

              <div className="hidden md:block">
                <Table className={loading ? "" : "min-w-[760px]"}>
                  {loading ? (
                    <ApiTableLoadingHead colSpan={6} />
                  ) : (
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead className="hidden md:table-cell">Periode</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Status Date</TableHead>
                        <TableHead className="w-[92px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                  )}
                  <TableBody>
                    {loading ? (
                      <ApiTableLoadingRow colSpan={6} message="Memuat data IPL..." />
                    ) : financeBillsNeedAction.length ? (
                      financeBillsNeedAction.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1">
                              <p>{item.unit || "-"}</p>
                              <p className="text-xs text-muted-foreground md:hidden">Periode: {item.periode}</p>
                              <p className="text-xs text-muted-foreground lg:hidden">
                                Status Date: <DateTimeText value={item.status_date} />
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{item.periode}</TableCell>
                          <TableCell>{formatRupiahFromAny(item.amount)}</TableCell>
                          <TableCell>
                            <PaymentStatusBadge status={item.status} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <DateTimeText value={item.status_date} />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              aria-label={`Verifikasi pembayaran IPL ${item.id}`}
                              title="Verifikasi pembayaran"
                              onClick={() => openBillVerification(item.id)}
                            >
                              <ScanSearch className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No record available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>5 Transaksi Terakhir</CardTitle>
              <Badge variant="outline">{loading ? "Memuat..." : `${financeLatestTransactions.length} data`}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                {loading ? (
                  <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                    Memuat data transaksi...
                  </div>
                ) : financeLatestTransactions.length ? (
                  financeLatestTransactions.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{item.transaction_name}</p>
                        <PaymentStatusBadge status={item.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={item.transaction_type === "Pemasukan" ? "success" : "warning"}>{item.transaction_type}</Badge>
                        <Badge variant="secondary">{item.category}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                        <p>ID: {item.id}</p>
                        <p>Amount: {formatRupiahFromAny(item.amount)}</p>
                        <p>Metode: {item.payment_method}</p>
                        <p>
                          Status Date: <DateTimeText value={item.status_date} />
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-border bg-background p-4 text-center text-sm text-muted-foreground">
                    No record available
                  </div>
                )}
              </div>

              <div className="hidden md:block">
                <Table className={loading ? "" : "min-w-[920px]"}>
                  {loading ? (
                    <ApiTableLoadingHead colSpan={6} />
                  ) : (
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden md:table-cell">ID</TableHead>
                        <TableHead>Detail Transaksi</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="hidden lg:table-cell">Payment Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Status Date</TableHead>
                      </TableRow>
                    </TableHeader>
                  )}
                  <TableBody>
                    {loading ? (
                      <ApiTableLoadingRow colSpan={6} message="Memuat data transaksi..." />
                    ) : financeLatestTransactions.length ? (
                      financeLatestTransactions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="hidden md:table-cell">{item.id}</TableCell>
                          <TableCell className="align-top whitespace-normal">
                            <div className="space-y-1">
                              <p className="text-sm">{item.transaction_name}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={item.transaction_type === "Pemasukan" ? "success" : "warning"}>{item.transaction_type}</Badge>
                                <Badge variant="secondary">{item.category}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground md:hidden">ID: {item.id}</p>
                              <p className="text-xs text-muted-foreground lg:hidden">Metode: {item.payment_method}</p>
                              <p className="text-xs text-muted-foreground lg:hidden">
                                Status Date: <DateTimeText value={item.status_date} />
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{formatRupiahFromAny(item.amount)}</TableCell>
                          <TableCell className="hidden lg:table-cell">{item.payment_method}</TableCell>
                          <TableCell>
                            <PaymentStatusBadge status={item.status} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <DateTimeText value={item.status_date} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No record available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
        <SuccessToast message={successToast} onClose={() => setSuccessToast("")} />
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader
        title="Dashboard Admin"
        description="Monitoring iuran warga dan transaksi lingkungan"
        actions={headerActions}
      />
      {safeSnapshot.generated_at ? (
        <p className="mb-3 text-xs text-muted-foreground">
          {snapshotGeneratedLabel} • <DateTimeText value={safeSnapshot.generated_at} />
        </p>
      ) : null}
      {loadError ? <p className="mb-3 text-sm text-destructive">{loadError}</p> : null}

      <MasterWidgetGrid widgets={adminWidgets} />

      <ServerStatusModal open={showServerStatus} onClose={closeServerStatusModal} />
      <SuccessToast message={successToast} onClose={() => setSuccessToast("")} />
    </div>
  );
}
