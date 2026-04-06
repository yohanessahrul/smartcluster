"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileCheck2, FileSpreadsheet, ReceiptText, SlidersHorizontal, Upload } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SuccessToast } from "@/components/ui/success-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { formatDateTimeUnified } from "@/lib/date-time";
import { downloadRowsAsExcel } from "@/lib/download-excel";
import { BillRow, UserRow } from "@/lib/mock-data";
import { apiClient, AuditLogRow, emitDataChanged } from "@/lib/api-client";

const filterLabelClass = "mb-1 block text-xs font-medium text-muted-foreground";

type UserDirectory = Record<
  string,
  {
    name: string;
    role: UserRow["role"];
  }
>;

type BillTimelineStep = {
  key: "billed" | "uploaded" | "verified";
  textPrefix: string;
  actor: string;
  at: string | null;
};

function readStringField(value: Record<string, unknown> | null | undefined, key: string) {
  const field = value?.[key];
  return typeof field === "string" ? field : null;
}

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function formatRoleLabel(role: UserRow["role"]) {
  switch (role) {
    case "superadmin":
      return "Superadmin";
    case "admin":
      return "Admin";
    case "warga":
      return "Warga";
    case "finance":
    default:
      return "Finance";
  }
}

function resolveActorRoleLabel(author: string | null | undefined, userDirectory: UserDirectory, fallback: UserRow["role"] = "finance") {
  const normalizedAuthor = normalizeEmail(author);
  if (!normalizedAuthor) return formatRoleLabel(fallback);
  const found = userDirectory[normalizedAuthor];
  if (found?.role) return formatRoleLabel(found.role);
  return formatRoleLabel(fallback);
}

function buildLunasTimeline(
  logs: AuditLogRow[],
  userDirectory: UserDirectory,
  viewerEmail: string | null,
) {
  const orderedLogs = [...logs].sort((a, b) => {
    const timeA = new Date(a.updated_at).getTime();
    const timeB = new Date(b.updated_at).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id - b.id;
  });

  const createLog = orderedLogs.find((row) => row.action === "CREATE");
  const statusUpdates = orderedLogs.filter((row) => row.action === "UPDATE");
  const uploadLog = statusUpdates.find((row) => normalizeStatus(readStringField(row.after_value, "status")) === "menunggu verifikasi");
  const verifiedLog =
    [...statusUpdates]
      .reverse()
      .find((row) => normalizeStatus(readStringField(row.after_value, "status")) === "lunas") ?? null;

  const billedActor = resolveActorRoleLabel(createLog?.author, userDirectory, "finance");
  const verifiedActor = resolveActorRoleLabel(verifiedLog?.author, userDirectory, "finance");
  const viewer = normalizeEmail(viewerEmail);
  const uploadAuthor = normalizeEmail(uploadLog?.author);
  const uploadActor = uploadAuthor && viewer && uploadAuthor === viewer ? "kamu" : "kamu";

  const steps: BillTimelineStep[] = [];

  if (createLog) {
    steps.push({
      key: "billed",
      textPrefix: "Ditagihkan oleh",
      actor: billedActor,
      at: createLog.updated_at,
    });
  }

  if (uploadLog) {
    steps.push({
      key: "uploaded",
      textPrefix: "Upload bukti pembayaran oleh",
      actor: uploadActor,
      at: uploadLog.updated_at,
    });
  }

  if (verifiedLog) {
    steps.push({
      key: "verified",
      textPrefix: "Diverifikasi oleh",
      actor: verifiedActor,
      at: verifiedLog.updated_at,
    });
  }

  return steps;
}

