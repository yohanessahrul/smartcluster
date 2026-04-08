"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileCheck2, FileSpreadsheet, ReceiptText, SlidersHorizontal, Upload, WalletCards } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { WargaAccessGuard } from "@/components/warga-access-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SuccessToast } from "@/components/ui/success-toast";
import { TablePagination } from "@/components/ui/table-pagination";
import { formatRupiah, parseRupiahToNumber } from "@/lib/currency";
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

type BulkAllocationItem = {
  periode: string;
  amount: string;
  existingBillId: string | null;
};

type BulkAllocationPlan = {
  items: BulkAllocationItem[];
  totalNominal: number;
  uploadReferenceBillId: string | null;
  startPeriode: string | null;
};

function buildBulkAllocationPlan(rows: BillRow[], monthsCount: number): BulkAllocationPlan {
  if (!rows.length || !Number.isInteger(monthsCount) || monthsCount <= 0) {
    return { items: [], totalNominal: 0, uploadReferenceBillId: null, startPeriode: null };
  }

  const parsedRows = rows
    .map((row) => ({
      row,
      monthKey: parsePeriodeMonthKey(row.periode),
    }))
    .filter((item) => item.monthKey !== null);

  const latestPaidMonthKey = parsedRows
    .filter((item) => item.row.status === "Lunas")
    .reduce<number | null>((acc, item) => (acc === null || (item.monthKey as number) > acc ? (item.monthKey as number) : acc), null);

  const unpaidMonthKeysAsc = parsedRows
    .filter((item) => item.row.status !== "Lunas")
    .map((item) => item.monthKey as number)
    .sort((a, b) => a - b);

  const now = new Date();
  const currentMonthKey = toPeriodeMonthKey(now.getFullYear(), now.getMonth());
  const startMonthKey =
    latestPaidMonthKey !== null ? latestPaidMonthKey + 1 : unpaidMonthKeysAsc.length ? unpaidMonthKeysAsc[0] : currentMonthKey;

  const referenceAmount =
    rows.find((item) => parseRupiahToNumber(item.amount) > 0)?.amount ?? formatRupiah(0);

  const latestBillByPeriode = new Map<string, BillRow>();
  for (const row of rows) {
    const key = normalizePeriodeText(row.periode);
    if (!key) continue;
    const existing = latestBillByPeriode.get(key);
    if (!existing) {
      latestBillByPeriode.set(key, row);
      continue;
    }
    const existingTime = new Date(existing.status_date).getTime();
    const nextTime = new Date(row.status_date).getTime();
    if (Number.isFinite(nextTime) && (!Number.isFinite(existingTime) || nextTime >= existingTime)) {
      latestBillByPeriode.set(key, row);
    }
  }

  const items: BulkAllocationItem[] = Array.from({ length: monthsCount }, (_, index) => {
    const periode = formatPeriodeFromMonthKey(startMonthKey + index);
    const existing = latestBillByPeriode.get(normalizePeriodeText(periode)) ?? null;
    return {
      periode,
      amount: existing?.amount ?? referenceAmount,
      existingBillId: existing?.id ?? null,
    };
  }).filter((item) => item.periode);

  const uploadReferenceBillId = items.find((item) => item.existingBillId)?.existingBillId ?? rows[0]?.id ?? null;
  const totalNominal = items.reduce((sum, item) => sum + parseRupiahToNumber(item.amount), 0);

  return {
    items,
    totalNominal,
    uploadReferenceBillId,
    startPeriode: items[0]?.periode ?? null,
  };
}

function readStringField(value: Record<string, unknown> | null | undefined, key: string) {
  const field = value?.[key];
  return typeof field === "string" ? field : null;
}

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function isLunasStatus(value: string | null | undefined) {
  return normalizeStatus(value) === "lunas";
}

function isBelumBayarStatus(value: string | null | undefined) {
  const normalized = normalizeStatus(value);
  return normalized === "belum bayar" || normalized === "belum dibayar";
}

const periodeMonthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function toPeriodeMonthKey(year: number, monthIndex: number) {
  return year * 12 + monthIndex;
}

