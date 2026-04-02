"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, FileSpreadsheet, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BooleanBadge } from "@/components/ui/boolean-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangeHistoryTable } from "@/components/admin/change-history-table";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { ApiTableLoadingRow } from "@/components/ui/api-loading-state";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SuccessToast } from "@/components/ui/success-toast";
import { TablePagination, useTablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HouseRow, UserRow } from "@/lib/mock-data";
import { apiClient, AuditLogRow, emitDataChanged } from "@/lib/api-client";
import { useAuthSession } from "@/lib/auth-client";
import { downloadRowsAsExcel } from "@/lib/download-excel";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const filterSelectClass =
  "h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

type HouseFormState = {
  id: string;
  blok: string;
  nomor: string;
  residential_status: HouseRow["residential_status"];
  isOccupied: boolean;
  primary_email: string;
  secondary_email: string;
};

const emptyForm: HouseFormState = {
  id: "",
  blok: "",
  nomor: "",
  residential_status: "Owner",
  isOccupied: false,
  primary_email: "",
  secondary_email: "",
};

function getNextHouseId(rows: HouseRow[]) {
  const max = rows.reduce((acc, row) => {
    const match = /^H(\d+)$/.exec(row.id);
    if (!match) return acc;
    return Math.max(acc, Number(match[1]));
  }, 0);
  return `H${String(max + 1).padStart(3, "0")}`;
}

function mapToForm(row: HouseRow): HouseFormState {
  return {
    id: row.id,
    blok: row.blok,
    nomor: row.nomor,
    residential_status: row.residential_status ?? "Owner",
    isOccupied: row.isOccupied ?? false,
    primary_email: row.linked_emails[0] ?? "",
    secondary_email: row.linked_emails[1] ?? "",
  };
}

function mapToHouseRow(form: HouseFormState): HouseRow {
  const linked_emails = [form.primary_email, form.secondary_email].map((item) => item.trim().toLowerCase()).filter(Boolean);
  return {
    id: form.id.trim(),
    blok: form.blok.trim(),
    nomor: form.nomor.trim(),
    residential_status: form.residential_status,
    isOccupied: form.isOccupied,
    linked_emails,
  };
}

