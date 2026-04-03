"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Crosshair, Eye, FileSpreadsheet, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { BooleanBadge } from "@/components/ui/boolean-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { ApiTableLoadingHead, ApiTableLoadingRow } from "@/components/ui/api-loading-state";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SuccessToast } from "@/components/ui/success-toast";
import { TablePagination, useTablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTimeUnified, getNowDateTimeLocalInput } from "@/lib/date-time";
import { BillRow, HouseRow } from "@/lib/mock-data";
import { apiClient, AuditLogRow, emitDataChanged } from "@/lib/api-client";
import { useAuthSession } from "@/lib/auth-client";
import { downloadRowsAsExcel } from "@/lib/download-excel";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const filterSelectClass =
  "h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";
const OPEN_GENERATE_IPL_EVENT = "smart-open-generate-ipl";

const emptyForm: BillRow = {
  id: "",
  house_id: "",
  periode: "",
  amount: "",
  payment_method: "Transfer Bank",
  status: "Belum bayar",
  status_date: "",
  payment_proof_url: null,
  paid_to_developer: false,
  date_paid_period_to_developer: null,
};

type GenerateForm = {
  month: string;
  amount: string;
};

const monthNames = [
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
];

const monthNameToNumber = Object.fromEntries(monthNames.map((name, index) => [name.toLowerCase(), index + 1]));

function getDefaultMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function toPeriode(monthValue: string) {
  const [year, month] = monthValue.split("-");
  const index = Number(month) - 1;
  return `${monthNames[index]} ${year}`;
}

function toMonthValue(periode: string) {
  const [name, year] = periode.trim().split(" ");
  if (!name || !year) return getDefaultMonth();
  const month = monthNameToNumber[name.toLowerCase()];
  if (!month) return getDefaultMonth();
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getNextBillNumber(rows: BillRow[]) {
  const max = rows.reduce((acc, row) => {
    const match = /^BILL(\d+)$/.exec(row.id);
    if (!match) return acc;
    return Math.max(acc, Number(match[1]));
  }, 0);
  return max + 1;
}

function makeBillId(numberValue: number) {
  return `BILL${String(numberValue).padStart(3, "0")}`;
}

function statusBadge(status: string) {
  return <PaymentStatusBadge status={status} />;
}

function canFinanceVerify(status: BillRow["status"]) {
  const normalized = status.trim().toLowerCase();
  return normalized !== "belum bayar" && normalized !== "lunas";
}

function isImageProof(url: string) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(url);
}

type StatusTimelineRow = {
  id: number;
  updatedAt: string;
  author: string;
  action: string;
  afterStatus: string | null;
  afterStatusDate: string | null;
};

function readStringField(value: Record<string, unknown> | null, key: string) {
  const field = value?.[key];
  return typeof field === "string" ? field : null;
}

