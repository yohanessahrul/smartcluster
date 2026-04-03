"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, SlidersHorizontal } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SimpleModal } from "@/components/ui/simple-modal";
import { TablePagination } from "@/components/ui/table-pagination";
import { formatRupiahFromAny } from "@/lib/currency";
import { formatDateTimeUnified } from "@/lib/date-time";
import { downloadRowsAsExcel } from "@/lib/download-excel";
import { TransactionRow } from "@/lib/mock-data";

const filterLabelClass = "mb-1 block text-xs font-medium text-muted-foreground";

export default function WargaRiwayatPage() {
  const shouldLogTableData = process.env.NODE_ENV !== "production";
  const [methodFilter, setMethodFilter] = useState<"all" | TransactionRow["payment_method"]>("all");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [methodFilter]);

  function resetFilters() {
    setMethodFilter("all");
  }

  return (
    <WargaAccessGuard>
      {(data) => {
        const filteredRows = data.houseTransactions.filter((item) => {
          return methodFilter === "all" ? true : item.payment_method === methodFilter;
        });
        const totalItems = filteredRows.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const currentPage = Math.min(page, totalPages);
        const start = (currentPage - 1) * pageSize;
        const pagedRows = filteredRows.slice(start, start + pageSize);
        const from = totalItems === 0 ? 0 : start + 1;
        const to = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

        if (shouldLogTableData) {
          console.log("[Table][Warga Riwayat] rows:", data.houseTransactions);
          console.log("[Table][Warga Riwayat] filteredRows:", filteredRows);
          console.log("[Table][Warga Riwayat] pagedRows:", pagedRows);
        }

        function downloadFilteredReport() {
          downloadRowsAsExcel({
            filenamePrefix: "warga-riwayat-transactions",
            rows: filteredRows,
            columns: [
              { header: "ID", value: (row) => row.id },
              { header: "IPL ID", value: (row) => row.bill_id ?? "-" },
              { header: "Tipe Transaksi", value: (row) => row.transaction_type },
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
              description="Daftar transaksi pembayaran IPL berdasarkan rumah yang terhubung."
            />
            <Card>
              <CardHeader>
                <CardTitle>Data Transaksi Saya</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap items-end gap-2">
                  <div className="flex w-full items-end gap-2 sm:w-auto">
                    <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" onClick={() => setFilterModalOpen(true)}>
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                  </div>
                  <div className="ml-auto hidden items-end sm:flex">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 gap-2 px-3"
                      aria-label="Download Excel"
                      title="Download Excel"
                      onClick={downloadFilteredReport}
                      disabled={!filteredRows.length}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span className="text-sm">Download Excel</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredRows.length ? (
                    pagedRows.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border bg-background p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Transaksi ID</p>
                            <p className="font-medium">{item.id}</p>
                          </div>
                          <PaymentStatusBadge status={item.status} />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant={item.transaction_type === "Pemasukan" ? "success" : "warning"}>
                            {item.transaction_type}
                          </Badge>
                          <Badge variant="secondary">{item.category}</Badge>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <p>
                            <span className="text-muted-foreground">IPL ID:</span> {item.bill_id ?? "-"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Amount:</span> {formatRupiahFromAny(item.amount)}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Date:</span> <DateTimeText value={item.date} />
                          </p>
                          <p>
                            <span className="text-muted-foreground">Payment Method:</span> {item.payment_method}
                          </p>
                          <p className="sm:col-span-2">
                            <span className="text-muted-foreground">Status Date:</span> <DateTimeText value={item.status_date} />
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground">
                      No record available
                    </div>
                  )}
                </div>
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

            <SimpleModal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter Riwayat" className="max-w-md">
              <div className="space-y-3">
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
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset
                  </Button>
                  <Button type="button" onClick={() => setFilterModalOpen(false)}>
                    Terapkan
                  </Button>
                </div>
              </div>
            </SimpleModal>
          </div>
        );
      }}
    </WargaAccessGuard>
  );
}
