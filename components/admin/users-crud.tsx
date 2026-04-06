"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, FileSpreadsheet, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { ApiTableLoadingHead, ApiTableLoadingRow } from "@/components/ui/api-loading-state";
import { RoleBadge } from "@/components/ui/role-badge";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SuccessToast } from "@/components/ui/success-toast";
import { TablePagination, useTablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserRow } from "@/lib/mock-data";
import { apiClient, emitDataChanged } from "@/lib/api-client";
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
    <SimpleModal open={open} onClose={onClose} title="Create Pengguna">
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
    <SimpleModal open={open} onClose={onClose} title="Update Pengguna">
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
  const shouldLogTableData = process.env.NODE_ENV !== "production";
  const { session } = useAuthSession();
  const canEditDelete = session?.role === "admin" || session?.role === "superadmin";
  const actorEmail = session?.email ?? "system@smart-perumahan";
  const [rows, setRows] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRow["role"]>("all");
  const [draftSearch, setDraftSearch] = useState("");
  const [draftRoleFilter, setDraftRoleFilter] = useState<"all" | UserRow["role"]>("all");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<UserRow>(emptyForm);
  const [editForm, setEditForm] = useState<UserRow>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<UserRow | null>(null);
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
    loadUsers();
  }, []);

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
  const listColSpan = canEditDelete ? 5 : 4;

  useEffect(() => {
    pagination.setPage(1);
  }, [search, roleFilter, pagination.setPage]);

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
    console.log("[Table][Admin Users] rows:", rows);
    console.log("[Table][Admin Users] filteredRows:", filteredRows);
    console.log("[Table][Admin Users] pagedRows:", pagination.pagedRows);
  }, [shouldLogTableData, rows, filteredRows, pagination.pagedRows]);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await apiClient.getUsers();
      setRows(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat data pengguna.");
    } finally {
      setLoading(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setCreateSubmitting(true);
    try {
      await apiClient.createUser(createForm, { actorEmail });
      await loadUsers();
      emitDataChanged();
      setCreateForm(emptyForm);
      setCreateOpen(false);
      setMessage("");
      setCreateError("");
      setSuccessToast("Pengguna berhasil ditambahkan.");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Gagal menambah pengguna.");
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
      emitDataChanged();
      setEditingId(null);
      setEditForm(emptyForm);
      setUpdateOpen(false);
      setUpdateError("");
      setMessage("");
      setSuccessToast("Data pengguna berhasil diperbarui.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal memperbarui pengguna.";
      setUpdateError(errorMessage);
    } finally {
      setUpdateSubmitting(false);
    }
  }

  async function deleteUser(id: string) {
    try {
      await apiClient.deleteUser(id, { actorEmail });
      await loadUsers();
      emitDataChanged();
      if (editingId === id) {
        setEditingId(null);
        setUpdateOpen(false);
        setEditForm(emptyForm);
      }
      setMessage("Data pengguna berhasil dihapus.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus pengguna.");
      return false;
    }
  }

  async function deleteUsersByIds(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    const failedIds: string[] = [];

    for (const id of uniqueIds) {
      try {
        await apiClient.deleteUser(id, { actorEmail });
        if (editingId === id) {
          setEditingId(null);
          setUpdateOpen(false);
          setEditForm(emptyForm);
        }
      } catch {
        failedIds.push(id);
      }
    }

    await loadUsers();
    emitDataChanged();

    return { failedIds, total: uniqueIds.length };
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

  async function confirmBulkDeleteUsers() {
    if (!selectedIds.length) return;
    setDeleting(true);
    try {
      const result = await deleteUsersByIds(selectedIds);
      if (!result.failedIds.length) {
        setSuccessToast(`${result.total} pengguna berhasil dihapus.`);
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
    const pageIds = pagination.pagedRows.map((row) => row.id);
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

  const pageIds = pagination.pagedRows.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

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

  function openFilterModal() {
    setDraftSearch(search);
    setDraftRoleFilter(roleFilter);
    setFilterModalOpen(true);
  }

  function resetDraftFilters() {
    setDraftSearch("");
    setDraftRoleFilter("all");
  }

  function applyFilters() {
    setSearch(draftSearch);
    setRoleFilter(draftRoleFilter);
    setFilterModalOpen(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Data Pengguna</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="flex w-full items-end gap-2 sm:hidden">
              <Button className="h-10" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Pengguna
              </Button>
              <Button type="button" variant="outline" className="ml-auto h-10 sm:flex-none" onClick={openFilterModal}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
            <div className="hidden items-end gap-2 sm:flex">
              <Button className="h-10" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah Pengguna
              </Button>
            </div>
            {canEditDelete && selectedIds.length ? (
              <>
                <div className="w-full sm:w-[180px]">
                  <label className={labelClass}>Multi Action</label>
                  <select className={filterSelectClass} value={bulkAction} onChange={(event) => setBulkAction(event.target.value as "" | "delete")}>
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
          <div className="mt-[10px]">
            <Table className={loading ? "" : "min-w-[920px]"}>
            {loading ? (
              <ApiTableLoadingHead colSpan={listColSpan} />
            ) : (
              <TableHeader>
                <TableRow>
                  {canEditDelete ? (
                    <TableHead className="w-[44px]">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={(event) => togglePageSelection(event.target.checked)}
                        aria-label="Pilih semua data pada halaman"
                      />
                    </TableHead>
                  ) : null}
                  <TableHead>Pengguna</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="min-w-[132px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {loading ? (
                <ApiTableLoadingRow colSpan={listColSpan} message="Memuat data pengguna..." />
              ) : filteredRows.length ? (
                pagination.pagedRows.map((item) => (
                  <TableRow key={item.id}>
                    {canEditDelete ? (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(event) => toggleRowSelection(item.id, event.target.checked)}
                          aria-label={`Pilih pengguna ${item.name}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="align-top">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.email}</p>
                    </TableCell>
                    <TableCell>{item.phone}</TableCell>
                    <TableCell>
                      <RoleBadge role={item.role} />
                    </TableCell>
                    <TableCell className="min-w-[132px]">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label="Preview detail pengguna"
                          title="Preview detail pengguna"
                          onClick={() => openPreviewModal(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEditDelete ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            aria-label="Edit pengguna"
                            title="Edit pengguna"
                            onClick={() => openEditModal(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canEditDelete ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 border-destructive p-0 text-destructive hover:bg-destructive/10"
                            aria-label="Delete pengguna"
                            title="Delete pengguna"
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
          </div>
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
      <SimpleModal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter Pengguna" className="max-w-md">
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Pencarian</label>
            <input
              className={filterInputClass}
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Cari nama, email, atau nomor telepon"
            />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select
              className={filterSelectClass}
              value={draftRoleFilter}
              onChange={(event) => setDraftRoleFilter(event.target.value as "all" | UserRow["role"])}
            >
              <option value="all">Semua role</option>
              <option value="admin">admin</option>
              <option value="superadmin">superadmin</option>
              <option value="warga">warga</option>
              <option value="finance">finance</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={resetDraftFilters}>
              Reset
            </Button>
            <Button type="button" onClick={applyFilters}>
              Terapkan
            </Button>
          </div>
        </div>
      </SimpleModal>

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
        title={`Preview Detail Pengguna${previewRow?.id ? ` - ${previewRow.id}` : ""}`}
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
        title="Delete Pengguna"
        description="Data pengguna akan dihapus permanen."
        loading={deleting}
      />
      <DeleteConfirmModal
        open={bulkDeleteOpen}
        onClose={() => {
          if (deleting) return;
          setBulkDeleteOpen(false);
        }}
        onConfirm={confirmBulkDeleteUsers}
        title="Delete Multi Pengguna"
        description={`${selectedIds.length} data pengguna terpilih akan dihapus permanen.`}
        loading={deleting}
      />
    </div>
  );
}