function parsePeriodeMonthKey(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const [monthLabelRaw, yearRaw] = raw.replace(/\s+/g, " ").split(" ");
  const year = Number.parseInt(yearRaw ?? "", 10);
  if (!Number.isInteger(year)) return null;
  const monthIndex = periodeMonthNames.findIndex((item) => item.toLowerCase() === (monthLabelRaw ?? "").toLowerCase());
  if (monthIndex < 0) return null;
  return toPeriodeMonthKey(year, monthIndex);
}

function formatPeriodeFromMonthKey(key: number) {
  if (!Number.isInteger(key)) return "";
  const year = Math.floor(key / 12);
  const monthIndex = key % 12;
  const monthName = periodeMonthNames[monthIndex];
  if (!monthName) return "";
  return `${monthName} ${year}`;
}

function getCurrentPeriodeLabel() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  });
  const [yearPart, monthPart] = formatter.format(now).split("-");
  const parsedYear = Number.parseInt(yearPart ?? "", 10);
  const parsedMonth = Number.parseInt(monthPart ?? "", 10);
  const year = Number.isInteger(parsedYear) ? parsedYear : now.getFullYear();
  const monthIndex = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth - 1 : now.getMonth();
  return `${periodeMonthNames[monthIndex]} ${year}`;
}

