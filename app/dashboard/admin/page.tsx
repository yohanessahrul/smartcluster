"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Home, NotebookText, Users, Wallet } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { ServerStatusModal } from "@/components/admin/server-status-modal";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { ApiTableLoadingRow } from "@/components/ui/api-loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthSession } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import { formatRupiah, formatRupiahFromAny, parseRupiahToNumber } from "@/lib/currency";
import { BillRow, HouseRow, TransactionRow, UserRow } from "@/lib/mock-data";

export default function AdminDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuthSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [houses, setHouses] = useState<HouseRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showServerStatus, setShowServerStatus] = useState(false);
  const [openedFromQuery, setOpenedFromQuery] = useState(false);

  useEffect(() => {
    void loadDashboardData();
    window.addEventListener("smart-perumahan-data-changed", loadDashboardData);
    return () => window.removeEventListener("smart-perumahan-data-changed", loadDashboardData);
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setLoadError("");
      const [usersData, housesData, billsData, transactionsData] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getHouses(),
        apiClient.getBills(),
        apiClient.getTransactions(),
      ]);
      setUsers(usersData);
      setHouses(housesData);
      setBills(billsData);
      setTransactions(transactionsData);
    } catch (error) {
      setUsers([]);
      setHouses([]);
      setBills([]);
      setTransactions([]);
      setLoadError(error instanceof Error ? error.message : "Gagal memuat dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const isFinance = session?.role === "finance";
  const isAdmin = session?.role === "admin" || session?.role === "superadmin";

  const houseById = useMemo(() => new Map(houses.map((house) => [house.id, house])), [houses]);

  const adminMetrics = useMemo(() => {
    const paid = bills.filter((item) => item.status === "Lunas").length;
    const unpaid = bills.filter((item) => item.status !== "Lunas").length;
    return { paid, unpaid };
  }, [bills]);

  const financeMetrics = useMemo(() => {
    const successPayments = bills.filter((item) => item.status === "Lunas");
    const needVerification = bills.filter((item) => item.status === "Menunggu Verifikasi");
    const needFollowUp = bills.filter((item) => item.status === "Belum bayar");

    return {
      successCount: successPayments.length,
      successTotal: successPayments.reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0),
      needVerificationCount: needVerification.length,
      needVerificationTotal: needVerification.reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0),
      needFollowUpCount: needFollowUp.length,
      needFollowUpTotal: needFollowUp.reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0),
      totalUnitCount: houses.length,
      occupiedUnitCount: houses.filter((item) => item.isOccupied).length,
    };
  }, [bills, houses]);

  const financeBillsNeedAction = useMemo(() => {
    return bills
      .filter((item) => item.status === "Menunggu Verifikasi")
      .sort((a, b) => new Date(b.status_date).getTime() - new Date(a.status_date).getTime())
      .slice(0, 10);
  }, [bills]);

  const financeLatestTransactions = useMemo(() => {
    return transactions
      .slice()
      .sort((a, b) => {
        const timeA = new Date(a.status_date || a.date).getTime();
        const timeB = new Date(b.status_date || b.date).getTime();
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [transactions]);

  useEffect(() => {
    console.log("[Table][Dashboard Admin] users:", users);
    console.log("[Table][Dashboard Admin] houses:", houses);
    console.log("[Table][Dashboard Admin] ipl:", bills);
    console.log("[Table][Dashboard Admin] transactions:", transactions);
  }, [users, houses, bills, transactions]);

  useEffect(() => {
    if (!isFinance) return;
    console.log("[Table][Dashboard Finance] iplNeedAction:", financeBillsNeedAction);
    console.log("[Table][Dashboard Finance] latestTransactions:", financeLatestTransactions);
  }, [isFinance, financeBillsNeedAction, financeLatestTransactions]);

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

  function closeServerStatusModal() {
    setShowServerStatus(false);
    if (openedFromQuery) {
      setOpenedFromQuery(false);
      router.replace("/dashboard/admin");
    }
  }

  function unitLabel(houseId: string) {
    const house = houseById.get(houseId);
    if (!house) return "-";
    return `Blok ${house.blok} - No ${house.nomor}`;
  }

  if (isFinance) {
    return (
      <div>
        <DashboardHeader
          title="Dashboard Finance"
          description="Ringkasan data verifikasi IPL, arus pemasukan, dan daftar unit yang perlu ditindak."
        />
        {loadError ? <p className="mb-3 text-sm text-destructive">{loadError}</p> : null}

        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Success Payment</p>
                <p className="font-heading text-xl">{financeMetrics.successCount}</p>
                <p className="text-xs text-muted-foreground">{formatRupiah(financeMetrics.successTotal)}</p>
              </div>
              <NotebookText className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Need Verification</p>
                <p className="font-heading text-xl">{financeMetrics.needVerificationCount}</p>
                <p className="text-xs text-muted-foreground">{formatRupiah(financeMetrics.needVerificationTotal)}</p>
              </div>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Need Follow Up</p>
                <p className="font-heading text-xl">{financeMetrics.needFollowUpCount}</p>
                <p className="text-xs text-muted-foreground">{formatRupiah(financeMetrics.needFollowUpTotal)}</p>
              </div>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Unit Summary</p>
                <p className="font-heading text-xl">{`${financeMetrics.totalUnitCount} House`}</p>
                <p className="text-xs text-muted-foreground">{`${financeMetrics.occupiedUnitCount} Dihuni`}</p>
              </div>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </section>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>IPL Perlu Tindakan</CardTitle>
              <Badge variant="outline">{loading ? "Memuat..." : `${financeBillsNeedAction.length} data`}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                {loading ? (
                  <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">Memuat data IPL...</div>
                ) : financeBillsNeedAction.length ? (
                  financeBillsNeedAction.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium">{unitLabel(item.house_id)}</p>
                        <PaymentStatusBadge status={item.status} />
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                        <p>Periode: {item.periode}</p>
                        <p>Amount: {formatRupiahFromAny(item.amount)}</p>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead className="hidden md:table-cell">Periode</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Status Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <ApiTableLoadingRow colSpan={5} message="Memuat data IPL..." />
                    ) : financeBillsNeedAction.length ? (
                      financeBillsNeedAction.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1">
                              <p>{unitLabel(item.house_id)}</p>
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
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden md:table-cell">ID</TableHead>
                      <TableHead>Transaction Detail</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="hidden lg:table-cell">Payment Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Status Date</TableHead>
                    </TableRow>
                  </TableHeader>
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
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader title="Dashboard Admin" description="Ringkasan operasional IPL: rumah, warga, dan status tagihan." />
      {loadError ? <p className="mb-3 text-sm text-destructive">{loadError}</p> : null}

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Rumah</p>
              <p className="font-heading text-xl">{houses.length}</p>
            </div>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Warga</p>
              <p className="font-heading text-xl">{users.filter((item) => item.role === "warga").length}</p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Tagihan Lunas</p>
              <p className="font-heading text-xl">{adminMetrics.paid}</p>
            </div>
            <NotebookText className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))]">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">Belum Bayar</p>
              <p className="font-heading text-xl">{adminMetrics.unpaid}</p>
            </div>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </section>

      <ServerStatusModal open={showServerStatus} onClose={closeServerStatusModal} />
    </div>
  );
}
