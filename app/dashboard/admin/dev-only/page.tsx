"use client";

import Link from "next/link";
import { Download, RotateCcw, Server, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { ServerStatusModal } from "@/components/admin/server-status-modal";
import { DashboardHeader } from "@/components/dashboard-header";
import { FormErrorAlert } from "@/components/ui/form-error-alert";
import { PageLoadingScreen } from "@/components/ui/page-loading-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { SuccessToast } from "@/components/ui/success-toast";
import { useAuthSession } from "@/lib/auth-client";
import { apiClient, emitDataChanged } from "@/lib/api-client";

export default function AdminDevOnlyPage() {
  const { loading, session } = useAuthSession();
  const actorEmail = session?.email ?? "system@smart-cluster";
  const isSuperadmin = session?.role === "superadmin";

  const [showServerStatus, setShowServerStatus] = useState(false);
  const [resetDbModalOpen, setResetDbModalOpen] = useState(false);
  const [resetDbSubmitting, setResetDbSubmitting] = useState(false);
  const [resetDbError, setResetDbError] = useState("");
  const [backupSubmitting, setBackupSubmitting] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  function openResetDbModal() {
    setResetDbError("");
    setResetDbModalOpen(true);
  }

  async function confirmResetDatabase() {
    try {
      setResetDbSubmitting(true);
      setResetDbError("");
      const result = await apiClient.resetDatabaseExceptUsers({ actorEmail });
      setResetDbModalOpen(false);
      emitDataChanged();
      setSuccessToast(
        `Reset DB selesai. Bills dan Transactions dikosongkan, audit log terkait dihapus (${result.removed_audit_logs_count} baris).`,
      );
    } catch (error) {
      setResetDbError(error instanceof Error ? error.message : "Gagal mereset database.");
    } finally {
      setResetDbSubmitting(false);
    }
  }

  function readFilenameFromHeader(contentDisposition: string | null) {
    if (!contentDisposition) return null;
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }
    const simpleMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return simpleMatch?.[1] ?? null;
  }

  async function downloadSqlBackup() {
    try {
      setBackupSubmitting(true);
      setBackupError("");
      const response = await fetch("/api/admin/backup-sql", {
        method: "GET",
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          errorBody && typeof errorBody.message === "string" ? errorBody.message : "Gagal membuat backup SQL.";
        throw new Error(message);
      }

      const blob = await response.blob();
      const filename =
        readFilenameFromHeader(response.headers.get("content-disposition")) ??
        `smart-cluster-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccessToast("Backup SQL berhasil diunduh.");
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "Gagal membuat backup SQL.");
    } finally {
      setBackupSubmitting(false);
    }
  }

  if (loading) {
    return <PageLoadingScreen />;
  }

  if (!isSuperadmin) {
    return (
      <div>
        <DashboardHeader title="Dev Only" description="Utility khusus superadmin." />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Akses terbatas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Menu Dev Only hanya bisa diakses oleh role superadmin.
            </p>
            <Button asChild>
              <Link href="/dashboard/admin">Kembali ke Beranda Admin</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader
        title="Dev Only"
        description="Utility maintenance dan operasi sensitif khusus superadmin."
      />
      <FormErrorAlert message={backupError} />

      <section className="rounded-2xl border border-border bg-background px-4 py-5 sm:px-6">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Superadmin Menu</p>
          <h3 className="mt-1 text-lg font-semibold">Dev Only Utilities</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Semua aksi di halaman ini bersifat sensitif dan hanya untuk maintenance sistem.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article className="rounded-xl border border-border bg-white p-4 text-slate-900 shadow-sm">
            <div>
              <p className="text-sm font-semibold">Status Server</p>
              <p className="mt-1 text-xs text-slate-600">
                Melihat kapasitas database, bucket storage, dan ukuran setiap tabel utama.
              </p>
            </div>
            <Button type="button" variant="outline" className="mt-4" onClick={() => setShowServerStatus(true)}>
              <Server className="mr-2 h-4 w-4" />
              Lihat Server
            </Button>
          </article>

          <article className="rounded-xl border border-border bg-white p-4 text-slate-900 shadow-sm">
            <div>
              <p className="text-sm font-semibold">Backup SQL</p>
              <p className="mt-1 text-xs text-slate-600">
                Unduh backup `.sql` seluruh tabel schema public beserta isi datanya untuk kebutuhan backup mandiri.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              loading={backupSubmitting}
              loadingText="Membuat backup SQL..."
              onClick={downloadSqlBackup}
            >
              <Download className="mr-2 h-4 w-4" />
              Backup SQL Database
            </Button>
          </article>

          <article className="rounded-xl border border-border bg-white p-4 text-slate-900 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-red-700">Reset DB</p>
              <p className="mt-1 text-xs text-slate-600">
                Kosongkan tabel `bills` dan `transactions`, lalu hapus audit log terkait kedua tabel.
              </p>
            </div>
            <Button
              type="button"
              className="mt-4 bg-red-500 text-white hover:bg-red-500/90"
              onClick={openResetDbModal}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Tagihan & Transaction
            </Button>
          </article>
        </div>
      </section>

      <ServerStatusModal open={showServerStatus} onClose={() => setShowServerStatus(false)} />
      <SuccessToast message={successToast} onClose={() => setSuccessToast("")} />

      <SimpleModal
        open={resetDbModalOpen}
        onClose={() => setResetDbModalOpen(false)}
        title="Reset Database"
        className="max-w-md"
        closeDisabled={resetDbSubmitting}
      >
        <div className="space-y-4">
          <FormErrorAlert message={resetDbError} />
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Action ini akan:
            kosongkan seluruh data `bills`, kosongkan seluruh data `transactions`, dan hapus semua `audit_logs`
            yang berkaitan dengan `bills` serta `transactions`.
            Pastikan Anda benar-benar yakin.
          </div>
          <p className="text-sm text-muted-foreground">
            Hanya role superadmin yang bisa menjalankan action ini.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setResetDbModalOpen(false)} disabled={resetDbSubmitting}>
              Batal
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              loading={resetDbSubmitting}
              loadingText="Mereset database..."
              onClick={confirmResetDatabase}
            >
              Reset DB
            </Button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
