"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Home, NotebookText, Users, Wallet } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination, useTablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthSession } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import { formatRupiah, formatRupiahFromAny, parseRupiahToNumber } from "@/lib/currency";
import { formatDateTimeUnified } from "@/lib/date-time";
import { BillRow, HouseRow, TransactionRow, UserRow } from "@/lib/mock-data";

export default function AdminDashboardPage() {
  const { session } = useAuthSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [houses, setHouses] = useState<HouseRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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

  const houseById = useMemo(() => new Map(houses.map((house) => [house.id, house])), [houses]);

  const adminMetrics = useMemo(() => {
    const paid = bills.filter((item) => item.status === "Lunas").length;
    const unpaid = bills.filter((item) => item.status !== "Lunas").length;
    return { paid, unpaid };
  }, [bills]);

  const financeMetrics = useMemo(() => {
    const successPayments = bills.filter((item) => item.status === "Lunas");
    const pendingPayments = bills.filter((item) => item.status !== "Lunas");

    return {
      successCount: successPayments.length,
      successTotal: successPayments.reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0),
      pendingCount: pendingPayments.length,
      pendingTotal: pendingPayments.reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0),
      activeUnitCount: houses.filter((item) => item.isOccupied).length,
    };
  }, [bills, houses]);

  const financeBillsNeedAction = useMemo(() => {
    return bills
      .filter((item) => item.status !== "Lunas")
      .sort((a, b) => new Date(b.status_date).getTime() - new Date(a.status_date).getTime())
      .slice(0, 10);
  }, [bills]);

  const financeLatestIncome = useMemo(() => {
    return transactions
      .filter((item) => item.transaction_type === "Pemasukan" && item.category === "IPL Warga")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [transactions]);
  const financeNeedActionPagination = useTablePagination(financeBillsNeedAction);
  const financeIncomePagination = useTablePagination(financeLatestIncome);
  const adminTransactionPagination = useTablePagination(transactions);

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

        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          <Card className="border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))]">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Pending Payment</p>
                <p className="font-heading text-xl">{financeMetrics.pendingCount}</p>
                <p className="text-xs text-muted-foreground">{formatRupiah(financeMetrics.pendingTotal)}</p>
              </div>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Unit Active</p>
                <p className="font-heading text-xl">{`${financeMetrics.activeUnitCount} House`}</p>
              </div>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>IPL Perlu Tindakan</CardTitle>
              <Badge variant="outline">{loading ? "Loading..." : `${financeBillsNeedAction.length} data`}</Badge>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Status Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financeBillsNeedAction.length ? (
                    financeNeedActionPagination.pagedRows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{unitLabel(item.house_id)}</TableCell>
                        <TableCell>{item.periode}</TableCell>
                        <TableCell>{formatRupiahFromAny(item.amount)}</TableCell>
                        <TableCell>{item.status}</TableCell>
                        <TableCell>{formatDateTimeUnified(item.status_date)}</TableCell>
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
              {!loading ? (
                <TablePagination
                  page={financeNeedActionPagination.page}
                  pageSize={financeNeedActionPagination.pageSize}
                  totalItems={financeNeedActionPagination.totalItems}
                  totalPages={financeNeedActionPagination.totalPages}
                  from={financeNeedActionPagination.from}
                  to={financeNeedActionPagination.to}
                  onPageChange={financeNeedActionPagination.setPage}
                  onPageSizeChange={financeNeedActionPagination.setPageSize}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>Pemasukan IPL Terbaru</CardTitle>
              <Badge variant="outline">{loading ? "Loading..." : "Realtime API"}</Badge>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>IPL ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financeLatestIncome.length ? (
                    financeIncomePagination.pagedRows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>{item.bill_id ?? "-"}</TableCell>
                        <TableCell>{formatRupiahFromAny(item.amount)}</TableCell>
                        <TableCell>{item.payment_method}</TableCell>
                        <TableCell>{item.status}</TableCell>
                        <TableCell>{formatDateTimeUnified(item.date)}</TableCell>
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
              {!loading ? (
                <TablePagination
                  page={financeIncomePagination.page}
                  pageSize={financeIncomePagination.pageSize}
                  totalItems={financeIncomePagination.totalItems}
                  totalPages={financeIncomePagination.totalPages}
                  from={financeIncomePagination.from}
                  to={financeIncomePagination.to}
                  onPageChange={financeIncomePagination.setPage}
                  onPageSizeChange={financeIncomePagination.setPageSize}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader
        title="Dashboard Admin"
        description="Ringkasan operasional IPL: rumah, warga, tagihan, dan transaksi terbaru."
      />
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

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle>Transaksi Terbaru</CardTitle>
          <Badge variant="outline">{loading ? "Loading..." : "Realtime API"}</Badge>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>IPL ID</TableHead>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Status Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length ? (
                adminTransactionPagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.bill_id ?? "-"}</TableCell>
                    <TableCell>{item.transaction_type}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{formatRupiahFromAny(item.amount)}</TableCell>
                    <TableCell>{formatDateTimeUnified(item.date)}</TableCell>
                    <TableCell>{item.payment_method}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{formatDateTimeUnified(item.status_date)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No record available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!loading ? (
            <TablePagination
              page={adminTransactionPagination.page}
              pageSize={adminTransactionPagination.pageSize}
              totalItems={adminTransactionPagination.totalItems}
              totalPages={adminTransactionPagination.totalPages}
              from={adminTransactionPagination.from}
              to={adminTransactionPagination.to}
              onPageChange={adminTransactionPagination.setPage}
              onPageSizeChange={adminTransactionPagination.setPageSize}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
