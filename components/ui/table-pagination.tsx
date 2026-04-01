"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

export const TABLE_PAGE_SIZE_OPTIONS = [5, 10, 50, 100, 150, 200] as const;
type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

function normalizePageSize(value: number): TablePageSize {
  const parsed = Number(value);
  if (TABLE_PAGE_SIZE_OPTIONS.includes(parsed as TablePageSize)) return parsed as TablePageSize;
  return 10;
}

export function useTablePagination<T>(rows: T[], initialPageSize: TablePageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<TablePageSize>(initialPageSize);

  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  function setPageSize(next: number) {
    setPageSizeState(normalizePageSize(next));
    setPage(1);
  }

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    from,
    to,
    pagedRows,
    setPage,
    setPageSize,
  };
}

type TablePaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  from: number;
  to: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextSize: number) => void;
};

export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  from,
  to,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  return (
    <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>
        Menampilkan {from}-{to} dari {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          aria-label="Rows per page"
        >
          {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={String(size)}>
              {size} / page
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Prev
        </Button>
        <span className="min-w-[88px] text-center">
          Hal {page} / {totalPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