function buildStatusTimeline(rows: AuditLogRow[]): StatusTimelineRow[] {
  return rows
    .map((row) => {
      const beforeStatus = readStringField(row.before_value, "status");
      const afterStatus = readStringField(row.after_value, "status");
      const afterStatusDate = readStringField(row.after_value, "status_date");

      if (row.action === "CREATE") {
        if (!afterStatus && !afterStatusDate) return null;
        return {
          id: row.id,
          updatedAt: row.updated_at,
          author: row.author,
          action: row.action,
          afterStatus,
          afterStatusDate,
        };
      }

      if (row.action !== "UPDATE") return null;
      // Fokus histori perubahan status IPL saja: update yang tidak mengubah status di-skip.
      if (beforeStatus === afterStatus) return null;

      return {
        id: row.id,
        updatedAt: row.updated_at,
        author: row.author,
        action: row.action,
        afterStatus,
        afterStatusDate,
      };
    })
    .filter((item): item is StatusTimelineRow => item !== null)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

type BillFormProps = {
  value: BillRow;
  houses: HouseRow[];
  proofFile: File | null;
  onProofFileChange: (file: File | null) => void;
  submitLabel: string;
  submitting?: boolean;
  onChange: (value: BillRow) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readOnlyId?: boolean;
  errorMessage?: string;
  showDeveloperFields?: boolean;
};

function BillForm({
  value,
  houses,
  proofFile,
  onProofFileChange,
  submitLabel,
  submitting = false,
  onChange,
  onSubmit,
  readOnlyId,
  errorMessage,
  showDeveloperFields = true,
}: BillFormProps) {
  const monthValue = value.periode ? toMonthValue(value.periode) : getDefaultMonth();

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <FormErrorAlert message={errorMessage} />
      <div>
        <label className={labelClass}>ID</label>
        <input className={inputClass} value={value.id} readOnly={readOnlyId} disabled={readOnlyId} />
      </div>
      <div>
        <label className={labelClass}>Rumah</label>
        <select
          className={inputClass}
          value={value.house_id}
          onChange={(event) => onChange({ ...value, house_id: event.target.value })}
          required
        >
          <option value="" disabled>
            Pilih Rumah
          </option>
          {houses.map((house) => (
            <option key={house.id} value={house.id}>
              {house.id} • Blok {house.blok} No {house.nomor}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Periode</label>
        <input
          type="month"
          className={inputClass}
          value={monthValue}
          onChange={(event) => onChange({ ...value, periode: toPeriode(event.target.value) })}
          required
        />
      </div>
      <div>
        <label className={labelClass}>Amount</label>
        <input
          className={inputClass}
          value={value.amount}
          onChange={(event) => onChange({ ...value, amount: event.target.value })}
          placeholder="Rp150.000"
          required
        />
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select
          className={inputClass}
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as BillRow["status"] })}
        >
          <option value="Belum bayar">Belum bayar</option>
          <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
          <option value="Verifikasi">Verifikasi</option>
          <option value="Lunas">Lunas</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Payment Method</label>
        <select
          className={inputClass}
          value={value.payment_method}
          onChange={(event) => onChange({ ...value, payment_method: event.target.value as BillRow["payment_method"] })}
        >
          <option value="Transfer Bank">Transfer Bank</option>
          <option value="Cash">Cash</option>
          <option value="QRIS">QRIS</option>
          <option value="E-wallet">E-wallet</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Bukti Pembayaran</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className={`${inputClass} py-1.5`}
          onChange={(event) => onProofFileChange(event.target.files?.[0] ?? null)}
        />
        {proofFile ? <p className="mt-1 text-xs text-muted-foreground">File dipilih: {proofFile.name}</p> : null}
        {value.payment_proof_url ? (
          <a
            href={value.payment_proof_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-primary underline underline-offset-2"
          >
            Lihat bukti saat ini
          </a>
        ) : null}
      </div>
      {showDeveloperFields ? (
        <>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.paid_to_developer}
                onChange={(event) =>
                  onChange({
                    ...value,
                    paid_to_developer: event.target.checked,
                    date_paid_period_to_developer: event.target.checked ? value.date_paid_period_to_developer : null,
                  })
                }
              />
              <span className="text-muted-foreground">Paid to Developer</span>
            </label>
          </div>
          <div>
            <label className={labelClass}>Date Paid Period to Developer</label>
            <input
              type="date"
              className={inputClass}
              value={value.date_paid_period_to_developer ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  date_paid_period_to_developer: event.target.value || null,
                })
              }
              disabled={!value.paid_to_developer}
            />
          </div>
        </>
      ) : null}
      <Button type="submit" loading={submitting} loadingText="Menyimpan..." disabled={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

type CreateBillModalProps = {
  open: boolean;
  onClose: () => void;
  value: BillRow;
  houses: HouseRow[];
  proofFile: File | null;
  onProofFileChange: (file: File | null) => void;
  onChange: (value: BillRow) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string;
};

function CreateBillModal({
  open,
  onClose,
  value,
  houses,
  proofFile,
  onProofFileChange,
  onChange,
  onSubmit,
  submitting,
  errorMessage,
}: CreateBillModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Create IPL">
      <BillForm
        value={value}
        houses={houses}
        proofFile={proofFile}
        onProofFileChange={onProofFileChange}
        onChange={onChange}
        submitLabel="Create"
        submitting={submitting}
        onSubmit={onSubmit}
        readOnlyId
        showDeveloperFields={false}
        errorMessage={errorMessage}
      />
    </SimpleModal>
  );
}

type UpdateBillModalProps = {
  open: boolean;
  onClose: () => void;
  value: BillRow;
  houses: HouseRow[];
  proofFile: File | null;
  onProofFileChange: (file: File | null) => void;
  onChange: (value: BillRow) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string;
};

function UpdateBillModal({
  open,
  onClose,
  value,
  houses,
  proofFile,
  onProofFileChange,
  onChange,
  onSubmit,
  submitting,
  errorMessage,
}: UpdateBillModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Update IPL">
      <BillForm
        value={value}
        houses={houses}
        proofFile={proofFile}
        onProofFileChange={onProofFileChange}
        onChange={onChange}
        submitLabel="Update"
        submitting={submitting}
        onSubmit={onSubmit}
        readOnlyId
        showDeveloperFields={false}
        errorMessage={errorMessage}
      />
    </SimpleModal>
  );
}

type FinanceVerifyForm = {
  payment_method: BillRow["payment_method"];
};

