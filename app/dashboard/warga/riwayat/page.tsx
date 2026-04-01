"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupiahFromAny } from "@/lib/currency";
import { formatDateTimeUnified } from "@/lib/date-time";
import { downloadRowsAsExcel } from "@/lib/download-excel";
import { TransactionRow } from "@/lib/mock-data";

const filterLabelClass = "mb-1 block text-xs font-medium text-muted-foreground";

export default function WargaRiwayatPage() {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<"all" | TransactionRow["payment_method"]>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search, methodFilter]);

  return (
    <WargaAccessGuard>
      {(data) => {
        const keyword = search.trim().toLowerCase();
        const filteredRows = data.houseTransactions.filter((item) => {
          const methodMatch = methodFilter === "all" ? true : item.payment_method === methodFilter;
          const textMatch = keyword
            ? [
                item.id,
                item.bill_id ?? "",
                item.transaction_type,
                item.category,
                item.amount,
                item.date,
                item.payment_method,
                item.status,
                item.status_date,
              ]
                .join(" ")
                .toLowerCase()
                .includes(keyword)
            : true;
          return methodMatch && textMatch;
        });
        const totalItems = filteredRows.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const currentPage = Math.min(page, totalPages);
        const start = (currentPage - 1) * pageSize;
        const pagedRows = filteredRows.slice(start, start + pageSize);
        const from = totalItems === 0 ? 0 : start + 1;
        const to = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);
        function downloadFilteredReport() {
          downloadRowsAsExcel({
            filenamePrefix: "warga-riwayat-transactions",
            rows: filteredRows,
            columns: [
              { header: "ID", value: (row) => row.id },
              { header: "IPL ID", value: (row) => row.bill_id ?? "-" },
              { header: "Transaction Type", value: (row) => row.transaction_type },
              { header: "Category", value: (row) => row.category },
              { header: "Amount", value: (row) => formatRupiahFromAny(row.amount) },
              { header: "Date", value: (row) => formatDateTimeUnified(row.date) },
              { header: "Payment Method", value: (row) => row.payment_method },
              { header: "Status", value: (row) => row.status },
              { header: "Status Date", value: (row) => formatDateTimeUnified(row.status_date) },
            ],
          });
        }

        return (
          <div>
            <DashboardHeader
              title="Riwayat Pembayaran"
              description="Daftar transaksi pembayaran IPL berdasarkan house yang terhubung."
            />
            <Card>
              <CardHeader>
                <CardTitle>Data Transaksi Saya</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px_44px]">
                  <div>
                    <label className={filterLabelClass}>Pencarian</label>
                    <input
                      className="h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Cari ID, IPL ID, tipe, kategori, amount..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className={filterLabelClass}>Metode Pembayaran</label>
                    <select
                      className="h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={methodFilter}
                      onChange={(event) => setMethodFilter(event.target.value as "all" | TransactionRow["payment_method"])}
                    >
                      <option value="all">Semua metode</option>
                      <option value="Transfer Bank">Transfer Bank</option>
                      <option value="Cash">Cash</option>
                      <option value="QRIS">QRIS</option>
                      <option value="E-wallet">E-wallet</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-10 p-0"
                      aria-label="Download report riwayat"
                      title="Download report riwayat"
                      onClick={downloadFilteredReport}
                      disabled={!filteredRows.length}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Table className="min-w-[1160px]">
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
                    {filteredRows.length ? (
                      pagedRows.map((item) => (
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
                <TablePagination
                  page={currentPage}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  totalPages={totalPages}
                  from={from}
                  to={to}
                  onPageChange={setPage}
                  onPageSizeChange={(nextSize) => {
                    setPageSize(nextSize);
                    setPage(1);
                  }}
                />
              </CardContent>
            </Card>
          </div>
        );
      }}
    </WargaAccessGuard>
  );
}
