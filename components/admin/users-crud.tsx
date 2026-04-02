"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, FileSpreadsheet, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { UserRow } from "@/lib/mock-data";
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

const emptyForm: UserRow = {
  id: "",
  name: "",
  email: "",
  phone: "",
  role: "warga",
};

function getNextUserId(rows: UserRow[]) {
  const max = rows.reduce((acc, row) => {
    const match = /^U(\d+)$/.exec(row.id);
    if (!match) return acc;
    return Math.max(acc, Number(match[1]));
  }, 0);
  return `U${String(max + 1).padStart(3, "0")}`;
}

type UserFormProps = {
  value: UserRow;
  onChange: (value: UserRow) => void;
  disableId?: boolean;
  errorMessage?: string;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function UserForm({ value, onChange, disableId, errorMessage, submitLabel, submitting = false, onSubmit }: UserFormProps) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <FormErrorAlert message={errorMessage} />
      <div>
        <label className={labelClass}>ID</label>
        <input
          className={inputClass}
          value={value.id}
          onChange={(event) => onChange({ ...value, id: event.target.value })}
          placeholder="U010"
          required
          disabled={disableId}
        />
      </div>
      <div>
        <label className={labelClass}>Name</label>
        <input
          className={inputClass}
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder="Nama Warga"
          required
        />
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          className={inputClass}
          value={value.email}
          onChange={(event) => onChange({ ...value, email: event.target.value.toLowerCase() })}
          placeholder="warga@mail.com"
          required
        />
      </div>
      <div>
        <label className={labelClass}>Phone</label>
        <input
          className={inputClass}
          value={value.phone}
          onChange={(event) => onChange({ ...value, phone: event.target.value })}
          placeholder="0812xxxxxx"
          required
        />
      </div>
      <div>
        <label className={labelClass}>Role</label>
        <select className={inputClass} value={value.role} onChange={(event) => onChange({ ...value, role: event.target.value as UserRow["role"] })}>
          <option value="admin">Admin</option>
          <option value="warga">Warga</option>
          <option value="finance">Finance</option>
        </select>
      </div>
      <Button type="submit" loading={submitting} loadingText="Menyimpan..." disabled={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

type CreateUserModalProps = {
  open: boolean;
  onClose: () => void;
  value: UserRow;
  onChange: (value: UserRow) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string;
};

function CreateUserModal({ open, onClose, value, onChange, onSubmit, submitting, errorMessage }: CreateUserModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Create User">
      <UserForm
        value={value}
        onChange={onChange}
        submitLabel="Create"
        submitting={submitting}
        onSubmit={onSubmit}
        disableId
        errorMessage={errorMessage}
      />
    </SimpleModal>
  );
}

type UpdateUserModalProps = {
  open: boolean;
  onClose: () => void;
  value: UserRow;
  onChange: (value: UserRow) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  errorMessage?: string;
};

function UpdateUserModal({ open, onClose, value, onChange, onSubmit, submitting, errorMessage }: UpdateUserModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title="Update User">
      <UserForm
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

export function UsersCrud() {
  const { session } = useAuthSession();
  const actorEmail = session?.email ?? "system@smart-perumahan";
  const [rows, setRows] = useState<UserRow[]>([]);
  const [historyRows, setHistoryRows] = useState<AuditLogRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRow["role"]>("all");
  const [createForm, setCreateForm] = useState<UserRow>(emptyForm);
  const [editForm, setEditForm] = useState<UserRow>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<UserRow | null>(null);
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

  useEffect(() => {
    loadUsers();
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

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      const roleMatch = roleFilter === "all" ? true : row.role === roleFilter;
      if (!roleMatch) return false;
      if (!keyword) return true;
      const haystack = `${row.name} ${row.email} ${row.phone}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [roleFilter, rows, search]);
  const pagination = useTablePagination(filteredRows);

  useEffect(() => {
    pagination.setPage(1);
  }, [search, roleFilter, pagination.setPage]);

  useEffect(() => {
    console.log("[Table][Admin Users] rows:", rows);
    console.log("[Table][Admin Users] filteredRows:", filteredRows);
    console.log("[Table][Admin Users] pagedRows:", pagination.pagedRows);
  }, [rows, filteredRows, pagination.pagedRows]);

  useEffect(() => {
    if (!hasFullAccess) return;
    console.log("[Table][Admin Users] historyRows:", historyRows);
  }, [hasFullAccess, historyRows]);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await apiClient.getUsers();
      setRows(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat users.");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const rows = await apiClient.getAuditLogs("users", 40);
      setHistoryRows(rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat history users.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setCreateSubmitting(true);
    try {
      await apiClient.createUser(createForm, { actorEmail });
      await loadUsers();
      if (hasFullAccess) await loadHistory();
      emitDataChanged();
      setCreateForm(emptyForm);
      setCreateOpen(false);
      setMessage("");
      setCreateError("");
      setSuccessToast("User berhasil ditambahkan.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Gagal menambah user.");
    } finally {
      setCreateSubmitting(false);
    }
  }

  function openCreateModal() {
    setCreateForm({
      id: getNextUserId(rows),
      name: "",
      email: "",
      phone: "",
      role: "warga",
    });
    setCreateOpen(true);
    setCreateError("");
    setMessage("");
  }

  function openEditModal(row: UserRow) {
    setEditingId(row.id);
    setEditForm(row);
    setUpdateOpen(true);
    setUpdateError("");
    setMessage("");
  }

  function openPreviewModal(row: UserRow) {
    setPreviewRow(row);
    setPreviewOpen(true);
    setMessage("");
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setUpdateError("");
    setUpdateSubmitting(true);
    try {
      await apiClient.updateUser(editingId, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
      }, { actorEmail });
      await loadUsers();
      if (hasFullAccess) await loadHistory();
      emitDataChanged();
      setEditingId(null);
      setEditForm(emptyForm);
      setUpdateOpen(false);
      setUpdateError("");
      setMessage("");
      setSuccessToast("Data user berhasil diperbarui.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal memperbarui user.";
      setUpdateError(errorMessage);
    } finally {
      setUpdateSubmitting(false);
    }
  }

  async function deleteUser(id: string) {
    try {
      await apiClient.deleteUser(id, { actorEmail });
      await loadUsers();
      if (hasFullAccess) await loadHistory();
      emitDataChanged();
      if (editingId === id) {
        setEditingId(null);
        setUpdateOpen(false);
        setEditForm(emptyForm);
      }
      setMessage("Data user berhasil dihapus.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus user.");
      return false;
    }
  }

  function openDeleteModal(id: string) {
    setDeleteId(id);
    setMessage("");
  }

  async function confirmDeleteUser() {
    if (!deleteId) return;
    setDeleting(true);
    const success = await deleteUser(deleteId);
    setDeleting(false);
    if (success) setDeleteId(null);
  }

  function downloadFilteredReport() {
    downloadRowsAsExcel({
      filenamePrefix: "users-report",
      rows: filteredRows,
      columns: [
        { header: "ID", value: (row) => row.id },
        { header: "Name", value: (row) => row.name },
        { header: "Email", value: (row) => row.email },
        { header: "Phone", value: (row) => row.phone },
        { header: "Role", value: (row) => row.role },
      ],
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Data User</CardTitle>
          <Button className="w-full sm:w-auto" onClick={openCreateModal}>
            Create User
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="w-full sm:w-[180px]">
              <label className={labelClass}>Pencarian</label>
              <input
                className={filterInputClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, email, atau nomor telepon"
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <label className={labelClass}>Role</label>
              <select
                className={filterSelectClass}
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as "all" | UserRow["role"])}
              >
                <option value="all">Semua role</option>
                <option value="admin">admin</option>
                <option value="warga">warga</option>
                <option value="finance">finance</option>
              </select>
            </div>
            <div className="ml-auto flex items-end">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 p-0"
                aria-label="Download report users"
                title="Download report users"
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
                <TableHead>User</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="min-w-[132px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <ApiTableLoadingRow colSpan={4} message="Memuat data user..." />
              ) : filteredRows.length ? (
                pagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="align-top">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.email}</p>
                    </TableCell>
                    <TableCell>{item.phone}</TableCell>
                    <TableCell>
                      {item.role === "admin" ? (
                        <Badge>admin</Badge>
                      ) : item.role === "finance" ? (
                        <Badge variant="secondary">finance</Badge>
                      ) : (
                        <Badge variant="outline">warga</Badge>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[132px]">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label="Preview detail user"
                          title="Preview detail user"
                          onClick={() => openPreviewModal(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label="Edit user"
                          title="Edit user"
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 border-destructive p-0 text-destructive hover:bg-destructive/10"
                          aria-label="Delete user"
                          title="Delete user"
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
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
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

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        value={createForm}
        onChange={setCreateForm}
        onSubmit={createUser}
        submitting={createSubmitting}
        errorMessage={createError}
      />
      <UpdateUserModal
        open={updateOpen}
        onClose={() => setUpdateOpen(false)}
        value={editForm}
        onChange={setEditForm}
        onSubmit={updateUser}
        submitting={updateSubmitting}
        errorMessage={updateError}
      />
      <SimpleModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview Detail User${previewRow?.id ? ` - ${previewRow.id}` : ""}`}
        className="w-[96vw] max-w-2xl"
      >
        <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <p>
            <span className="text-muted-foreground">ID:</span> {previewRow?.id ?? "-"}
          </p>
          <p>
            <span className="text-muted-foreground">Name:</span> {previewRow?.name ?? "-"}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span> {previewRow?.email ?? "-"}
          </p>
          <p>
            <span className="text-muted-foreground">Phone:</span> {previewRow?.phone ?? "-"}
          </p>
          <p>
            <span className="text-muted-foreground">Role:</span> {previewRow?.role ?? "-"}
          </p>
        </div>
      </SimpleModal>
      <DeleteConfirmModal
        open={Boolean(deleteId)}
        onClose={() => {
          if (deleting) return;
          setDeleteId(null);
        }}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        description="Data user akan dihapus permanen."
        loading={deleting}
      />

      {hasFullAccess ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-heading text-lg">History Perubahan User</h3>
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
          {showHistory ? <ChangeHistoryTable title="History Perubahan User" rows={historyRows} loading={historyLoading} /> : null}
        </div>
      ) : null}
    </div>
  );
}