type FinanceVerifyModalProps = {
  open: boolean;
  onClose: () => void;
  currentProofUrl?: string | null;
  value: FinanceVerifyForm;
  onChange: (value: FinanceVerifyForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string;
};

function FinanceVerifyModal({
  open,
  onClose,
  currentProofUrl,
  value,
  onChange,
  onSubmit,
  submitting,
  errorMessage,
}: FinanceVerifyModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Verifikasi IPL">
      <form className="space-y-3" onSubmit={onSubmit}>
        <FormErrorAlert message={errorMessage} />
        <div>
          <label className={labelClass}>Payment Method</label>
          <select
            className={inputClass}
            value={value.payment_method}
            onChange={(event) => onChange({ ...value, payment_method: event.target.value as BillRow["payment_method"] })}
          >
            <option value="Transfer Bank">Transfer Bank</option>
            <option value="Cash">Cash</option>
            <option value="QRIS">QRIS</option>
            <option value="E-wallet">E-wallet</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Preview Bukti Pembayaran</label>
          {currentProofUrl ? (
            isImageProof(currentProofUrl) ? (
              <div className="h-[360px] overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-muted/20">
                <img src={currentProofUrl} alt="Bukti pembayaran warga" className="h-auto w-full" />
              </div>
            ) : (
              <a href={currentProofUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-primary underline underline-offset-2">
                Lihat bukti pembayaran
              </a>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Bukti pembayaran belum tersedia.</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} loadingText="Memproses..." disabled={submitting}>
            Terverifikasi Bayar
          </Button>
        </div>
      </form>
    </SimpleModal>
  );
}

type GenerateBillModalProps = {
  open: boolean;
  onClose: () => void;
  value: GenerateForm;
  onChange: (value: GenerateForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string;
};

function GenerateBillModal({ open, onClose, value, onChange, onSubmit, submitting, errorMessage }: GenerateBillModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Generate IPL">
      <form className="space-y-3" onSubmit={onSubmit}>
        <FormErrorAlert message={errorMessage} />
        <div>
          <label className={labelClass}>Periode Bulan</label>
          <input
            type="month"
            className={inputClass}
            value={value.month}
            onChange={(event) => onChange({ ...value, month: event.target.value })}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Nominal IPL</label>
          <input
            className={inputClass}
            value={value.amount}
            onChange={(event) => onChange({ ...value, amount: event.target.value })}
            placeholder="Rp150.000"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Action ini akan membuat tagihan IPL dari setiap rumah, akan men-skip rumah yang sudah bayar di bulan sebelumnya.
        </p>
        <Button type="submit" loading={submitting} loadingText="Generate..." disabled={submitting}>
          Generate IPL
        </Button>
      </form>
    </SimpleModal>
  );
}

export function BillsCrud() {
  const shouldLogTableData = process.env.NODE_ENV !== "production";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session } = useAuthSession();
  const actorEmail = session?.email ?? "system@smart-perumahan";
  const [rows, setRows] = useState<BillRow[]>([]);
  const [houses, setHouses] = useState<HouseRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | BillRow["status"]>("all");
  const [blokFilter, setBlokFilter] = useState("all");
  const [periodeFilter, setPeriodeFilter] = useState("all");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<BillRow>(emptyForm);
  const [editForm, setEditForm] = useState<BillRow>(emptyForm);
  const [createProofFile, setCreateProofFile] = useState<File | null>(null);
  const [editProofFile, setEditProofFile] = useState<File | null>(null);
  const [generateForm, setGenerateForm] = useState<GenerateForm>({
    month: getDefaultMonth(),
    amount: "Rp150.000",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRow, setPreviewRow] = useState<BillRow | null>(null);
  const [previewHistoryRows, setPreviewHistoryRows] = useState<AuditLogRow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"" | "delete">("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [createError, setCreateError] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [generateSubmitting, setGenerateSubmitting] = useState(false);
  const [verifyForm, setVerifyForm] = useState<FinanceVerifyForm>({
    payment_method: "Transfer Bank",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    function onOpenGenerateFromHeader() {
      openGenerateModal();
    }
    window.addEventListener(OPEN_GENERATE_IPL_EVENT, onOpenGenerateFromHeader);
    return () => {
      window.removeEventListener(OPEN_GENERATE_IPL_EVENT, onOpenGenerateFromHeader);
    };
  }, []);

  const hasFullAccess = session?.role === "admin" || session?.role === "superadmin" || session?.role === "finance";
  const isAdmin = session?.role === "admin" || session?.role === "superadmin";
  const isFinance = session?.role === "finance";
  const verifyBillId = searchParams.get("verifyBill")?.trim() ?? "";

  const houseById = useMemo(() => {
    return new Map(houses.map((house) => [house.id, house]));
  }, [houses]);

  function houseDisplayValue(houseId: string) {
    const house = houseById.get(houseId);
    if (!house) return "-";
    return `Blok ${house.blok} - No ${house.nomor}`;
  }

  const blokOptions = useMemo(() => {
    return Array.from(new Set(houses.map((house) => house.blok.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "id", { numeric: true, sensitivity: "base" })
    );
  }, [houses]);

  const periodeOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.periode).filter(Boolean))).sort((a, b) => toMonthValue(b).localeCompare(toMonthValue(a)));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const house = houseById.get(row.house_id);
      const blokValue = house?.blok ?? "-";
      const statusMatch = statusFilter === "all" ? true : row.status === statusFilter;
      const blokMatch = blokFilter === "all" ? true : blokValue === blokFilter;
      const periodeMatch = periodeFilter === "all" ? true : row.periode === periodeFilter;
      return statusMatch && blokMatch && periodeMatch;
    });
  }, [rows, statusFilter, blokFilter, periodeFilter, houseById]);
  const tablePagination = useTablePagination(filteredRows);
  const pageIds = tablePagination.pagedRows.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const listColSpan = isAdmin ? 7 : 6;

  const previewTimelineRows = useMemo(() => buildStatusTimeline(previewHistoryRows), [previewHistoryRows]);
  const previewPagination = useTablePagination(previewTimelineRows);
  const previewBillCreatedAt = useMemo(() => {
    const createRow = previewHistoryRows.find((row) => row.action === "CREATE");
    return createRow?.updated_at ?? null;
  }, [previewHistoryRows]);
  const previewHouse = previewRow ? houseById.get(previewRow.house_id) : null;

  useEffect(() => {
    if (!shouldLogTableData) return;
    console.log("[Table][Admin IPL] rows:", rows);
    console.log("[Table][Admin IPL] filteredRows:", filteredRows);
    console.log("[Table][Admin IPL] pagedRows:", tablePagination.pagedRows);
  }, [shouldLogTableData, rows, filteredRows, tablePagination.pagedRows]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
  }, [rows]);

  useEffect(() => {
    if (!selectedIds.length && bulkAction) {
      setBulkAction("");
    }
  }, [selectedIds.length, bulkAction]);

  useEffect(() => {
    if (!shouldLogTableData) return;
    if (!previewOpen) return;
    console.log("[Table][Admin IPL][Preview] timelineRows:", previewTimelineRows);
  }, [shouldLogTableData, previewOpen, previewTimelineRows]);

  useEffect(() => {
    if (!verifyBillId || !isFinance || loading) return;

    const targetBill = rows.find((item) => item.id === verifyBillId);
    if (!targetBill) {
      setMessage(`Data IPL ${verifyBillId} tidak ditemukan.`);
      clearVerifyBillQuery();
      return;
    }

    if (!canFinanceVerify(targetBill.status)) {
      setMessage(`IPL ${verifyBillId} belum bisa diverifikasi karena status masih "Belum bayar".`);
      clearVerifyBillQuery();
      return;
    }

    openVerifyModal(targetBill);
    clearVerifyBillQuery();
  }, [verifyBillId, isFinance, loading, rows]);

  function clearVerifyBillQuery() {
    if (!verifyBillId) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("verifyBill");
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  async function loadInitialData() {
    try {
      setLoading(true);
      const [billsData, housesData] = await Promise.all([apiClient.getBills(), apiClient.getHouses()]);
      setRows(
        billsData.map((item) => ({
          ...item,
          payment_method: item.payment_method ?? "Transfer Bank",
          status_date: item.status_date ?? getNowDateTimeLocalInput(),
          payment_proof_url: item.payment_proof_url ?? null,
          paid_to_developer: item.paid_to_developer ?? false,
          date_paid_period_to_developer: item.date_paid_period_to_developer ?? null,
        }))
      );
      setHouses(housesData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat bills.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    const nextNumber = getNextBillNumber(rows);
    const firstHouse = houses[0]?.id ?? "";
    setCreateProofFile(null);
    setCreateForm({
      id: makeBillId(nextNumber),
      house_id: firstHouse,
      periode: toPeriode(getDefaultMonth()),
      amount: "Rp150.000",
      payment_method: "Transfer Bank",
      status: "Belum bayar",
      status_date: getNowDateTimeLocalInput(),
      payment_proof_url: null,
      paid_to_developer: false,
      date_paid_period_to_developer: null,
    });
    setCreateOpen(true);
    setCreateError("");
    setMessage("");
  }

  async function createBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    if (!createForm.house_id) {
      setCreateError("Pilih rumah terlebih dulu.");
      return;
    }

    if (rows.some((item) => item.id === createForm.id)) {
      setCreateError("ID IPL sudah digunakan.");
      return;
    }

    const existedPeriode = rows.some((item) => item.house_id === createForm.house_id && item.periode === createForm.periode);
    if (existedPeriode) {
      setCreateError("Rumah ini sudah punya IPL di periode tersebut.");
      return;
    }

    try {
      setCreateSubmitting(true);
      let paymentProofUrl = createForm.payment_proof_url ?? null;
      if (createProofFile) {
        const uploaded = await apiClient.uploadBillPaymentProof(createForm.id, createProofFile, { actorEmail });
        paymentProofUrl = uploaded.public_url;
      }
      await apiClient.createBill({ ...createForm, payment_proof_url: paymentProofUrl }, { actorEmail });
      await loadInitialData();
      emitDataChanged();
      setCreateOpen(false);
      setCreateProofFile(null);
      setMessage("");
      setCreateError("");
      setSuccessToast("IPL berhasil ditambahkan.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Gagal menambah IPL.");
    } finally {
      setCreateSubmitting(false);
    }
  }

  function openEditModal(row: BillRow) {
    setEditingId(row.id);
    setEditProofFile(null);
    setEditForm({
      ...row,
      payment_method: row.payment_method ?? "Transfer Bank",
      status_date: row.status_date ?? getNowDateTimeLocalInput(),
      payment_proof_url: row.payment_proof_url ?? null,
      paid_to_developer: row.paid_to_developer ?? false,
      date_paid_period_to_developer: row.date_paid_period_to_developer ?? null,
    });
    setUpdateOpen(true);
    setUpdateError("");
    setMessage("");
  }

  function openVerifyModal(row: BillRow) {
    setVerifyingId(row.id);
    setVerifyForm({
      payment_method: row.payment_method ?? "Transfer Bank",
    });
    setVerifyError("");
    setVerifyOpen(true);
    setMessage("");
  }

  async function updateBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setUpdateError("");

    const existedPeriode = rows.some(
      (item) => item.id !== editingId && item.house_id === editForm.house_id && item.periode === editForm.periode
    );
    if (existedPeriode) {
      const errorMessage = "Kombinasi rumah dan periode sudah digunakan IPL lain.";
      setUpdateError(errorMessage);
      return;
    }

    try {
      setUpdateSubmitting(true);
      let paymentProofUrl = editForm.payment_proof_url ?? null;
      if (editProofFile) {
        const uploaded = await apiClient.uploadBillPaymentProof(editingId, editProofFile, { actorEmail });
        paymentProofUrl = uploaded.public_url;
      }
      await apiClient.updateBill(editingId, {
        house_id: editForm.house_id,
        periode: editForm.periode,
        amount: editForm.amount,
        payment_method: editForm.payment_method,
        status: editForm.status,
        payment_proof_url: paymentProofUrl,
        paid_to_developer: editForm.paid_to_developer,
        date_paid_period_to_developer: editForm.date_paid_period_to_developer,
      }, { actorEmail });
      await loadInitialData();
      emitDataChanged();
      setEditingId(null);
      setEditForm(emptyForm);
      setEditProofFile(null);
      setUpdateOpen(false);
      setUpdateError("");
      setMessage("");
      setSuccessToast("Data IPL berhasil diperbarui.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal memperbarui IPL.";
      setUpdateError(errorMessage);
    } finally {
      setUpdateSubmitting(false);
    }
  }

  async function verifyBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verifyingId) return;

    const current = rows.find((row) => row.id === verifyingId);
    if (!current) {
      const errorMessage = "Data IPL tidak ditemukan.";
      setVerifyError(errorMessage);
      return;
    }

    try {
      setVerifySubmitting(true);
      await apiClient.updateBill(
        verifyingId,
        {
          house_id: current.house_id,
          periode: current.periode,
          amount: current.amount,
          payment_method: verifyForm.payment_method,
          status: "Lunas",
          payment_proof_url: current.payment_proof_url ?? null,
          paid_to_developer: current.paid_to_developer,
          date_paid_period_to_developer: current.date_paid_period_to_developer,
        },
        { actorEmail }
      );
      await loadInitialData();
      emitDataChanged();
      setVerifyOpen(false);
      setVerifyingId(null);
      setVerifyError("");
      setMessage("");
      setSuccessToast("Verifikasi IPL berhasil disimpan.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal memverifikasi IPL.";
      setVerifyError(errorMessage);
    } finally {
      setVerifySubmitting(false);
    }
  }

  async function deleteBill(id: string) {
    try {
      await apiClient.deleteBill(id, { actorEmail });
      await loadInitialData();
      emitDataChanged();
      if (editingId === id) {
        setEditingId(null);
        setUpdateOpen(false);
        setEditForm(emptyForm);
      }
      setMessage("Data IPL berhasil dihapus.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus IPL.");
      return false;
    }
  }

  async function deleteBillsByIds(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    const failedIds: string[] = [];

    for (const id of uniqueIds) {
      try {
        await apiClient.deleteBill(id, { actorEmail });
        if (editingId === id) {
          setEditingId(null);
          setUpdateOpen(false);
          setEditForm(emptyForm);
        }
      } catch {
        failedIds.push(id);
      }
    }

    await loadInitialData();
    emitDataChanged();

    return { failedIds, total: uniqueIds.length };
  }

  function openDeleteModal(id: string) {
    setDeleteId(id);
    setMessage("");
  }

  async function confirmDeleteBill() {
    if (!deleteId) return;
    setDeleting(true);
    const success = await deleteBill(deleteId);
    setDeleting(false);
    if (success) setDeleteId(null);
  }

  async function confirmBulkDeleteBills() {
    if (!selectedIds.length) return;
    setDeleting(true);
    try {
      const result = await deleteBillsByIds(selectedIds);
      if (!result.failedIds.length) {
        setSuccessToast(`${result.total} IPL berhasil dihapus.`);
      } else {
        setMessage(`Sebagian data gagal dihapus: ${result.failedIds.join(", ")}`);
      }
    } finally {
      setDeleting(false);
      setBulkDeleteOpen(false);
      setSelectedIds([]);
      setBulkAction("");
    }
  }

  function toggleRowSelection(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  }

  function togglePageSelection(checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, ...pageIds]));
      return prev.filter((id) => !pageIds.includes(id));
    });
  }

  function applyBulkAction() {
    if (!bulkAction) {
      setMessage("Pilih multi action terlebih dahulu.");
      return;
    }
    if (!selectedIds.length) {
      setMessage("Pilih minimal 1 data untuk multi action.");
      return;
    }
    if (bulkAction === "delete") {
      setBulkDeleteOpen(true);
    }
  }

  async function generateBillForAllHouses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerateError("");
    try {
      setGenerateSubmitting(true);
      const result = await apiClient.generateBills({
        month: generateForm.month,
        amount: generateForm.amount,
      }, { actorEmail });
      await loadInitialData();
      emitDataChanged();
      setGenerateOpen(false);
      setMessage(
        `Generate ${result.periode} selesai: dibuat ${result.created}, diperbarui ${result.updated}, skip lunas ${result.skipPaid}, skip existing ${result.skipExisting}.`
      );
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Gagal generate IPL.");
    } finally {
      setGenerateSubmitting(false);
    }
  }

  function openGenerateModal() {
    setGenerateError("");
    setGenerateOpen(true);
  }

  async function loadPreviewHistory(recordId: string) {
    try {
      setPreviewLoading(true);
      const rows = await apiClient.getAuditLogs("bills", 200, recordId);
      setPreviewHistoryRows(rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat preview detail IPL.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function openPreviewModal(row: BillRow) {
    setPreviewRow(row);
    setPreviewHistoryRows([]);
    setPreviewOpen(true);
    void loadPreviewHistory(row.id);
  }

  function renderStatusCell(status: string | null) {
    if (!status) return <span className="text-xs text-muted-foreground">-</span>;
    if (
      status === "Lunas" ||
      status === "Belum bayar" ||
      status === "Menunggu Verifikasi" ||
      status === "Pending" ||
      status === "Verifikasi"
    ) {
      return statusBadge(status);
    }
    return <span className="text-xs">{status}</span>;
  }

  function downloadFilteredReport() {
    downloadRowsAsExcel({
      filenamePrefix: "ipl-report",
      rows: filteredRows,
      columns: [
        { header: "ID", value: (row) => row.id },
        { header: "Unit", value: (row) => houseDisplayValue(row.house_id) },
        { header: "Periode", value: (row) => row.periode },
        { header: "Amount", value: (row) => row.amount },
        { header: "Status", value: (row) => row.status },
        { header: "Date", value: (row) => formatDateTimeUnified(row.status_date) },
      ],
    });
  }

  function resetFilters() {
    setStatusFilter("all");
    setBlokFilter("all");
    setPeriodeFilter("all");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Data IPL</CardTitle>
          {hasFullAccess ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {hasFullAccess ? (
                <Button className="w-full sm:w-auto" onClick={openCreateModal}>
                  Create IPL
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="flex w-full items-end gap-2 sm:hidden">
              <Button type="button" variant="outline" className="h-10 flex-1" onClick={() => setFilterModalOpen(true)}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
            <div className="hidden w-full sm:block sm:w-[220px]">
              <label className={labelClass}>Status</label>
              <select
                className={filterSelectClass}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | BillRow["status"])}
              >
                <option value="all">Semua status</option>
                <option value="Belum bayar">Belum bayar</option>
                <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                <option value="Verifikasi">Verifikasi</option>
                <option value="Lunas">Lunas</option>
              </select>
            </div>
            <div className="hidden w-full sm:block sm:w-[220px]">
              <label className={labelClass}>Blok</label>
              <select className={filterSelectClass} value={blokFilter} onChange={(event) => setBlokFilter(event.target.value)}>
                <option value="all">Semua blok</option>
                {blokOptions.map((blok) => (
                  <option key={blok} value={blok}>
                    Blok {blok}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden w-full sm:block sm:w-[220px]">
              <label className={labelClass}>Periode</label>
              <select className={filterSelectClass} value={periodeFilter} onChange={(event) => setPeriodeFilter(event.target.value)}>
                <option value="all">Semua periode</option>
                {periodeOptions.map((periode) => (
                  <option key={periode} value={periode}>
                    {periode}
                  </option>
                ))}
              </select>
            </div>
            {isAdmin && selectedIds.length ? (
              <>
                <div className="w-full sm:w-[180px]">
                  <label className={labelClass}>Multi Action</label>
                  <select
                    className={filterSelectClass}
                    value={bulkAction}
                    onChange={(event) => setBulkAction(event.target.value as "" | "delete")}
                  >
                    <option value="">Pilih action</option>
                    <option value="delete">Delete Terpilih</option>
                  </select>
                </div>
                <div className="w-full sm:w-auto">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={applyBulkAction} disabled={!selectedIds.length}>
                    Apply ({selectedIds.length})
                  </Button>
                </div>
              </>
            ) : null}
            <div className="ml-auto hidden items-end sm:flex">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 p-0"
                aria-label="Download report IPL"
                title="Download report IPL"
                onClick={downloadFilteredReport}
                disabled={!filteredRows.length}
              >
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Table className={loading ? "" : "min-w-[920px]"}>
            {loading ? (
              <ApiTableLoadingHead colSpan={listColSpan} />
            ) : (
              <TableHeader>
                <TableRow>
                  {isAdmin ? (
                    <TableHead className="w-[44px]">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={(event) => togglePageSelection(event.target.checked)}
                        aria-label="Pilih semua data IPL pada halaman"
                      />
                    </TableHead>
                  ) : null}
                  <TableHead>Unit</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="min-w-[132px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {loading ? (
                <ApiTableLoadingRow colSpan={listColSpan} message="Memuat data IPL..." />
              ) : filteredRows.length ? (
                tablePagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    {isAdmin ? (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(event) => toggleRowSelection(item.id, event.target.checked)}
                          aria-label={`Pilih IPL ${item.id}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell>{houseDisplayValue(item.house_id)}</TableCell>
                    <TableCell>{item.periode}</TableCell>
                    <TableCell>{item.amount}</TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell>
                      <DateTimeText value={item.status_date} />
                    </TableCell>
                    <TableCell className="min-w-[132px]">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label="Preview detail IPL"
                          title="Preview detail IPL"
                          onClick={() => openPreviewModal(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isFinance && canFinanceVerify(item.status) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            aria-label="Verifikasi IPL"
                            title="Verifikasi IPL"
                            onClick={() => openVerifyModal(item)}
                          >
                            <Crosshair className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            aria-label="Edit IPL"
                            title="Edit IPL"
                            onClick={() => openEditModal(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 border-destructive p-0 text-destructive hover:bg-destructive/10"
                            aria-label="Delete IPL"
                            title="Delete IPL"
                            onClick={() => openDeleteModal(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={listColSpan} className="text-center text-muted-foreground">
                    No record available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!loading ? (
            <TablePagination
              page={tablePagination.page}
              pageSize={tablePagination.pageSize}
              totalItems={tablePagination.totalItems}
              totalPages={tablePagination.totalPages}
              from={tablePagination.from}
              to={tablePagination.to}
              onPageChange={tablePagination.setPage}
              onPageSizeChange={tablePagination.setPageSize}
            />
          ) : null}
        </CardContent>
      </Card>

      <SimpleModal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter IPL" className="max-w-md">
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={filterSelectClass}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | BillRow["status"])}
            >
              <option value="all">Semua status</option>
              <option value="Belum bayar">Belum bayar</option>
              <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
              <option value="Verifikasi">Verifikasi</option>
              <option value="Lunas">Lunas</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Blok</label>
            <select className={filterSelectClass} value={blokFilter} onChange={(event) => setBlokFilter(event.target.value)}>
              <option value="all">Semua blok</option>
              {blokOptions.map((blok) => (
                <option key={blok} value={blok}>
                  Blok {blok}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Periode</label>
            <select className={filterSelectClass} value={periodeFilter} onChange={(event) => setPeriodeFilter(event.target.value)}>
              <option value="all">Semua periode</option>
              {periodeOptions.map((periode) => (
                <option key={periode} value={periode}>
                  {periode}
                </option>
              ))}
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

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <SuccessToast message={successToast} onClose={() => setSuccessToast("")} />

      <CreateBillModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        value={createForm}
        houses={houses}
        proofFile={createProofFile}
        onProofFileChange={setCreateProofFile}
        onChange={setCreateForm}
        onSubmit={createBill}
        submitting={createSubmitting}
        errorMessage={createError}
      />
      <UpdateBillModal
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        value={editForm}
        houses={houses}
        proofFile={editProofFile}
        onProofFileChange={setEditProofFile}
        onChange={setEditForm}
        onSubmit={updateBill}
        submitting={updateSubmitting}
        errorMessage={updateError}
      />
      <FinanceVerifyModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        currentProofUrl={rows.find((row) => row.id === verifyingId)?.payment_proof_url ?? null}
        value={verifyForm}
        onChange={setVerifyForm}
        onSubmit={verifyBill}
        submitting={verifySubmitting}
        errorMessage={verifyError}
      />
      <GenerateBillModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        value={generateForm}
        onChange={setGenerateForm}
        onSubmit={generateBillForAllHouses}
        submitting={generateSubmitting}
        errorMessage={generateError}
      />
      <SimpleModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview Detail IPL${previewRow?.id ? ` - ${previewRow.id}` : ""}`}
        className="w-[96vw] max-w-6xl"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Blok:</span>{" "}
              {previewHouse ? `Blok ${previewHouse.blok} - No ${previewHouse.nomor}` : "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Periode:</span> {previewRow?.periode ?? "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Payment Method:</span> {previewRow?.payment_method ?? "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Bukti Pembayaran:</span>{" "}
              {previewRow?.payment_proof_url ? (
                <a href={previewRow.payment_proof_url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                  Lihat Bukti
                </a>
              ) : (
                "-"
              )}
            </p>
            <p>
              <span className="text-muted-foreground">Status Saat Ini:</span>{" "}
              {previewRow ? renderStatusCell(previewRow.status) : "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Tanggal Generate:</span>{" "}
              <DateTimeText value={previewBillCreatedAt ?? previewRow?.status_date} />
            </p>
            <p>
              <span className="text-muted-foreground">Paid To Developer:</span>{" "}
              {previewRow ? <BooleanBadge value={previewRow.paid_to_developer} /> : "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Date Paid Period To Developer:</span>{" "}
              <DateTimeText value={previewRow?.date_paid_period_to_developer} />
            </p>
          </div>

          <Table className={previewLoading ? "" : "min-w-[900px]"}>
            {previewLoading ? (
              <ApiTableLoadingHead colSpan={4} />
            ) : (
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu Update</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Status Date</TableHead>
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {previewLoading ? (
                <ApiTableLoadingRow colSpan={4} message="Memuat detail perubahan status..." />
              ) : previewTimelineRows.length ? (
                previewPagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <DateTimeText value={item.updatedAt} />
                    </TableCell>
                    <TableCell>{item.author}</TableCell>
                    <TableCell>{renderStatusCell(item.afterStatus)}</TableCell>
                    <TableCell>
                      <DateTimeText value={item.afterStatusDate} />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No record available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!previewLoading ? (
            <TablePagination
              page={previewPagination.page}
              pageSize={previewPagination.pageSize}
              totalItems={previewPagination.totalItems}
              totalPages={previewPagination.totalPages}
              from={previewPagination.from}
              to={previewPagination.to}
              onPageChange={previewPagination.setPage}
              onPageSizeChange={previewPagination.setPageSize}
            />
          ) : null}
        </div>
      </SimpleModal>
      <DeleteConfirmModal
        open={Boolean(deleteId)}
        onClose={() => {
          if (deleting) return;
          setDeleteId(null);
        }}
        onConfirm={confirmDeleteBill}
        title="Delete IPL"
        description="Data IPL akan dihapus permanen."
        loading={deleting}
      />
      <DeleteConfirmModal
        open={bulkDeleteOpen}
        onClose={() => {
          if (deleting) return;
          setBulkDeleteOpen(false);
        }}
        onConfirm={confirmBulkDeleteBills}
        title="Delete Multi IPL"
        description={`${selectedIds.length} data IPL terpilih akan dihapus permanen.`}
        loading={deleting}
      />
    </div>
  );
}
