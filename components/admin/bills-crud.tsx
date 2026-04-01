"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Crosshair, Eye, FileSpreadsheet, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BooleanBadge } from "@/components/ui/boolean-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangeHistoryTable } from "@/components/admin/change-history-table";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
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
const filterInputClass =
  "h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const filterSelectClass =
  "h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

const emptyForm: BillRow = {
  id: "",
  house_id: "",
  periode: "",
  amount: "",
  payment_method: "Transfer Bank",
  status: "Belum Dibayar",
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

function statusBadge(status: BillRow["status"]) {
  if (status === "Lunas") return <Badge variant="success">Lunas</Badge>;
  if (status === "Belum Dibayar") return <Badge variant="warning">Belum Dibayar</Badge>;
  return <Badge variant="secondary">Verifikasi</Badge>;
}

type StatusTimelineRow = {
  id: number;
  updatedAt: string;
  author: string;
  action: string;
  afterStatus: string | null;
  afterStatusDate: string | null;
  afterPaymentMethod: string | null;
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
      const beforeStatusDate = readStringField(row.before_value, "status_date");
      const afterStatusDate = readStringField(row.after_value, "status_date");
      const beforePaymentMethod = readStringField(row.before_value, "payment_method");
      const afterPaymentMethod = readStringField(row.after_value, "payment_method");

      if (row.action === "CREATE") {
        if (!afterStatus && !afterStatusDate && !afterPaymentMethod) return null;
        return {
          id: row.id,
          updatedAt: row.updated_at,
          author: row.author,
          action: row.action,
          afterStatus,
          afterStatusDate,
          afterPaymentMethod,
        };
      }

      if (row.action !== "UPDATE") return null;
      if (beforeStatus === afterStatus && beforeStatusDate === afterStatusDate && beforePaymentMethod === afterPaymentMethod) return null;

      return {
        id: row.id,
        updatedAt: row.updated_at,
        author: row.author,
        action: row.action,
        afterStatus,
        afterStatusDate,
        afterPaymentMethod,
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
  onChange,
  onSubmit,
  readOnlyId,
  errorMessage,
  showDeveloperFields = true,
}: BillFormProps) {
  const monthValue = value.periode ? toMonthValue(value.periode) : getDefaultMonth();

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div>
        <label className={labelClass}>ID</label>
        <input className={inputClass} value={value.id} readOnly={readOnlyId} disabled={readOnlyId} />
      </div>
      <div>
        <label className={labelClass}>House</label>
        <select
          className={inputClass}
          value={value.house_id}
          onChange={(event) => onChange({ ...value, house_id: event.target.value })}
          required
        >
          <option value="" disabled>
            Pilih House
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
          <option value="Belum Dibayar">Belum Dibayar</option>
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
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      <Button type="submit">{submitLabel}</Button>
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
};

function CreateBillModal({ open, onClose, value, houses, proofFile, onProofFileChange, onChange, onSubmit }: CreateBillModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Create IPL">
      <BillForm
        value={value}
        houses={houses}
        proofFile={proofFile}
        onProofFileChange={onProofFileChange}
        onChange={onChange}
        submitLabel="Create"
        onSubmit={onSubmit}
        readOnlyId
        showDeveloperFields={false}
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
        onSubmit={onSubmit}
        readOnlyId
        showDeveloperFields={false}
        errorMessage={errorMessage}
      />
    </SimpleModal>
  );
}

type FinanceVerifyForm = {
  status: BillRow["status"];
  payment_method: BillRow["payment_method"];
};