function normalizePeriodeText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function textOrDash(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return normalized || "-";
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
  const [payMethod, setPayMethod] = useState<BillRow["payment_method"]>("Transfer Bank");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [bulkPayModalOpen, setBulkPayModalOpen] = useState(false);
  const [bulkPayError, setBulkPayError] = useState("");
  const [bulkPayProofFile, setBulkPayProofFile] = useState<File | null>(null);
  const [bulkPayProofPreviewUrl, setBulkPayProofPreviewUrl] = useState<string>("");
  const bulkPayProofFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkPayDuration, setBulkPayDuration] = useState<"3" | "6" | "12">("3");
  const [bulkPayMethod, setBulkPayMethod] = useState<BillRow["payment_method"]>("Transfer Bank");
  const [bulkPaySubmitting, setBulkPaySubmitting] = useState(false);
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
        const normalizedBillId = previewBill.id.trim().toLowerCase();
        const matchedLogs = logs.filter((row) => (row.record_id ?? "").trim().toLowerCase() === normalizedBillId);
        if (!isActive) return;
        const steps = buildLunasTimeline(matchedLogs, userDirectory, previewViewerEmail);
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

  useEffect(() => {
    if (!bulkPayProofFile || !bulkPayProofFile.type.startsWith("image/")) {
      setBulkPayProofPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(bulkPayProofFile);
    setBulkPayProofPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [bulkPayProofFile]);

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
    setPayMethod((bill.payment_method as BillRow["payment_method"]) ?? "Transfer Bank");
  }

  function openBulkPayModal() {
    setBulkPayModalOpen(true);
    setBulkPayError("");
    setBulkPayProofFile(null);
    setBulkPayDuration("3");
    setBulkPayMethod("Transfer Bank");
  }

  function handleBulkProofFileChange(fileList: FileList | null) {
    setBulkPayProofFile(fileList?.[0] ?? null);
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
          payment_method: payMethod,
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
      setPayMethod("Transfer Bank");
      setSuccessToast(`Pembayaran untuk ${selectedBill.id} berhasil dikirim. Status menjadi Menunggu Verifikasi.`);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Gagal memproses pembayaran.");
    } finally {
      setPaySubmitting(false);
    }
  }

  async function submitBulkBillPayment(
    actorEmail: string | undefined,
    options: { houseId: string | null; monthsCount: 3 | 6 | 12; uploadReferenceBillId: string | null }
  ) {
    if (!options.houseId) {
      setBulkPayError("Data rumah tidak ditemukan.");
      return;
    }
    if (!options.uploadReferenceBillId) {
      setBulkPayError("Belum ada referensi tagihan untuk upload bukti transaksi.");
      return;
    }
    if (!bulkPayProofFile) {
      setBulkPayError("Bukti transaksi wajib diupload.");
      return;
    }

    try {
      setBulkPaySubmitting(true);
      setBulkPayError("");
      const uploaded = await apiClient.uploadBillPaymentProof(options.uploadReferenceBillId, bulkPayProofFile, { actorEmail });
      const result = await apiClient.payBillsBulk(
        {
          house_id: options.houseId,
          months_count: options.monthsCount,
          payment_method: bulkPayMethod,
          payment_proof_url: uploaded.public_url,
        },
        { actorEmail }
      );
      const rows = await apiClient.getBills();
      setLocalBills(rows);
      emitDataChanged();
      setBulkPayModalOpen(false);
      setBulkPayProofFile(null);
      setBulkPayError("");
      setBulkPayDuration("3");
      setBulkPayMethod("Transfer Bank");
      setSuccessToast(`Pembayaran sekaligus berhasil dikirim untuk ${result.total_processed} periode.`);
    } catch (error) {
      setBulkPayError(error instanceof Error ? error.message : "Gagal memproses pembayaran sekaligus.");
    } finally {
      setBulkPaySubmitting(false);
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
        const currentPeriodeLabel = getCurrentPeriodeLabel();
        const canShowBulkPayCta = rows.some(
          (item) => normalizePeriodeText(item.periode) === normalizePeriodeText(currentPeriodeLabel) && isLunasStatus(item.status)
        );
        const selectedMonthsCount = Number.parseInt(bulkPayDuration, 10) as 3 | 6 | 12;
        const bulkAllocationPlan = buildBulkAllocationPlan(rows, selectedMonthsCount);
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
                  <div className={`flex w-full items-end gap-2 sm:hidden ${canShowBulkPayCta ? "justify-between" : "justify-end"}`}>
                    {canShowBulkPayCta ? (
                      <Button
                        type="button"
                        className="h-10 gap-2"
                        onClick={openBulkPayModal}
                      >
                        <WalletCards className="h-4 w-4" />
                        Bayar Sekaligus
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" className="h-10 sm:flex-none" onClick={openFilterModal}>
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                  </div>
                  <div className={`hidden w-full items-end gap-2 sm:flex ${canShowBulkPayCta ? "justify-between" : "justify-end"}`}>
                    {canShowBulkPayCta ? (
                      <Button
                        type="button"
                        className="h-10 gap-2 px-4"
                        onClick={openBulkPayModal}
                      >
                        <WalletCards className="h-4 w-4" />
                        <span className="text-sm">Bayar Sekaligus</span>
                      </Button>
                    ) : null}
                    <div className="flex items-end gap-2">
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
                </div>
                <div className="space-y-3">
                  {filteredRows.length ? (
                    pagedRows.map((item) => {
                      const isLunas = item.status === "Lunas";
                      const isMenungguVerifikasi = item.status === "Menunggu Verifikasi";
                      const isBelumBayar = isBelumBayarStatus(item.status);

                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Lihat detail IPL ${textOrDash(item.id)}`}
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
                              <p className="font-medium">{textOrDash(item.periode)}</p>
                            </div>
                            <PaymentStatusBadge status={item.status} />
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="font-heading text-2xl font-black sm:text-3xl">{textOrDash(item.amount)}</p>
                            {isBelumBayar ? (
                              <Button
                                size="sm"
                                className="h-9 bg-black px-4 text-sm text-white hover:bg-black/90"
                                aria-label="Bayar"
                                title="Bayar"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPayModal(item);
                                }}
                              >
                                Bayar
                                <ArrowRight className="ml-2 h-4 w-4" />
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

            <SimpleModal
              open={bulkPayModalOpen}
              onClose={() => setBulkPayModalOpen(false)}
              closeDisabled={bulkPaySubmitting}
              title={
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>Bayar Sekaligus</span>
                  <Badge variant="outline">{selectedMonthsCount} Bulan</Badge>
                </span>
              }
            >
              <div className="space-y-4">
                <FormErrorAlert message={bulkPayError} />
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Unit</p>
                    <p className="font-medium">{houseDisplay}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Periode Pembayaran</p>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={bulkPayDuration}
                      onChange={(event) => setBulkPayDuration(event.target.value as "3" | "6" | "12")}
                    >
                      <option value="3">3 bulan</option>
                      <option value="6">6 bulan</option>
                      <option value="12">1 tahun</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Nominal</p>
                    <p className="font-heading text-lg font-bold">{formatRupiah(bulkAllocationPlan.totalNominal)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Metode Pembayaran</p>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={bulkPayMethod}
                      onChange={(event) => setBulkPayMethod(event.target.value as BillRow["payment_method"])}
                    >
                      <option value="Transfer Bank">Transfer Bank</option>
                      <option value="QRIS">QRIS</option>
                      <option value="Cash">Cash</option>
                      <option value="E-wallet">E-wallet</option>
                    </select>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Tagihan Yang Akan Diproses</p>
                  <div className="mt-2 max-h-48 overflow-y-auto pr-1 text-sm">
                    {bulkAllocationPlan.items.length ? (
                      <div className="flex flex-wrap gap-2">
                        {bulkAllocationPlan.items.map((item) => (
                          <Badge key={item.periode}>{item.periode}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Belum ada periode yang bisa dialokasikan.</p>
                    )}
                  </div>
                </div>

                {bulkPayProofPreviewUrl ? (
                  <div>
                    {bulkPayProofFile ? <p className="mb-1 text-xs text-muted-foreground">File dipilih: {bulkPayProofFile.name}</p> : null}
                    <div className="relative isolate rounded-lg border border-border bg-muted/20">
                      <input
                        ref={bulkPayProofFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(event) => handleBulkProofFileChange(event.target.files)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute right-[13px] top-[13px] z-30 bg-background/95 shadow-lg ring-1 ring-border/70"
                        onClick={() => {
                          if (!bulkPayProofFileInputRef.current) return;
                          bulkPayProofFileInputRef.current.value = "";
                          bulkPayProofFileInputRef.current.click();
                        }}
                      >
                        <Upload className="mr-1 h-3.5 w-3.5" />
                        Ganti Bukti Transaksi
                      </Button>
                      <div className="h-[280px] overflow-y-auto overflow-x-hidden rounded-lg">
                        <img src={bulkPayProofPreviewUrl} alt="Preview bukti transaksi bayar sekaligus" className="h-auto w-full" />
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
                      onChange={(event) => handleBulkProofFileChange(event.target.files)}
                    />
                    {bulkPayProofFile ? <p className="mt-1 text-xs text-muted-foreground">File dipilih: {bulkPayProofFile.name}</p> : null}
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() =>
                    submitBulkBillPayment(data.session?.email, {
                      houseId: data.house?.id ?? null,
                      monthsCount: selectedMonthsCount,
                      uploadReferenceBillId: bulkAllocationPlan.uploadReferenceBillId,
                    })
                  }
                  disabled={bulkPaySubmitting || !bulkAllocationPlan.items.length}
                >
                  {bulkPaySubmitting ? "Menyimpan..." : "Kirim Pembayaran Sekaligus"}
                </Button>
              </div>
            </SimpleModal>

            <SimpleModal
              open={payModalOpen}
              onClose={() => setPayModalOpen(false)}
              closeDisabled={paySubmitting}
              title={
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>Bayar Tagihan IPL</span>
                  <Badge variant="outline">{selectedBill?.id ?? "-"}</Badge>
                </span>
              }
            >
              <div className="space-y-4">
                <FormErrorAlert message={payError} />
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Unit</p>
                    <p className="font-medium">{houseDisplay}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Periode</p>
                    <p className="font-medium">{selectedBill?.periode ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Nominal</p>
                    <p className="font-heading text-lg font-bold">{selectedBill?.amount ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Metode Pembayaran</p>
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={payMethod}
                      onChange={(event) => setPayMethod(event.target.value as BillRow["payment_method"])}
                    >
                      <option value="Transfer Bank">Transfer Bank</option>
                      <option value="QRIS">QRIS</option>
                      <option value="Cash">Cash</option>
                      <option value="E-wallet">E-wallet</option>
                    </select>
                  </div>
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

            <SimpleModal open={previewModalOpen} onClose={() => setPreviewModalOpen(false)} title="Detail IPL" className="w-[96vw] max-w-2xl">
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
