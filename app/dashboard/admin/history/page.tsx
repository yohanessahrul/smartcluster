"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, RefreshCw, SlidersHorizontal } from "lucide-react";

import { ChangeHistoryTable } from "@/components/admin/change-history-table";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiClient, AuditLogRow } from "@/lib/api-client";
import { useAuthSession } from "@/lib/auth-client";
import { downloadRowsAsExcel } from "@/lib/download-excel";

const filterSelectClass =
  "h-10 w-full rounded-[6px] border border-input bg-background px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

export default function AdminGlobalHistoryPage() {
  const { session } = useAuthSession();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tableFilter, setTableFilter] = useState<"all" | "users" | "houses" | "bills" | "transactions">("all");
  const [actionFilter, setActionFilter] = useState<"all" | "CREATE" | "UPDATE" | "DELETE">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const isFinance = session?.role === "finance";

  useEffect(() => {
    void loadHistory();
    window.addEventListener("smart-perumahan-data-changed", loadHistory);
    return () => window.removeEventListener("smart-perumahan-data-changed", loadHistory);
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      setMessage("");
      const data = await apiClient.getGlobalAuditLogs(400);
      setRows(data);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? error.message : "Gagal memuat history global.");
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    const startBoundary = startDate ? new Date(startDate) : null;
    const endBoundary = endDate ? new Date(endDate) : null;
    if (startBoundary) startBoundary.setHours(0, 0, 0, 0);
    if (endBoundary) endBoundary.setHours(23, 59, 59, 999);

    return rows.filter((row) => {
      const tableMatch = tableFilter === "all" ? true : row.table_name === tableFilter;
      const actionMatch = actionFilter === "all" ? true : row.action === actionFilter;
      if (!tableMatch || !actionMatch) return false;

      const updatedAtTime = new Date(row.updated_at).getTime();
      if (Number.isNaN(updatedAtTime)) return false;

      if (startBoundary && updatedAtTime < startBoundary.getTime()) return false;
      if (endBoundary && updatedAtTime > endBoundary.getTime()) return false;

      return true;
    });
  }, [rows, tableFilter, actionFilter, startDate, endDate]);

  function resetFilters() {
    setTableFilter("all");
    setActionFilter("all");
    setStartDate("");
    setEndDate("");
  }

  function downloadFilteredReport() {
    downloadRowsAsExcel({
      filenamePrefix: "global-history",
      rows: filteredRows,
      columns: [
        { header: "Waktu Update", value: (row) => row.updated_at },
        { header: "Author", value: (row) => row.author },
        { header: "Table", value: (row) => row.table_name },
        { header: "Action", value: (row) => row.action },
        { header: "Record ID", value: (row) => row.record_id ?? "-" },
        { header: "Before", value: (row) => JSON.stringify(row.before_value ?? {}) },
        { header: "After", value: (row) => JSON.stringify(row.after_value ?? {}) },
      ],
    });
  }

  if (isFinance) {
    return (
      <div>
        <DashboardHeader
          title="History Perubahan"
          description="Role finance tidak memiliki akses ke history global."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="History Perubahan Global"
        description="Riwayat perubahan halaman terpusat."
        actions={
          <Button type="button" variant="outline" loading={loading} loadingText="Memuat..." onClick={loadHistory}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh History
          </Button>
        }
      />

      <div className="flex w-full items-end gap-2 sm:hidden">
        <Button type="button" variant="outline" className="h-10 flex-1" onClick={() => setFilterModalOpen(true)}>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filter
        </Button>
      </div>

      <div className="hidden flex-wrap gap-3 sm:flex">
        <div className="w-full sm:w-[220px]">
          <label className={labelClass}>Table</label>
          <select
            className={filterSelectClass}
            value={tableFilter}
            onChange={(event) =>
              setTableFilter(event.target.value as "all" | "users" | "houses" | "bills" | "transactions")
            }
          >
            <option value="all">Semua table</option>
            <option value="users">users</option>
            <option value="houses">houses</option>
            <option value="bills">bills</option>
            <option value="transactions">transactions</option>
          </select>
        </div>
        <div className="w-full sm:w-[220px]">
          <label className={labelClass}>Action</label>
          <select
            className={filterSelectClass}
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value as "all" | "CREATE" | "UPDATE" | "DELETE")}
          >
            <option value="all">Semua action</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
        <div className="w-full sm:w-[220px]">
          <label className={labelClass}>Start Date</label>
          <input
            type="date"
            className={filterSelectClass}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="w-full sm:w-[220px]">
          <label className={labelClass}>End Date</label>
          <input
            type="date"
            className={filterSelectClass}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <div className="ml-auto flex items-end">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-10 p-0"
            aria-label="Download report history"
            title="Download report history"
            onClick={downloadFilteredReport}
            disabled={!filteredRows.length}
          >
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <ChangeHistoryTable title="History Perubahan Global" rows={filteredRows} loading={loading} />

      <SimpleModal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Filter History" className="max-w-md">
        <div className="space-y-3">
          <div className="w-full">
            <label className={labelClass}>Table</label>
            <select
              className={filterSelectClass}
              value={tableFilter}
              onChange={(event) =>
                setTableFilter(event.target.value as "all" | "users" | "houses" | "bills" | "transactions")
              }
            >
              <option value="all">Semua table</option>
              <option value="users">users</option>
              <option value="houses">houses</option>
              <option value="bills">bills</option>
              <option value="transactions">transactions</option>
            </select>
          </div>
          <div className="w-full">
            <label className={labelClass}>Action</label>
            <select
              className={filterSelectClass}
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value as "all" | "CREATE" | "UPDATE" | "DELETE")}
            >
              <option value="all">Semua action</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="w-full">
            <label className={labelClass}>Start Date</label>
            <input
              type="date"
              className={filterSelectClass}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="w-full">
            <label className={labelClass}>End Date</label>
            <input
              type="date"
              className={filterSelectClass}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
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
    </div>
  );
}