export default function WargaTagihanPage() {
  const shouldLogTableData = process.env.NODE_ENV !== "production";
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillRow | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBill, setPreviewBill] = useState<BillRow | null>(null);
  const [payError, setPayError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [localBills, setLocalBills] = useState<BillRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | BillRow["status"]>("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState<"all" | BillRow["status"]>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [payProofFile, setPayProofFile] = useState<File | null>(null);
  const [payProofPreviewUrl, setPayProofPreviewUrl] = useState<string>("");
  const payProofFileInputRef = useRef<HTMLInputElement | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [userDirectory, setUserDirectory] = useState<UserDirectory>({});
  const [previewViewerEmail, setPreviewViewerEmail] = useState<string | null>(null);
  const [previewTimelineSteps, setPreviewTimelineSteps] = useState<BillTimelineStep[]>([]);
  const [previewTimelineLoading, setPreviewTimelineLoading] = useState(false);

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
    let isActive = true;
    const loadUserDirectory = async () => {
      try {
        const users = await apiClient.getUsers();
        if (!isActive) return;
        const nextDirectory = users.reduce<UserDirectory>((acc, user) => {
          acc[user.email.toLowerCase()] = { name: user.name, role: user.role };
          return acc;
        }, {});
        setUserDirectory(nextDirectory);
      } catch {
        if (!isActive) return;
        setUserDirectory({});
      }
    };
    void loadUserDirectory();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!previewModalOpen || !previewBill || previewBill.status !== "Lunas") {
      setPreviewTimelineSteps([]);
      setPreviewTimelineLoading(false);
      return;
    }

    let isActive = true;
    const loadTimeline = async () => {
      try {
        setPreviewTimelineLoading(true);
        const logs = await apiClient.getAuditLogs("bills", 200, previewBill.id);
        if (!isActive) return;
        const steps = buildLunasTimeline(logs, userDirectory, previewViewerEmail);
        setPreviewTimelineSteps(steps);
      } catch {
        if (!isActive) return;
        setPreviewTimelineSteps([]);
      } finally {
        if (isActive) setPreviewTimelineLoading(false);
      }
    };

    void loadTimeline();
    return () => {
      isActive = false;
    };
  }, [previewModalOpen, previewBill, previewViewerEmail, userDirectory]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (!payProofFile || !payProofFile.type.startsWith("image/")) {
      setPayProofPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(payProofFile);
    setPayProofPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [payProofFile]);

  function resetFilters() {
    setDraftStatusFilter("all");
  }

  function openFilterModal() {
    setDraftStatusFilter(statusFilter);
    setFilterModalOpen(true);
  }

  function applyFilters() {
    setStatusFilter(draftStatusFilter);
    setFilterModalOpen(false);
  }

  function openPayModal(bill: BillRow) {
    setSelectedBill(bill);
    setPayModalOpen(true);
    setPayProofFile(null);
    setPayError("");
  }

  function handleProofFileChange(fileList: FileList | null) {
    setPayProofFile(fileList?.[0] ?? null);
  }

  function openPreviewModal(bill: BillRow, viewerEmail?: string | null) {
    setPreviewBill(bill);
    setPreviewViewerEmail(normalizeEmail(viewerEmail));
    setPreviewTimelineSteps([]);
    setPreviewModalOpen(true);
  }

  function isImageProof(url: string) {
    const safeUrl = url.split("?")[0].toLowerCase();
    return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"].some((ext) => safeUrl.endsWith(ext));
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
      setSuccessToast(`Pembayaran untuk ${selectedBill.id} berhasil dikirim. Status menjadi Menunggu Verifikasi.`);
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
        const houseDisplay = data.house ? `Blok ${data.house.blok} - No ${data.house.nomor}` : "-";
        const filteredRows = rows.filter((item) => {
          return statusFilter === "all" ? true : item.status === statusFilter;
        });
        const totalItems = filteredRows.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const currentPage = Math.min(page, totalPages);
        const start = (currentPage - 1) * pageSize;
        const pagedRows = filteredRows.slice(start, start + pageSize);
        const from = totalItems === 0 ? 0 : start + 1;
        const to = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

        if (shouldLogTableData) {
          console.log("[Table][Warga Tagihan] rows:", rows);
          console.log("[Table][Warga Tagihan] filteredRows:", filteredRows);
          console.log("[Table][Warga Tagihan] pagedRows:", pagedRows);
        }

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
              description="Daftar tagihan per periode untuk rumah yang terhubung dengan email login."
            />
            <Card>
              <CardHeader>
                <CardTitle>Riwayat Tagihan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap items-end gap-2">
                  <div className="flex w-full items-end justify-end gap-2 sm:hidden">
                    <Button type="button" variant="outline" className="h-10 sm:flex-none" onClick={openFilterModal}>
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                  </div>
                  <div className="ml-auto hidden items-end gap-2 sm:flex">
                    <Button type="button" variant="outline" className="h-10 gap-2 px-3" onClick={openFilterModal}>
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="text-sm">Filter</span>
                    </Button>
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
                    pagedRows.map((item) => {
                      const isLunas = item.status === "Lunas";
                      const isMenungguVerifikasi = item.status === "Menunggu Verifikasi";
                      const isBelumBayar = item.status === "Belum bayar";

                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Lihat detail IPL ${item.id}`}
                          onClick={() => openPreviewModal(item, data.session?.email)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openPreviewModal(item, data.session?.email);
                            }
                          }}
                          className={`group rounded-lg border p-3 transition-colors duration-200 sm:p-4 ${
                            isLunas
                              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                              : isMenungguVerifikasi
                                ? "border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))] hover:bg-[hsl(var(--warning-bg))]/80"
                              : isBelumBayar
                                ? "border-destructive/35 bg-destructive/10 hover:bg-destructive/15"
                                : "border-border bg-background hover:bg-muted/40"
                          } cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`text-xs ${isLunas ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Periode</p>
                              <p className="font-medium">{item.periode}</p>
                            </div>
                            <PaymentStatusBadge status={item.status} />
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="font-heading text-2xl font-black sm:text-3xl">{item.amount}</p>
                            {item.status === "Belum bayar" ? (
                              <Button
                                size="sm"
                                className="h-9 px-4 text-sm"
                                aria-label="Bayar"
                                title="Bayar"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPayModal(item);
                                }}
                              >
                                Bayar
                                <ArrowRight className="ml-0 h-0 w-0 opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:h-4 group-hover:w-4 group-hover:opacity-100" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
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

            <SimpleModal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter Tagihan" className="max-w-md">
              <div className="space-y-3">
                <div>
                  <label className={filterLabelClass}>Status</label>
                  <select
                    className="h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={draftStatusFilter}
                    onChange={(event) => setDraftStatusFilter(event.target.value as "all" | BillRow["status"])}
                  >
                    <option value="all">Semua status</option>
                    <option value="Belum bayar">Belum bayar</option>
                    <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                    <option value="Verifikasi">Verifikasi</option>
                    <option value="Lunas">Lunas</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset
                  </Button>
                  <Button type="button" onClick={applyFilters}>
                    Terapkan
                  </Button>
                </div>
              </div>
            </SimpleModal>

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

                {payProofPreviewUrl ? (
                  <div>
                    {payProofFile ? <p className="mb-1 text-xs text-muted-foreground">File dipilih: {payProofFile.name}</p> : null}
                    <div className="relative isolate rounded-lg border border-border bg-muted/20">
                      <input
                        ref={payProofFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(event) => handleProofFileChange(event.target.files)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute right-[13px] top-[13px] z-30 bg-background/95 shadow-lg ring-1 ring-border/70"
                        onClick={() => {
                          if (!payProofFileInputRef.current) return;
                          payProofFileInputRef.current.value = "";
                          payProofFileInputRef.current.click();
                        }}
                        >
                          <Upload className="mr-1 h-3.5 w-3.5" />
                          Ganti Bukti Transaksi
                        </Button>
                      <div className="h-[280px] overflow-y-auto overflow-x-hidden rounded-lg">
                        <img src={payProofPreviewUrl} alt="Preview bukti transaksi" className="h-auto w-full" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className={filterLabelClass}>Upload Bukti Transaksi</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      onChange={(event) => handleProofFileChange(event.target.files)}
                    />
                    {payProofFile ? <p className="mt-1 text-xs text-muted-foreground">File dipilih: {payProofFile.name}</p> : null}
                  </div>
                )}

                <Button className="w-full" onClick={() => submitBillPayment(data.session?.email)} disabled={paySubmitting}>
                  {paySubmitting ? "Menyimpan..." : "Kirim Pembayaran"}
                </Button>
              </div>
            </SimpleModal>

            <SimpleModal open={previewModalOpen} onClose={() => setPreviewModalOpen(false)} title="Preview Detail IPL" className="w-[96vw] max-w-2xl">
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">IPL:</span> {previewBill?.id ?? "-"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Unit:</span> {houseDisplay}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Periode:</span> {previewBill?.periode ?? "-"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Nominal:</span> {previewBill?.amount ?? "-"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status:</span> {previewBill?.status ?? "-"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status Date:</span> <DateTimeText value={previewBill?.status_date} />
                  </p>
                </div>

                {previewBill?.status === "Belum bayar" ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (!previewBill) return;
                      setPreviewModalOpen(false);
                      openPayModal(previewBill);
                    }}
                  >
                    Bayar
                  </Button>
                ) : previewBill?.status === "Lunas" ? (
                  previewTimelineLoading ? (
                    <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                      Memuat riwayat status...
                    </div>
                  ) : previewTimelineSteps.length ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Riwayat Perubahan Status IPL</p>
                      <div className="rounded-lg border border-border bg-muted p-3 sm:p-4">
                        <ol className="space-y-3">
                          {previewTimelineSteps.map((step, index) => {
                            const isLast = index === previewTimelineSteps.length - 1;
                            const isVerifiedStep = step.key === "verified";
                            const StepIcon = step.key === "billed" ? ReceiptText : step.key === "uploaded" ? Upload : FileCheck2;
                            return (
                              <li key={step.key} className="relative pl-11">
                                {!isLast ? (
                                  <span className="absolute left-[15px] top-8 h-[calc(100%-2px)] w-px bg-border" aria-hidden />
                                ) : null}
                                <span
                                  className={`absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                                    isVerifiedStep ? "border-primary bg-primary" : "border-border bg-card"
                                  }`}
                                >
                                  <StepIcon className={`h-4 w-4 ${isVerifiedStep ? "text-primary-foreground" : "text-muted-foreground"}`} />
                                </span>
                                <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
                                  <p className="text-sm leading-relaxed">
                                    <span className="font-medium">{step.textPrefix}</span>{" "}
                                    <span className="font-semibold">{step.actor}</span>
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    <DateTimeText value={step.at} />
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    </div>
                  ) : null
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Bukti Transaksi</p>
                    {previewBill?.payment_proof_url ? (
                      isImageProof(previewBill.payment_proof_url) ? (
                        <div className="h-[360px] overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-muted/20">
                          <img
                            src={previewBill.payment_proof_url}
                            alt={`Bukti transaksi ${previewBill.id}`}
                            className="h-auto w-full"
                          />
                        </div>
                      ) : (
                        <a
                          href={previewBill.payment_proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary underline underline-offset-2"
                        >
                          Lihat Bukti Transaksi
                        </a>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">Bukti transaksi belum tersedia.</p>
                    )}
                  </div>
                )}
              </div>
            </SimpleModal>
          </div>
        );
      }}
    </WargaAccessGuard>
  );
}
