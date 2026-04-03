"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, FileSpreadsheet, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTimeText } from "@/components/ui/date-time-text";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { ApiTableLoadingRow } from "@/components/ui/api-loading-state";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SuccessToast } from "@/components/ui/success-toast";
import { TablePagination, useTablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatDateTimeUnified,
  getNowDateTimeLocalInput,
  toDateTimeLocalInput,
  toIsoFromDateTimeLocal,
} from "@/lib/date-time";
import { formatRupiahFromAny } from "@/lib/currency";
import { TransactionRow } from "@/lib/mock-data";
import { apiClient, AuditLogRow, emitDataChanged } from "@/lib/api-client";
import { useAuthSession } from "@/lib/auth-client";
import { downloadRowsAsExcel } from "@/lib/download-excel";

type TransactionFormStatus = "" | TransactionRow["status"];
type TransactionFormValue = Omit<TransactionRow, "status"> & { status: TransactionFormStatus };

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const filterSelectClass =
  "h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";
const transactionCategoryOptions: TransactionRow["category"][] = ["IPL Warga", "IPL Cluster", "Barang Inventaris", "Other"];

function getDefaultTransactionName(category: TransactionRow["category"], transactionType: TransactionRow["transaction_type"]) {
  if (category === "Barang Inventaris") {
    return transactionType === "Pengeluaran" ? "Pembelian Barang Inventaris" : "Pemasukan Barang Inventaris";
  }
  if (category === "Other") {
    return transactionType === "Pengeluaran" ? "Pengeluaran Lainnya" : "Pemasukan Lainnya";
  }
  if (category === "IPL Cluster") {
    return transactionType === "Pengeluaran" ? "Transfer IPL ke Cluster" : "Pemasukan IPL Cluster";
  }
  return "Pembayaran IPL Warga";
}

const emptyForm: TransactionFormValue = {
  id: "",
  bill_id: null,
  transaction_type: "Pemasukan",
  transaction_name: "",
  category: "IPL Warga",
  amount: "",
  date: "",
  payment_method: "Transfer Bank",
  status: "",
  status_date: "",
};

function getNextTransactionId(rows: TransactionRow[]) {
  const max = rows.reduce((acc, row) => {
    const match = /^TRX(\d+)$/.exec(row.id);
    if (!match) return acc;
    return Math.max(acc, Number(match[1]));
  }, 0);
  return `TRX${String(max + 1).padStart(3, "0")}`;
}

function normalizeTransactionRow(row: TransactionRow): TransactionRow {
  const fallbackCategory = row.transaction_type === "Pengeluaran" ? "Other" : "IPL Warga";
  const category = transactionCategoryOptions.includes(row.category) ? row.category : fallbackCategory;
  return {
    ...row,
    bill_id: row.bill_id ?? null,
    transaction_type: row.transaction_type ?? "Pemasukan",
    transaction_name: row.transaction_name?.trim() || getDefaultTransactionName(category, row.transaction_type ?? "Pemasukan"),
    category,
    date: toDateTimeLocalInput(row.date) || getNowDateTimeLocalInput(),
    status: row.status ?? "Lunas",
    status_date: row.status_date ?? getNowDateTimeLocalInput(),
  };
}

type StatusTimelineRow = {
  id: number;
  updatedAt: string;
  author: string;
  action: string;
  beforeStatus: string | null;
  afterStatus: string | null;
  beforeStatusDate: string | null;
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
      const beforeStatusDate = readStringField(row.before_value, "status_date");
      const afterStatusDate = readStringField(row.after_value, "status_date");

      if (row.action === "CREATE") {
        if (!afterStatus && !afterStatusDate) return null;
        return {
          id: row.id,
          updatedAt: row.updated_at,
          author: row.author,
          action: row.action,
          beforeStatus,
          afterStatus,
          beforeStatusDate,
          afterStatusDate,
        };
      }

      if (row.action !== "UPDATE") return null;
      if (beforeStatus === afterStatus && beforeStatusDate === afterStatusDate) return null;

      return {
        id: row.id,
        updatedAt: row.updated_at,
        author: row.author,
        action: row.action,
        beforeStatus,
        afterStatus,
        beforeStatusDate,
        afterStatusDate,
      };
    })
    .filter((item): item is StatusTimelineRow => item !== null)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

