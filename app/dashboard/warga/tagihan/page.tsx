"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
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
  const [payError, setPayError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [localBills, setLocalBills] = useState<BillRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BillRow["status"]>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [payProofFile, setPayProofFile] = useState<File | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

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

  function openPayModal(bill: BillRow) {
    setSelectedBill(bill);
    setPayModalOpen(true);
    setPayProofFile(null);
    setPayError("");
  }

  async function submitBillPayment(actorEmail?: string) {
    if (!selectedBill) return;
    if (!payProofFile) {
      setPayError("Bukti transaksi wajib diupload.");
      return;
    }
    try {
      setPaySubmitting(true);
      setPayError("");
      const uploaded = await apiClient.uploadBillPaymentProof(selectedBill.id, payProofFile, { actorEmail });
      await apiClient.payBill(
        {
          billId: selectedBill.id,
          payment_method: selectedBill.payment_method ?? "Transfer Bank",
          payment_proof_url: uploaded.public_url,
        },
        { actorEmail }
      );
      const rows = await apiClient.getBills();
      setLocalBills(rows);
      emitDataChanged();
      setPayModalOpen(false);
      setPayProofFile(null);
      setPayError("");
      setSuccessToast(`Pembayaran untuk ${selectedBill.id} berhasil dikirim. Status menjadi Pending.`);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Gagal memproses pembayaran.");
    } finally {
      setPaySubmitting(false);
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
                      <option value="Belum bayar">Belum bayar</option>
                      <option value="Pending">Pending</option>
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
                            ) : item.status === "Belum bayar" ? (
                              <Badge variant="warning">Belum bayar</Badge>
                            ) : item.status === "Pending" ? (
                              <Badge variant="warning">Pending</Badge>
                            ) : (
                              <Badge variant="secondary">Verifikasi</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatDateTimeUnified(item.status_date)}</TableCell>
                          <TableCell className="min-w-[84px]">
                            {item.status === "Belum bayar" ? (
                              <Button
                                size="sm"
                                className="h-8 px-3"
                                aria-label="Bayar"
                                title="Bayar"
                                onClick={() => openPayModal(item)}
                              >
                                Bayar
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

            <SuccessToast message={successToast} onClose={() => setSuccessToast("")} />

            <SimpleModal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Bayar Tagihan IPL">
              <div className="space-y-4">
                <FormErrorAlert message={payError} />
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">IPL:</span> {selectedBill?.id}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Unit:</span> {houseDisplay}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Periode:</span> {selectedBill?.periode}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Nominal:</span> {selectedBill?.amount}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Payment Method:</span> {selectedBill?.payment_method ?? "Transfer Bank"}
                  </p>
                </div>

                <div>
                  <label className={filterLabelClass}>Upload Bukti Transaksi</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    onChange={(event) => setPayProofFile(event.target.files?.[0] ?? null)}
                  />
                  {payProofFile ? <p className="mt-1 text-xs text-muted-foreground">File dipilih: {payProofFile.name}</p> : null}
                </div>

                <Button className="w-full" onClick={() => submitBillPayment(data.session?.email)} disabled={paySubmitting}>
                  {paySubmitting ? "Menyimpan..." : "Kirim Pembayaran"}
                </Button>
              </div>
            </SimpleModal>
          </div>
        );
      }}
    </WargaAccessGuard>
  );
}