type FinanceVerifyModalProps = {
  open: boolean;
  onClose: () => void;
  currentProofUrl?: string | null;
  proofFile: File | null;
  onProofFileChange: (file: File | null) => void;
  value: FinanceVerifyForm;
  onChange: (value: FinanceVerifyForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  errorMessage?: string;
};

function FinanceVerifyModal({
  open,
  onClose,
  currentProofUrl,
  proofFile,
  onProofFileChange,
  value,
  onChange,
  onSubmit,
  errorMessage,
}: FinanceVerifyModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Verifikasi IPL">
      <form className="space-y-3" onSubmit={onSubmit}>
        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={value.status}
            onChange={(event) => onChange({ ...value, status: event.target.value as BillRow["status"] })}
          >
            <option value="Belum Dibayar">Belum Dibayar</option>
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
          {currentProofUrl ? (
            <a href={currentProofUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline underline-offset-2">
              Lihat bukti saat ini
            </a>
          ) : null}
        </div>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="submit">Simpan Verifikasi</Button>
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
};

function GenerateBillModal({ open, onClose, value, onChange, onSubmit }: GenerateBillModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Generate IPL">
      <form className="space-y-3" onSubmit={onSubmit}>
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
        <Button type="submit">Generate IPL</Button>
      </form>
    </SimpleModal>
  );
}

export function BillsCrud() {
  const { session } = useAuthSession();
  const actorEmail = session?.email ?? "system@smart-perumahan";
  const [rows, setRows] = useState<BillRow[]>([]);
  const [houses, setHouses] = useState<HouseRow[]>([]);
  const [historyRows, setHistoryRows] = useState<AuditLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BillRow["status"]>("all");
  const [blokFilter, setBlokFilter] = useState("all");
  const [periodeFilter, setPeriodeFilter] = useState("all");
  const [createForm, setCreateForm] = useState<BillRow>(emptyForm);
  const [editForm, setEditForm] = useState<BillRow>(emptyForm);
  const [createProofFile, setCreateProofFile] = useState<File | null>(null);
  const [editProofFile, setEditProofFile] = useState<File | null>(null);
  const [verifyProofFile, setVerifyProofFile] = useState<File | null>(null);
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
  const [deleting, setDeleting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyForm, setVerifyForm] = useState<FinanceVerifyForm>({
    status: "Verifikasi",
    payment_method: "Transfer Bank",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (session?.role === "admin") {
      loadHistory();
      return;
    }
    setHistoryRows([]);
    setHistoryLoading(false);
  }, [session?.role]);

  const isAdmin = session?.role === "admin";
  const isFinance = session?.role === "finance";

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
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      const house = houseById.get(row.house_id);
      const blokValue = house?.blok ?? "-";
      const statusMatch = statusFilter === "all" ? true : row.status === statusFilter;
      const blokMatch = blokFilter === "all" ? true : blokValue === blokFilter;
      const periodeMatch = periodeFilter === "all" ? true : row.periode === periodeFilter;
      const textMatch = keyword
        ? [
            houseDisplayValue(row.house_id),
            row.periode,
            row.amount,
            row.payment_method,
            row.status,
            row.status_date,
            row.paid_to_developer ? "ya" : "tidak",
            row.date_paid_period_to_developer ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;
      return statusMatch && blokMatch && periodeMatch && textMatch;
    });
  }, [rows, search, statusFilter, blokFilter, periodeFilter, houseById]);
  const tablePagination = useTablePagination(filteredRows);

  const previewTimelineRows = useMemo(() => buildStatusTimeline(previewHistoryRows), [previewHistoryRows]);
  const previewPagination = useTablePagination(previewTimelineRows);
  const previewBillCreatedAt = useMemo(() => {
    const createRow = previewHistoryRows.find((row) => row.action === "CREATE");
    return createRow?.updated_at ?? null;
  }, [previewHistoryRows]);
  const previewHouse = previewRow ? houseById.get(previewRow.house_id) : null;

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

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const rows = await apiClient.getAuditLogs("bills", 40);
      setHistoryRows(rows);
    } finally {
      setHistoryLoading(false);
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
      status: "Belum Dibayar",
      status_date: getNowDateTimeLocalInput(),
      payment_proof_url: null,
      paid_to_developer: false,
      date_paid_period_to_developer: null,
    });
    setCreateOpen(true);
    setMessage("");
  }

  async function createBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.house_id) {
      setMessage("Pilih house terlebih dulu.");
      return;
    }

    if (rows.some((item) => item.id === createForm.id)) {
      setMessage("ID IPL sudah digunakan.");
      return;
    }

    const existedPeriode = rows.some((item) => item.house_id === createForm.house_id && item.periode === createForm.periode);
    if (existedPeriode) {
      setMessage("House ini sudah punya IPL di periode tersebut.");
      return;
    }

    try {
      let paymentProofUrl = createForm.payment_proof_url ?? null;
      if (createProofFile) {
        const uploaded = await apiClient.uploadBillPaymentProof(createForm.id, createProofFile, { actorEmail });
        paymentProofUrl = uploaded.public_url;
      }
      await apiClient.createBill({ ...createForm, payment_proof_url: paymentProofUrl }, { actorEmail });
      await loadInitialData();
      await loadHistory();
      emitDataChanged();
      setCreateOpen(false);
      setCreateProofFile(null);
      setMessage("");
      setSuccessToast("IPL berhasil ditambahkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menambah IPL.");
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
    setVerifyProofFile(null);
    setVerifyForm({
      status: row.status,
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
      const errorMessage = "Kombinasi house dan periode sudah digunakan IPL lain.";
      setUpdateError(errorMessage);
      setMessage(errorMessage);
      return;
    }

    try {
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
      await loadHistory();
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
      setMessage(errorMessage);
    }
  }

  async function verifyBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verifyingId) return;
    const statusDate = new Date().toISOString();

    const current = rows.find((row) => row.id === verifyingId);
    if (!current) {
      const errorMessage = "Data IPL tidak ditemukan.";
      setVerifyError(errorMessage);
      setMessage(errorMessage);
      return;
    }

    try {
      let paymentProofUrl = current.payment_proof_url ?? null;
      if (verifyProofFile) {
        const uploaded = await apiClient.uploadBillPaymentProof(verifyingId, verifyProofFile, { actorEmail });
        paymentProofUrl = uploaded.public_url;
      }
      await apiClient.updateBill(
        verifyingId,
        {
          house_id: current.house_id,
          periode: current.periode,
          amount: current.amount,
          payment_method: verifyForm.payment_method,
          status: verifyForm.status,
          status_date: statusDate,
          payment_proof_url: paymentProofUrl,
          paid_to_developer: current.paid_to_developer,
          date_paid_period_to_developer: current.date_paid_period_to_developer,
        },
        { actorEmail }
      );
      await loadInitialData();
      if (isAdmin) await loadHistory();
      emitDataChanged();
      setVerifyOpen(false);
      setVerifyingId(null);
      setVerifyProofFile(null);
      setVerifyError("");
      setMessage("");
      setSuccessToast("Verifikasi IPL berhasil disimpan.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal memverifikasi IPL.";
      setVerifyError(errorMessage);
      setMessage(errorMessage);
    }
  }

  async function deleteBill(id: string) {
    try {
      await apiClient.deleteBill(id, { actorEmail });
      await loadInitialData();
      await loadHistory();
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

  async function generateBillForAllHouses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const result = await apiClient.generateBills({
        month: generateForm.month,
        amount: generateForm.amount,
      }, { actorEmail });
      await loadInitialData();
      await loadHistory();
      emitDataChanged();
      setGenerateOpen(false);
      setMessage(
        `Generate ${result.periode} selesai: dibuat ${result.created}, diperbarui ${result.updated}, skip lunas ${result.skipPaid}, skip existing ${result.skipExisting}.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal generate IPL.");
    }
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
    if (status === "Lunas" || status === "Belum Dibayar" || status === "Verifikasi") {
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
      ],
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Data IPL</CardTitle>
          {isAdmin || isFinance ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => setGenerateOpen(true)}>
                Generate IPL
              </Button>
              {isAdmin || isFinance ? (
                <Button className="w-full sm:w-auto" onClick={openCreateModal}>
                  Create IPL
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px_44px]">
            <div>
              <label className={labelClass}>Pencarian</label>
              <input
                className={filterInputClass}
                placeholder="Cari unit, periode, amount, status date..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={filterSelectClass}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | BillRow["status"])}
              >
                <option value="all">Semua status</option>
                <option value="Belum Dibayar">Belum Dibayar</option>
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
            <div className="flex items-end">
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
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[132px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : filteredRows.length ? (
                tablePagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{houseDisplayValue(item.house_id)}</TableCell>
                    <TableCell>{item.periode}</TableCell>
                    <TableCell>{item.amount}</TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
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
                        {isFinance ? (
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
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
        errorMessage={updateError}
      />
      <FinanceVerifyModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        currentProofUrl={rows.find((row) => row.id === verifyingId)?.payment_proof_url ?? null}
        proofFile={verifyProofFile}
        onProofFileChange={setVerifyProofFile}
        value={verifyForm}
        onChange={setVerifyForm}
        onSubmit={verifyBill}
        errorMessage={verifyError}
      />
      <GenerateBillModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        value={generateForm}
        onChange={setGenerateForm}
        onSubmit={generateBillForAllHouses}
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
              {formatDateTimeUnified(previewBillCreatedAt ?? previewRow?.status_date)}
            </p>
            <p>
              <span className="text-muted-foreground">Paid To Developer:</span>{" "}
              {previewRow ? <BooleanBadge value={previewRow.paid_to_developer} /> : "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Date Paid Period To Developer:</span>{" "}
              {formatDateTimeUnified(previewRow?.date_paid_period_to_developer)}
            </p>
          </div>

          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Waktu Update</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Memuat detail perubahan status...
                  </TableCell>
                </TableRow>
              ) : previewTimelineRows.length ? (
                previewPagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {formatDateTimeUnified(item.updatedAt)}
                    </TableCell>
                    <TableCell>{item.author}</TableCell>
                    <TableCell>{renderStatusCell(item.afterStatus)}</TableCell>
                    <TableCell>{item.afterPaymentMethod ?? "-"}</TableCell>
                    <TableCell>{formatDateTimeUnified(item.afterStatusDate)}</TableCell>
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

      {isAdmin ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-heading text-lg">History Perubahan IPL</h3>
            <Button variant="outline" size="sm" onClick={() => setShowHistory((prev) => !prev)}>
              {showHistory ? (
                <>
                  Sembunyikan
                  <ChevronUp className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  Tampilkan
                  <ChevronDown className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
          {showHistory ? <ChangeHistoryTable title="History Perubahan IPL" rows={historyRows} loading={historyLoading} /> : null}
        </div>
      ) : null}
    </div>
  );
}
