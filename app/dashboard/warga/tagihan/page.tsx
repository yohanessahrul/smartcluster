"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, QrCode } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SuccessToast } from "@/components/ui/success-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTimeUnified } from "@/lib/date-time";
import { downloadRowsAsExcel } from "@/lib/download-excel";
import { BillRow } from "@/lib/mock-data";
import { apiClient, emitDataChanged } from "@/lib/api-client";

const filterLabelClass = "mb-1 block text-xs font-medium text-muted-foreground";

export default function WargaTagihanPage() {
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillRow | null>(null);
  const [message, setMessage] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [localBills, setLocalBills] = useState<BillRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BillRow["status"]>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const sync = async () => {
      try {
        const rows = await apiClient.getBills();
        setLocalBills(rows);
      } catch {
        setLocalBills([]);
      }
    };
    sync();
    window.addEventListener("smart-perumahan-data-changed", sync);
    return () => window.removeEventListener("smart-perumahan-data-changed", sync);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  function openQrisModal(bill: BillRow) {
    setSelectedBill(bill);
    setPayModalOpen(true);
    setMessage("");
  }

  async function confirmQrisPayment(actorEmail?: string) {
    if (!selectedBill) return;
    try {
      await apiClient.payBillWithQris(selectedBill.id, { actorEmail });
      const rows = await apiClient.getBills();
      setLocalBills(rows);
      emitDataChanged();
      setPayModalOpen(false);
      setMessage("");
      setSuccessToast(`Pembayaran QRIS untuk ${selectedBill.id} berhasil dikirim. Status menjadi Verifikasi.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memproses pembayaran QRIS.");
    }
  }

  return (
    <WargaAccessGuard>
      {(data) => {
        const sourceRows = localBills.length ? localBills : data.houseBills;
        const rows = sourceRows.filter((bill) => bill.house_id === data.house?.id);
        const keyword = search.trim().toLowerCase();
        const houseDisplay = data.house ? `Blok ${data.house.blok} - No ${data.house.nomor}` : "-";
        const filteredRows = rows.filter((item) => {
          const statusMatch = statusFilter === "all" ? true : item.status === statusFilter;
          const textMatch = keyword
            ? [houseDisplay, item.periode, item.amount, item.status, item.status_date]
                .join(" ")
                .toLowerCase()
                .includes(keyword)
            : true;
          return statusMatch && textMatch;
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
            filenamePrefix: "warga-tagihan-ipl",
            rows: filteredRows,
            columns: [
              { header: "ID", value: (row) => row.id },
              { header: "Unit", value: () => houseDisplay },
              { header: "Periode", value: (row) => row.periode },
              { header: "Amount", value: (row) => row.amount },
              { header: "Status", value: (row) => row.status },
              { header: "Status Date", value: (row) => formatDateTimeUnified(row.status_date) },
            ],
          });
        }

        return (
          <div>
            <DashboardHeader
              title="Tagihan IPL Saya"
              description="Daftar tagihan per periode untuk house yang terhubung dengan email login."
            />
            <Card>
              <CardHeader>
                <CardTitle>Riwayat Tagihan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px_44px]">
                  <div>
                    <label className={filterLabelClass}>Pencarian</label>
                    <input
                      className="h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Cari unit, periode, amount..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className={filterLabelClass}>Status</label>
                    <select
                      className="h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as "all" | BillRow["status"])}
                    >
                      <option value="all">Semua status</option>
                      <option value="Belum Dibayar">Belum Dibayar</option>
                      <option value="Verifikasi">Verifikasi</option>
                      <option value="Lunas">Lunas</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-10 p-0"
                      aria-label="Download report tagihan"
                      title="Download report tagihan"
                      onClick={downloadFilteredReport}
                      disabled={!filteredRows.length}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Status Date</TableHead>
                      <TableHead className="min-w-[84px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length ? (
                      pagedRows.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{houseDisplay}</TableCell>
                          <TableCell>{item.periode}</TableCell>
                          <TableCell>{item.amount}</TableCell>
                          <TableCell>
                            {item.status === "Lunas" ? (
                              <Badge variant="success">Lunas</Badge>
                            ) : item.status === "Belum Dibayar" ? (
                              <Badge variant="warning">Belum Dibayar</Badge>
                            ) : (
                              <Badge variant="secondary">Verifikasi</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDateTimeUnified(item.status_date)}</TableCell>
                          <TableCell className="min-w-[84px]">
                            {item.status === "Belum Dibayar" ? (
                              <Button
                                size="sm"
                                className="h-8 w-8 p-0"
                                aria-label="Bayar QRIS"
                                title="Bayar QRIS"
                                onClick={() => openQrisModal(item)}
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
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

            {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
            <SuccessToast message={successToast} onClose={() => setSuccessToast("")} />

            <SimpleModal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Pembayaran QRIS (Dummy)">
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">IPL:</span> {selectedBill?.id}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Periode:</span> {selectedBill?.periode}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Nominal:</span> {selectedBill?.amount}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <img src="/dummy-qris.svg" alt="Dummy QRIS Smart Perumahan" className="mx-auto w-full max-w-[280px]" />
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    QRIS dummy untuk prototipe. Ref pembayaran: SP-{selectedBill?.id}
                  </p>
                </div>

                <Button className="w-full" onClick={() => confirmQrisPayment(data.session?.email)}>
                  Saya Sudah Bayar
                </Button>
              </div>
            </SimpleModal>
          </div>
        );
      }}
    </WargaAccessGuard>
  );
}
