"use client";

import { useEffect, useMemo, useState } from "react";
import { Database, HardDrive, RefreshCw } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Button } from "@/components/ui/button";
import { ApiLoadingState } from "@/components/ui/api-loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient, ServerStatusRow } from "@/lib/api-client";
import { formatDateTimeUnified } from "@/lib/date-time";

type ServerStatusModalProps = {
  open: boolean;
  onClose: () => void;
};

type ChartSlice = {
  name: string;
  value: number;
  color: string;
};

const MB = 1024 * 1024;

function formatMb(bytes: number) {
  const mb = bytes / MB;
  if (mb >= 100) return `${mb.toFixed(1)} MB`;
  if (mb >= 10) return `${mb.toFixed(2)} MB`;
  return `${mb.toFixed(3)} MB`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function ServerStatusModal({ open, onClose }: ServerStatusModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ServerStatusRow | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadServerStatus();
  }, [open]);

  async function loadServerStatus() {
    try {
      setLoading(true);
      setError("");
      const payload = await apiClient.getServerStatus();
      setData(payload);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Gagal memuat status server.");
    } finally {
      setLoading(false);
    }
  }

  const chartData = useMemo<ChartSlice[]>(() => {
    const maxBytes = data?.max_bytes ?? 500 * MB;
    const usedBytesRaw = data?.used_bytes ?? 0;
    const usedBytes = Math.max(0, usedBytesRaw);
    const usedForChart = Math.min(usedBytes, maxBytes);
    const remainingBytes = Math.max(0, maxBytes - usedForChart);

    return [
      { name: "Terpakai", value: usedForChart, color: "#dc2626" },
      { name: "Sisa (Kuota 500MB)", value: remainingBytes, color: "#16a34a" },
    ];
  }, [data]);

  const usagePercent = useMemo(() => {
    if (!data?.max_bytes) return 0;
    return (Math.max(0, data.used_bytes) / data.max_bytes) * 100;
  }, [data]);

  const storageUsagePercent = useMemo(() => {
    if (!data?.storage_max_bytes) return 0;
    return (Math.max(0, data.storage_used_bytes) / data.storage_max_bytes) * 100;
  }, [data]);

  return (
    <SimpleModal open={open} onClose={onClose} title="Status Server" className="max-w-5xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Monitor kapasitas database, size tabel, dan penggunaan bucket storage.
          </p>
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={loadServerStatus} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? <ApiLoadingState message="Memuat status server..." /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && !error && data ? (
          <>
            <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    Kapasitas Database
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2}>
                          {chartData.map((item) => (
                            <Cell key={item.name} fill={item.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatMb(typeof value === "number" ? value : Number(value))}
                          contentStyle={{ borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Terpakai:</span>{" "}
                      <span className="font-medium text-red-600">{formatMb(data.used_bytes)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Maksimal:</span>{" "}
                      <span className="font-medium text-green-600">{formatMb(data.max_bytes)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Sisa:</span> <span className="font-medium">{formatMb(data.remaining_bytes)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Usage:</span>{" "}
                      <span className="font-medium">{`${Math.min(usagePercent, 999).toFixed(2)}%`}</span>
                    </p>
                    {data.over_limit ? (
                      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive">
                        Database melewati limit 500MB. Segera lakukan cleanup.
                      </p>
                    ) : null}
                    <div className="space-y-1 pt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
                        <span>Terpakai</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
                        <span>Sisa dari total 500MB</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    Status Bucket Storage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Bucket:</span> <span className="font-medium">{data.storage_bucket}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Terpakai:</span>{" "}
                    <span className="font-medium text-red-600">{formatMb(data.storage_used_bytes)}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Maksimal:</span>{" "}
                    <span className="font-medium text-green-600">{formatMb(data.storage_max_bytes)}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Sisa:</span>{" "}
                    <span className="font-medium">{formatMb(data.storage_remaining_bytes)}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Total Objects:</span>{" "}
                    <span className="font-medium">{formatNumber(data.storage_object_count)}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Usage:</span>{" "}
                    <span className="font-medium">{`${Math.min(storageUsagePercent, 999).toFixed(2)}%`}</span>
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                    <div
                      className={`h-full ${data.storage_over_limit ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min(storageUsagePercent, 100)}%` }}
                    />
                  </div>
                  {data.storage_over_limit ? (
                    <p className="mt-2 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                      Storage bucket melewati limit 1GB.
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last update: {formatDateTimeUnified(data.generated_at)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Size Masing-masing Table</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Rows (Estimate)</TableHead>
                        <TableHead>Usage dari 500MB</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.table_sizes.length ? (
                        data.table_sizes.map((item) => (
                          <TableRow key={item.table_name}>
                            <TableCell className="font-medium">{item.table_name}</TableCell>
                            <TableCell>{formatMb(item.size_bytes)}</TableCell>
                            <TableCell>{formatNumber(item.row_estimate)}</TableCell>
                            <TableCell>{`${((item.size_bytes / data.max_bytes) * 100).toFixed(4)}%`}</TableCell>
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
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </SimpleModal>
  );
}
