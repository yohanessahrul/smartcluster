"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiTableLoadingRow } from "@/components/ui/api-loading-state";
import { Button } from "@/components/ui/button";
import { DateTimeText } from "@/components/ui/date-time-text";
import { SimpleModal } from "@/components/ui/simple-modal";
import { TablePagination, useTablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuditLogRow } from "@/lib/api-client";

type ChangeHistoryTableProps = {
  title: string;
  rows: AuditLogRow[];
  loading: boolean;
};

function asPrettyJson(value: unknown) {
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value, null, 2);
}

export function ChangeHistoryTable({ title, rows, loading }: ChangeHistoryTableProps) {
  const pagination = useTablePagination(rows);
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal Update</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <ApiTableLoadingRow colSpan={4} message="Memuat history perubahan..." />
              ) : rows.length ? (
                pagination.pagedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="align-top text-sm">
                      <DateTimeText value={row.updated_at} />
                    </TableCell>
                    <TableCell className="align-top text-sm">{row.author}</TableCell>
                    <TableCell className="align-top text-sm">
                      {row.table_name}
                      <p className="text-xs text-muted-foreground">{row.action}</p>
                    </TableCell>
                    <TableCell className="align-top">
                      <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setSelectedRow(row)}>
                        Lihat Diff
                      </Button>
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

      <SimpleModal
        open={Boolean(selectedRow)}
        onClose={() => setSelectedRow(null)}
        title="Lihat Diff"
        className="w-[96vw] max-w-6xl"
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Tanggal Update:</span> <DateTimeText value={selectedRow?.updated_at} />
            </p>
            <p>
              <span className="text-muted-foreground">Author:</span> {selectedRow?.author ?? "-"}
            </p>
            <p>
              <span className="text-muted-foreground">Table:</span> {selectedRow?.table_name ?? "-"} ({selectedRow?.action ?? "-"})
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-medium">Data Sebelum</p>
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all text-xs">{asPrettyJson(selectedRow?.before_value)}</pre>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-medium">Data Sesudah</p>
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all text-xs">{asPrettyJson(selectedRow?.after_value)}</pre>
            </div>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