function transactionStatusBadge(status: string) {
  return <PaymentStatusBadge status={status} />;
}

function transactionTypeBadge(type: TransactionRow["transaction_type"]) {
  if (type === "Pemasukan") return <Badge variant="success">Pemasukan</Badge>;
  return <Badge variant="warning">Pengeluaran</Badge>;
}

type TransactionFormProps = {
  value: TransactionFormValue;
  onChange: (value: TransactionFormValue) => void;
  disableId?: boolean;
  showBillId?: boolean;
  showDateField?: boolean;
  allowEmptyStatus?: boolean;
  errorMessage?: string;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function TransactionForm({
  value,
  onChange,
  disableId,
  showBillId = true,
  showDateField = true,
  allowEmptyStatus = false,
  errorMessage,
  submitLabel,
  submitting = false,
  onSubmit,
}: TransactionFormProps) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <FormErrorAlert message={errorMessage} />
      <div>
        <label className={labelClass}>ID</label>
        <input
          className={inputClass}
          value={value.id}
          onChange={(event) => onChange({ ...value, id: event.target.value })}
          placeholder="TRX010"
          required
          disabled={disableId}
        />
      </div>
      {showBillId ? (
        <div>
          <label className={labelClass}>IPL ID (Optional)</label>
          <input
            className={inputClass}
            value={value.bill_id ?? ""}
            onChange={(event) => onChange({ ...value, bill_id: event.target.value.trim() || null })}
            placeholder="IPL001"
          />
        </div>
      ) : null}
      <div>
        <label className={labelClass}>Transaction Type</label>
        <select
          className={inputClass}
          value={value.transaction_type}
          onChange={(event) => {
            const nextType = event.target.value as TransactionRow["transaction_type"];
            const defaultCategory = nextType === "Pengeluaran" ? "Other" : "IPL Warga";
            const nextCategory = transactionCategoryOptions.includes(value.category) ? value.category : defaultCategory;
            const nextName = value.transaction_name?.trim()
              ? value.transaction_name
              : getDefaultTransactionName(nextCategory, nextType);
            onChange({ ...value, transaction_type: nextType, category: nextCategory, transaction_name: nextName });
          }}
        >
          <option value="Pemasukan">Pemasukan</option>
          <option value="Pengeluaran">Pengeluaran</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Transaction Name</label>
        <input
          className={inputClass}
          value={value.transaction_name}
          onChange={(event) => onChange({ ...value, transaction_name: event.target.value })}
          placeholder="Pembayaran IPL Warga"
          required
        />
      </div>
      <div>
        <label className={labelClass}>Category</label>
        <select
          className={inputClass}
          value={value.category}
          onChange={(event) => {
            const nextCategory = event.target.value as TransactionRow["category"];
            const nextName = value.transaction_name?.trim()
              ? value.transaction_name
              : getDefaultTransactionName(nextCategory, value.transaction_type);
            onChange({ ...value, category: nextCategory, transaction_name: nextName });
          }}
        >
          {transactionCategoryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
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
      {showDateField ? (
        <div>
          <label className={labelClass}>Date</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={value.date}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
            required
          />
        </div>
      ) : null}
      <div>
        <label className={labelClass}>Payment Method</label>
        <select
          className={inputClass}
          value={value.payment_method}
          onChange={(event) => onChange({ ...value, payment_method: event.target.value as TransactionRow["payment_method"] })}
        >
          <option value="Transfer Bank">Transfer Bank</option>
          <option value="Cash">Cash</option>
          <option value="QRIS">QRIS</option>
          <option value="E-wallet">E-wallet</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select
          className={inputClass}
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as TransactionFormStatus })}
        >
          {allowEmptyStatus ? <option value="">Pilih status</option> : null}
          <option value="Belum bayar">Belum bayar</option>
          <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
          <option value="Verifikasi">Verifikasi</option>
          <option value="Lunas">Lunas</option>
        </select>
      </div>
      <Button type="submit" loading={submitting} loadingText="Menyimpan..." disabled={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

type CreateTransactionModalProps = {
  open: boolean;
  onClose: () => void;
  value: TransactionFormValue;
  onChange: (value: TransactionFormValue) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string;
};

function CreateTransactionModal({ open, onClose, value, onChange, onSubmit, submitting, errorMessage }: CreateTransactionModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Create Transaction">
      <TransactionForm
        value={value}
        onChange={onChange}
        submitLabel="Create"
        submitting={submitting}
        onSubmit={onSubmit}
        disableId
        showBillId={false}
        showDateField={false}
        allowEmptyStatus
        errorMessage={errorMessage}
      />
    </SimpleModal>
  );
}