type HouseFormProps = {
  value: HouseFormState;
  onChange: (value: HouseFormState) => void;
  disableId?: boolean;
  emailFieldMode?: "select" | "combobox";
  emailOptions?: Array<{ email: string; label: string }>;
  errorMessage?: string;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function HouseForm({
  value,
  onChange,
  disableId,
  emailFieldMode = "select",
  emailOptions,
  errorMessage,
  submitLabel,
  submitting = false,
  onSubmit,
}: HouseFormProps) {
  const availableOptions = emailOptions ?? [];
  const secondaryOptions = availableOptions.filter((option) => option.email !== value.primary_email);
  const primaryListId = "house-primary-email-options";
  const secondaryListId = "house-secondary-email-options";

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <FormErrorAlert message={errorMessage} />
      <div>
        <label className={labelClass}>ID</label>
        <input
          className={inputClass}
          value={value.id}
          onChange={(event) => onChange({ ...value, id: event.target.value })}
          placeholder="H010"
          required
          disabled={disableId}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Blok</label>
          <input
            className={inputClass}
            value={value.blok}
            onChange={(event) => onChange({ ...value, blok: event.target.value })}
            placeholder="A"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Nomor</label>
          <input
            className={inputClass}
            value={value.nomor}
            onChange={(event) => onChange({ ...value, nomor: event.target.value })}
            placeholder="12"
            required
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Kepemilikan</label>
        <select
          className={inputClass}
          value={value.residential_status}
          onChange={(event) => onChange({ ...value, residential_status: event.target.value as HouseRow["residential_status"] })}
        >
          <option value="Owner">Owner</option>
          <option value="Contract">Contract</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Dihuni</label>
        <select
          className={inputClass}
          value={value.isOccupied ? "true" : "false"}
          onChange={(event) => onChange({ ...value, isOccupied: event.target.value === "true" })}
        >
          <option value="false">Tidak</option>
          <option value="true">Ya</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Primary</label>
        {emailFieldMode === "combobox" ? (
          <>
            <input
              className={inputClass}
              value={value.primary_email}
              onChange={(event) => {
                const nextPrimary = event.target.value.toLowerCase();
                onChange({
                  ...value,
                  primary_email: nextPrimary,
                  secondary_email: value.secondary_email === nextPrimary ? "" : value.secondary_email,
                });
              }}
              placeholder="Ketik email primary"
              list={primaryListId}
            />
            <datalist id={primaryListId}>
              {availableOptions.map((option) => (
                <option key={option.email} value={option.email}>
                  {option.label}
                </option>
              ))}
            </datalist>
          </>
        ) : (
          <select
            className={inputClass}
            value={value.primary_email}
            onChange={(event) => {
              const nextPrimary = event.target.value.toLowerCase();
              onChange({
                ...value,
                primary_email: nextPrimary,
                secondary_email: value.secondary_email === nextPrimary ? "" : value.secondary_email,
              });
            }}
          >
            <option value="">
              Tanpa Primary
            </option>
            {availableOptions.map((option) => (
              <option key={option.email} value={option.email}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className={labelClass}>Secondary (Optional)</label>
        {emailFieldMode === "combobox" ? (
          <>
            <input
              className={inputClass}
              value={value.secondary_email}
              onChange={(event) => onChange({ ...value, secondary_email: event.target.value.toLowerCase() })}
              placeholder="Ketik email secondary (opsional)"
              list={secondaryListId}
            />
            <datalist id={secondaryListId}>
              {secondaryOptions.map((option) => (
                <option key={option.email} value={option.email}>
                  {option.label}
                </option>
              ))}
            </datalist>
          </>
        ) : (
          <select
            className={inputClass}
            value={value.secondary_email}
            onChange={(event) => onChange({ ...value, secondary_email: event.target.value.toLowerCase() })}
          >
            <option value="">Tanpa Secondary</option>
            {secondaryOptions.map((option) => (
              <option key={option.email} value={option.email}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <Button type="submit" loading={submitting} loadingText="Menyimpan..." disabled={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

type CreateHouseModalProps = {
  open: boolean;
  onClose: () => void;
  value: HouseFormState;
  emailOptions: Array<{ email: string; label: string }>;
  onChange: (value: HouseFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string;
};

function CreateHouseModal({ open, onClose, value, emailOptions, onChange, onSubmit, submitting, errorMessage }: CreateHouseModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Create House">
      <HouseForm
        value={value}
        onChange={onChange}
        submitLabel="Create"
        submitting={submitting}
        onSubmit={onSubmit}
        disableId
        emailOptions={emailOptions}
        emailFieldMode="combobox"
        errorMessage={errorMessage}
      />
    </SimpleModal>
  );
}

type UpdateHouseModalProps = {
  open: boolean;
  onClose: () => void;
  value: HouseFormState;
  onChange: (value: HouseFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  emailOptions: Array<{ email: string; label: string }>;
  submitting?: boolean;
  errorMessage?: string;
};

function UpdateHouseModal({ open, onClose, value, onChange, onSubmit, emailOptions, submitting, errorMessage }: UpdateHouseModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Update House">
      <HouseForm
        value={value}
        onChange={onChange}
        submitLabel="Update"
        submitting={submitting}
        onSubmit={onSubmit}
        disableId
        emailOptions={emailOptions}
        errorMessage={errorMessage}
      />
    </SimpleModal>
  );
}

export function HousesCrud() {
  const { session } = useAuthSession();
  const actorEmail = session?.email ?? "system@smart-perumahan";
  const [rows, setRows] = useState<HouseRow[]>([]);
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [historyRows, setHistoryRows] = useState<AuditLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [blokFilter, setBlokFilter] = useState("all");
  const [occupiedFilter, setOccupiedFilter] = useState<"all" | "true" | "false">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | HouseRow["residential_status"]>("all");
  const [createForm, setCreateForm] = useState<HouseFormState>(emptyForm);
  const [editForm, setEditForm] = useState<HouseFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<HouseRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [createError, setCreateError] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const userByEmail = useMemo(() => {
    return new Map(userRows.map((user) => [user.email.toLowerCase(), user]));
  }, [userRows]);
  const userEmailOptions = useMemo(() => {
    return userRows
      .filter((user) => Boolean(user.email))
      .map((user) => ({
        email: user.email.toLowerCase(),
        label: `${user.name} (${user.email.toLowerCase()})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [userRows]);
  const blokOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.blok.trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "id", { numeric: true, sensitivity: "base" })
    );
  }, [rows]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (session?.role === "admin" || session?.role === "finance") {
      loadHistory();
      return;
    }
    setHistoryRows([]);
    setHistoryLoading(false);
  }, [session?.role]);

  const hasFullAccess = session?.role === "admin" || session?.role === "finance";

  async function loadInitialData() {
    try {
      setLoading(true);
      const [housesData, usersData] = await Promise.all([apiClient.getHouses(), apiClient.getUsers()]);
      setRows(housesData);
      setUserRows(usersData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat data houses.");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const rows = await apiClient.getAuditLogs("houses", 40);
      setHistoryRows(rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat history houses.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function validateLinkedEmails(form: HouseFormState) {
    const emails = [form.primary_email.trim().toLowerCase(), form.secondary_email.trim().toLowerCase()].filter(Boolean);
    if (emails.length > 2) return "Maksimal 2 email per house.";
    if (new Set(emails).size !== emails.length) return "Primary dan Secondary tidak boleh sama.";
    const unknown = emails.find((email) => !userByEmail.has(email));
    if (unknown) return `Email ${unknown} belum ada di tabel user.`;
    return null;
  }

  async function createHouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    const validate = validateLinkedEmails(createForm);
    if (validate) {
      setCreateError(validate);
      return;
    }
    setCreateSubmitting(true);
    try {
      const nextRow = mapToHouseRow(createForm);
      await apiClient.createHouse(
        {
          ...nextRow,
          primary_email: createForm.primary_email.trim().toLowerCase(),
          secondary_email: createForm.secondary_email.trim().toLowerCase(),
          is_occupied: nextRow.isOccupied,
        },
        { actorEmail }
      );
      await loadInitialData();
      if (hasFullAccess) await loadHistory();
      emitDataChanged();
      setCreateForm(emptyForm);
      setCreateOpen(false);
      setMessage("");
      setCreateError("");
      setSuccessToast("House berhasil ditambahkan.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Gagal menambah house.");
    } finally {
      setCreateSubmitting(false);
    }
  }

  function openCreateModal() {
    setCreateForm({
      id: getNextHouseId(rows),
      blok: "",
      nomor: "",
      residential_status: "Owner",
      isOccupied: false,
      primary_email: "",
      secondary_email: "",
    });
    setCreateOpen(true);
    setCreateError("");
    setMessage("");
  }

  function openEditModal(row: HouseRow) {
    setEditingId(row.id);
    setEditForm(mapToForm(row));
    setUpdateOpen(true);
    setUpdateError("");
    setMessage("");
  }

  function openPreviewModal(row: HouseRow) {
    setPreviewRow(row);
    setPreviewOpen(true);
    setMessage("");
  }

  async function updateHouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setUpdateError("");
    const validate = validateLinkedEmails(editForm);
    if (validate) {
      setUpdateError(validate);
      return;
    }
    const nextRow = mapToHouseRow(editForm);
    setUpdateSubmitting(true);
    try {
      await apiClient.updateHouse(editingId, {
        blok: nextRow.blok,
        nomor: nextRow.nomor,
        residential_status: nextRow.residential_status,
        isOccupied: nextRow.isOccupied,
        is_occupied: nextRow.isOccupied,
        linked_emails: nextRow.linked_emails,
        primary_email: editForm.primary_email.trim().toLowerCase(),
        secondary_email: editForm.secondary_email.trim().toLowerCase(),
      }, { actorEmail });
      await loadInitialData();
      if (hasFullAccess) await loadHistory();
      emitDataChanged();
      setEditingId(null);
      setEditForm(emptyForm);
      setUpdateOpen(false);
      setUpdateError("");
      setMessage("");
      setSuccessToast("Data house berhasil diperbarui.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal memperbarui house.";
      setUpdateError(errorMessage);
    } finally {
      setUpdateSubmitting(false);
    }
  }

  async function deleteHouse(id: string) {
    try {
      await apiClient.deleteHouse(id, { actorEmail });
      await loadInitialData();
      if (hasFullAccess) await loadHistory();
      emitDataChanged();
      if (editingId === id) {
        setEditingId(null);
        setUpdateOpen(false);
        setEditForm(emptyForm);
      }
      setMessage("Data house berhasil dihapus.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus house.");
      return false;
    }
  }

  function openDeleteModal(id: string) {
    setDeleteId(id);
    setMessage("");
  }

  async function confirmDeleteHouse() {
    if (!deleteId) return;
    setDeleting(true);
    const success = await deleteHouse(deleteId);
    setDeleting(false);
    if (success) setDeleteId(null);
  }

  function linkedUsersList(row: HouseRow, showEmail = true) {
    return row.linked_emails.map((email, index) => {
      const user = userByEmail.get(email.toLowerCase());
      return {
        label: index === 0 ? "Primary" : "Secondary",
        value: user ? (showEmail ? `${user.name} (${email})` : user.name) : showEmail ? email : "-",
      };
    });
  }

  function downloadFilteredReport() {
    downloadRowsAsExcel({
      filenamePrefix: "houses-report",
      rows: filteredRows,
      columns: [
        { header: "Unit", value: (row) => `${row.blok}-${row.nomor}` },
        { header: "Kepemilikan", value: (row) => row.residential_status },
        { header: "Dihuni", value: (row) => row.isOccupied },
        { header: "Primary", value: (row) => linkedUsersList(row, false).find((item) => item.label === "Primary")?.value ?? "-" },
        { header: "Secondary", value: (row) => linkedUsersList(row, false).find((item) => item.label === "Secondary")?.value ?? "-" },
      ],
    });
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const blokMatch = blokFilter === "all" ? true : row.blok === blokFilter;
      const occupiedMatch =
        occupiedFilter === "all" ? true : occupiedFilter === "true" ? row.isOccupied : !row.isOccupied;
      const statusMatch = statusFilter === "all" ? true : row.residential_status === statusFilter;
      return blokMatch && occupiedMatch && statusMatch;
    });
  }, [rows, blokFilter, occupiedFilter, statusFilter]);
  const pagination = useTablePagination(filteredRows);

  useEffect(() => {
    console.log("[Table][Admin Houses] rows:", rows);
    console.log("[Table][Admin Houses] filteredRows:", filteredRows);
    console.log("[Table][Admin Houses] pagedRows:", pagination.pagedRows);
  }, [rows, filteredRows, pagination.pagedRows]);

  useEffect(() => {
    if (!hasFullAccess) return;
    console.log("[Table][Admin Houses] historyRows:", historyRows);
  }, [hasFullAccess, historyRows]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Data House</CardTitle>
          <Button className="w-full sm:w-auto" onClick={openCreateModal}>
            Create House
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="w-full sm:w-[220px]">
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
            <div className="w-full sm:w-[220px]">
              <label className={labelClass}>Dihuni</label>
              <select
                className={filterSelectClass}
                value={occupiedFilter}
                onChange={(event) => setOccupiedFilter(event.target.value as "all" | "true" | "false")}
              >
                <option value="all">Semua Dihuni</option>
                <option value="true">Ya</option>
                <option value="false">Tidak</option>
              </select>
            </div>
            <div className="w-full sm:w-[220px]">
              <label className={labelClass}>Kepemilikan</label>
              <select
                className={filterSelectClass}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | HouseRow["residential_status"])}
              >
                <option value="all">Semua Kepemilikan</option>
                <option value="Owner">Owner</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
            <div className="ml-auto flex items-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 p-0"
                aria-label="Download report houses"
                title="Download report houses"
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
                <TableHead>Unit</TableHead>
                <TableHead>Kepemilikan</TableHead>
                <TableHead>Dihuni</TableHead>
                <TableHead>Linked Users</TableHead>
                <TableHead className="min-w-[132px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <ApiTableLoadingRow colSpan={5} message="Memuat data house..." />
              ) : filteredRows.length ? (
                pagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{`${item.blok}-${item.nomor}`}</TableCell>
                    <TableCell>{item.residential_status || "-"}</TableCell>
                    <TableCell>
                      <BooleanBadge value={item.isOccupied} />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        {linkedUsersList(item, false).map((itemUser) => (
                          <div key={`${item.id}-${itemUser.label}-${itemUser.value}`} className="flex items-start gap-2 text-sm">
                            <Badge variant={itemUser.label === "Primary" ? "success" : "secondary"}>{itemUser.label}</Badge>
                            <p className="break-words">{itemUser.value}</p>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[132px]">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label="Preview detail house"
                          title="Preview detail house"
                          onClick={() => openPreviewModal(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label="Edit house"
                          title="Edit house"
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 border-destructive p-0 text-destructive hover:bg-destructive/10"
                          aria-label="Delete house"
                          title="Delete house"
                          onClick={() => openDeleteModal(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
              from={pagination.from}
              to={pagination.to}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          ) : null}
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <SuccessToast message={successToast} onClose={() => setSuccessToast("")} />

      <CreateHouseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        value={createForm}
        emailOptions={userEmailOptions}
        onChange={setCreateForm}
        onSubmit={createHouse}
        submitting={createSubmitting}
        errorMessage={createError}
      />
      <UpdateHouseModal
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        value={editForm}
        onChange={setEditForm}
        onSubmit={updateHouse}
        emailOptions={userEmailOptions}
        submitting={updateSubmitting}
        errorMessage={updateError}
      />
      <SimpleModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview Detail House${previewRow?.id ? ` - ${previewRow.id}` : ""}`}
        className="w-[96vw] max-w-3xl"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-sm">
            <p>
              <span className="text-muted-foreground">ID:</span> {previewRow?.id ?? "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Unit:</span> {previewRow ? `${previewRow.blok} - ${previewRow.nomor}` : "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Kepemilikan:</span> {previewRow?.residential_status ?? "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Dihuni:</span>{" "}
              {previewRow ? <BooleanBadge value={previewRow.isOccupied} /> : "-"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="mb-2 text-muted-foreground">Linked Users</p>
            {previewRow ? linkedUsersList(previewRow).length ? (
              <div className="space-y-1">
                {linkedUsersList(previewRow).map((itemUser) => (
                  <div key={`${previewRow.id}-${itemUser.label}-${itemUser.value}`} className="flex items-start gap-2 text-sm">
                    <Badge variant={itemUser.label === "Primary" ? "success" : "secondary"}>{itemUser.label}</Badge>
                    <p className="break-words">{itemUser.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>-</p>
            ) : (
              <p>-</p>
            )}
          </div>
        </div>
      </SimpleModal>
      <DeleteConfirmModal
        open={Boolean(deleteId)}
        onClose={() => {
          if (deleting) return;
          setDeleteId(null);
        }}
        onConfirm={confirmDeleteHouse}
        title="Delete House"
        description="Data house akan dihapus permanen."
        loading={deleting}
      />

      {hasFullAccess ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-heading text-lg">History Perubahan House</h3>
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
          {showHistory ? <ChangeHistoryTable title="History Perubahan House" rows={historyRows} loading={historyLoading} /> : null}
        </div>
      ) : null}
    </div>
  );
}
