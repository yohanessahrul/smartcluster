"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination, useTablePagination } from "@/components/ui/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuditLogRow } from "@/lib/api-client";
import { formatDateTimeUnified } from "@/lib/date-time";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal Update</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Sebelum</TableHead>
              <TableHead>Sesudah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Memuat history...
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              pagination.pagedRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top text-sm">
                    {formatDateTimeUnified(row.updated_at)}
                  </TableCell>
                  <TableCell className="align-top text-sm">{row.author}</TableCell>
                  <TableCell className="align-top text-sm">
                    {row.table_name}
                    <p className="text-xs text-muted-foreground">{row.action}</p>
                  </TableCell>
                  <TableCell className="align-top">
                    <pre className="max-w-[300px] whitespace-pre-wrap break-all text-xs">{asPrettyJson(row.before_value)}</pre>
                  </TableCell>
                  <TableCell className="align-top">
                    <pre className="max-w-[300px] whitespace-pre-wrap break-all text-xs">{asPrettyJson(row.after_value)}</pre>
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
  );
}