type UpdateTransactionModalProps = {
  open: boolean;
  onClose: () => void;
  value: TransactionFormValue;
  onChange: (value: TransactionFormValue) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string;
};

function UpdateTransactionModal({ open, onClose, value, onChange, onSubmit, submitting, errorMessage }: UpdateTransactionModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Update Transaction">
      <TransactionForm
        value={value}
        onChange={onChange}
        submitLabel="Update"
        submitting={submitting}
        onSubmit={onSubmit}
        disableId
        errorMessage={errorMessage}
      />
    </SimpleModal>
  );
}

export function TransactionsCrud() {
  const shouldLogTableData = process.env.NODE_ENV !== "production";
  const { session } = useAuthSession();
  const actorEmail = session?.email ?? "system@smart-perumahan";
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionRow["transaction_type"]>("all");
  const [methodFilter, setMethodFilter] = useState<"all" | TransactionRow["payment_method"]>("all");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<TransactionFormValue>(emptyForm);
  const [editForm, setEditForm] = useState<TransactionFormValue>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRow, setPreviewRow] = useState<TransactionRow | null>(null);
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
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);
  const isAdmin = session?.role === "admin" || session?.role === "superadmin";

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const typeMatch = typeFilter === "all" ? true : row.transaction_type === typeFilter;
      const methodMatch = methodFilter === "all" ? true : row.payment_method === methodFilter;
      return typeMatch && methodMatch;
    });
  }, [methodFilter, rows, typeFilter]);
  const tablePagination = useTablePagination(filteredRows);
  const pageIds = tablePagination.pagedRows.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const listColSpan = isAdmin ? 7 : 6;

  const previewTimelineRows = useMemo(() => buildStatusTimeline(previewHistoryRows), [previewHistoryRows]);
  const previewPagination = useTablePagination(previewTimelineRows);

  useEffect(() => {
    if (!shouldLogTableData) return;
    console.log("[Table][Admin Transactions] rows:", rows);
    console.log("[Table][Admin Transactions] filteredRows:", filteredRows);
    console.log("[Table][Admin Transactions] pagedRows:", tablePagination.pagedRows);
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
    console.log("[Table][Admin Transactions][Preview] timelineRows:", previewTimelineRows);
  }, [shouldLogTableData, previewOpen, previewTimelineRows]);

  async function loadTransactions() {
    try {
      setLoading(true);
      const data = await apiClient.getTransactions();
      setRows(data.map(normalizeTransactionRow));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat transactions.");
    } finally {
      setLoading(false);
    }
  }

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    if (!createForm.status) {
      setCreateError("Pilih status transaction terlebih dahulu.");
      return;
    }
    const transactionDate = new Date().toISOString();
    setCreateSubmitting(true);
    try {
      await apiClient.createTransaction({
        id: createForm.id,
        bill_id: createForm.bill_id,
        transaction_type: createForm.transaction_type,
        transaction_name: createForm.transaction_name,
        category: createForm.category,
        amount: createForm.amount,
        date: transactionDate,
        payment_method: createForm.payment_method,
        status: createForm.status as TransactionRow["status"],
      }, { actorEmail });
      await loadTransactions();
      emitDataChanged();
      setCreateForm(emptyForm);
      setCreateOpen(false);
      setMessage("");
      setCreateError("");
      setSuccessToast("Transaction berhasil ditambahkan.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Gagal menambah transaction.");
    } finally {
      setCreateSubmitting(false);
    }
  }

  function openCreateModal() {
    const now = getNowDateTimeLocalInput();
    setCreateForm({
      id: getNextTransactionId(rows),
      bill_id: null,
      transaction_type: "Pemasukan",
      transaction_name: "Pembayaran IPL Warga",
      category: "IPL Warga",
      amount: "",
      date: now,
      payment_method: "Transfer Bank",
      status: "",
      status_date: now,
    });
    setCreateOpen(true);
    setCreateError("");
    setMessage("");
  }

  function openEditModal(row: TransactionRow) {
    setEditingId(row.id);
    setEditForm(normalizeTransactionRow(row));
    setUpdateOpen(true);
    setUpdateError("");
    setMessage("");
  }

  async function updateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setUpdateError("");
    if (!editForm.status) {
      const errorMessage = "Status transaction wajib dipilih.";
      setUpdateError(errorMessage);
      return;
    }
    const transactionDate = toIsoFromDateTimeLocal(editForm.date);
    if (!transactionDate) {
      const errorMessage = "Format tanggal transaksi tidak valid.";
      setUpdateError(errorMessage);
      return;
    }
    setUpdateSubmitting(true);
    try {
      await apiClient.updateTransaction(editingId, {
        bill_id: editForm.bill_id,
        transaction_type: editForm.transaction_type,
        transaction_name: editForm.transaction_name,
        category: editForm.category,
        amount: editForm.amount,
        date: transactionDate,
        payment_method: editForm.payment_method,
        status: editForm.status as TransactionRow["status"],
      }, { actorEmail });
      await loadTransactions();
      emitDataChanged();
      setEditingId(null);
      setEditForm(emptyForm);
      setUpdateOpen(false);
      setUpdateError("");
      setMessage("");
      setSuccessToast("Data transaction berhasil diperbarui.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal memperbarui transaction.";
      setUpdateError(errorMessage);
    } finally {
      setUpdateSubmitting(false);
    }
  }

  async function deleteTransaction(id: string) {
    try {
      await apiClient.deleteTransaction(id, { actorEmail });
      await loadTransactions();
      emitDataChanged();
      if (editingId === id) {
        setEditingId(null);
        setUpdateOpen(false);
        setEditForm(emptyForm);
      }
      setMessage("Data transaction berhasil dihapus.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus transaction.");
      return false;
    }
  }

  async function deleteTransactionsByIds(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    const failedIds: string[] = [];

    for (const id of uniqueIds) {
      try {
        await apiClient.deleteTransaction(id, { actorEmail });
        if (editingId === id) {
          setEditingId(null);
          setUpdateOpen(false);
          setEditForm(emptyForm);
        }
      } catch {
        failedIds.push(id);
      }
    }

    await loadTransactions();
    emitDataChanged();

    return { failedIds, total: uniqueIds.length };
  }

  function openDeleteModal(id: string) {
    setDeleteId(id);
    setMessage("");
  }

  async function confirmDeleteTransaction() {
    if (!deleteId) return;
    setDeleting(true);
    const success = await deleteTransaction(deleteId);
    setDeleting(false);
    if (success) setDeleteId(null);
  }

  async function confirmBulkDeleteTransactions() {
    if (!selectedIds.length) return;
    setDeleting(true);
    try {
      const result = await deleteTransactionsByIds(selectedIds);
      if (!result.failedIds.length) {
        setSuccessToast(`${result.total} transaction berhasil dihapus.`);
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

  async function loadPreviewHistory(recordId: string) {
    try {
      setPreviewLoading(true);
      const rows = await apiClient.getAuditLogs("transactions", 200, recordId);
      setPreviewHistoryRows(rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat preview detail transaction.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function openPreviewModal(row: TransactionRow) {
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
      return transactionStatusBadge(status);
    }
    return <span className="text-xs">{status}</span>;
  }

  function downloadFilteredReport() {
    downloadRowsAsExcel({
      filenamePrefix: "transactions-report",
      rows: filteredRows,
      columns: [
        { header: "ID", value: (row) => row.id },
        { header: "Transaction Name", value: (row) => row.transaction_name },
        { header: "Transaction Type", value: (row) => row.transaction_type },
        { header: "Category", value: (row) => row.category },
        { header: "Amount", value: (row) => formatRupiahFromAny(row.amount) },
        { header: "Status Date", value: (row) => formatDateTimeUnified(row.status_date) },
        { header: "Payment Method", value: (row) => row.payment_method },
        { header: "Status", value: (row) => row.status },
      ],
    });
  }

  function resetFilters() {
    setTypeFilter("all");
    setMethodFilter("all");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Data Transaction</CardTitle>
          <Button className="w-full sm:w-auto" onClick={openCreateModal}>
            Create Transaction
          </Button>
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
              <label className={labelClass}>Tipe Transaksi</label>
              <select
                className={filterSelectClass}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as "all" | TransactionRow["transaction_type"])}
              >
                <option value="all">Semua tipe</option>
                <option value="Pemasukan">Pemasukan</option>
                <option value="Pengeluaran">Pengeluaran</option>
              </select>
            </div>
            <div className="hidden w-full sm:block sm:w-[220px]">
              <label className={labelClass}>Metode Pembayaran</label>
              <select
                className={filterSelectClass}
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
                aria-label="Download report transactions"
                title="Download report transactions"
                onClick={downloadFilteredReport}
                disabled={!filteredRows.length}
              >
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                {isAdmin ? (
                  <TableHead className="w-[44px]">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={(event) => togglePageSelection(event.target.checked)}
                      aria-label="Pilih semua data transaction pada halaman"
                    />
                  </TableHead>
                ) : null}
                <TableHead>Transaction Detail</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status Date</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[132px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <ApiTableLoadingRow colSpan={listColSpan} message="Memuat data transaction..." />
              ) : filteredRows.length ? (
                tablePagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    {isAdmin ? (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(event) => toggleRowSelection(item.id, event.target.checked)}
                          aria-label={`Pilih transaction ${item.id}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <p className="text-sm">{item.transaction_name}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {transactionTypeBadge(item.transaction_type)}
                          <Badge variant="secondary">{item.category}</Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatRupiahFromAny(item.amount)}</TableCell>
                    <TableCell>
                      <DateTimeText value={item.status_date} />
                    </TableCell>
                    <TableCell>{item.payment_method}</TableCell>
                    <TableCell>{transactionStatusBadge(item.status)}</TableCell>
                    <TableCell className="min-w-[132px]">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label="Preview detail transaction"
                          title="Preview detail transaction"
                          onClick={() => openPreviewModal(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            aria-label="Edit transaction"
                            title="Edit transaction"
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
                            aria-label="Delete transaction"
                            title="Delete transaction"
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

      <SimpleModal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter Transactions" className="max-w-md">
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Tipe Transaksi</label>
            <select
              className={filterSelectClass}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as "all" | TransactionRow["transaction_type"])}
            >
              <option value="all">Semua tipe</option>
              <option value="Pemasukan">Pemasukan</option>
              <option value="Pengeluaran">Pengeluaran</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Metode Pembayaran</label>
            <select
              className={filterSelectClass}
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

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <SuccessToast message={successToast} onClose={() => setSuccessToast("")} />

      <CreateTransactionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        value={createForm}
        onChange={setCreateForm}
        onSubmit={createTransaction}
        submitting={createSubmitting}
        errorMessage={createError}
      />
      <UpdateTransactionModal
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        value={editForm}
        onChange={setEditForm}
        onSubmit={updateTransaction}
        submitting={updateSubmitting}
        errorMessage={updateError}
      />
      <SimpleModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview Detail Transaction${previewRow?.id ? ` - ${previewRow.id}` : ""}`}
        className="w-[96vw] max-w-6xl"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-sm">
            <p>
              <span className="text-muted-foreground">IPL:</span> {previewRow?.bill_id ?? "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Kategori:</span> {previewRow?.category ?? "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Nama Transaksi:</span> {previewRow?.transaction_name ?? "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Status Saat Ini:</span>{" "}
              {previewRow ? renderStatusCell(previewRow.status) : "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Tanggal Status Saat Ini:</span>{" "}
              <DateTimeText value={previewRow?.status_date} />
            </p>
          </div>

          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Waktu Update</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewLoading ? (
                <ApiTableLoadingRow colSpan={3} message="Memuat detail perubahan status..." />
              ) : previewTimelineRows.length ? (
                previewPagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <DateTimeText value={item.updatedAt} />
                    </TableCell>
                    <TableCell>{item.author}</TableCell>
                    <TableCell>{renderStatusCell(item.afterStatus)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
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
        onConfirm={confirmDeleteTransaction}
        title="Delete Transaction"
        description="Data transaction akan dihapus permanen."
        loading={deleting}
      />
      <DeleteConfirmModal
        open={bulkDeleteOpen}
        onClose={() => {
          if (deleting) return;
          setBulkDeleteOpen(false);
        }}
        onConfirm={confirmBulkDeleteTransactions}
        title="Delete Multi Transaction"
        description={`${selectedIds.length} data transaction terpilih akan dihapus permanen.`}
        loading={deleting}
      />
    </div>
  );
}
