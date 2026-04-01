type ReportColumn<T> = {
  header: string;
  value: (row: T, index: number) => string | number | boolean | null | undefined;
};

type DownloadCsvOptions<T> = {
  filenamePrefix: string;
  columns: ReportColumn<T>[];
  rows: T[];
};

function normalizeCellValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  return String(value);
}

function escapeCsv(value: string) {
  const sanitized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${sanitized.replaceAll('"', '""')}"`;
}

function safeFilenamePrefix(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildTimestamp() {
  return new Date().toISOString().slice(0, 19).replace("T", "-").replaceAll(":", "-");
}

export function downloadRowsAsCsv<T>({ filenamePrefix, columns, rows }: DownloadCsvOptions<T>) {
  if (typeof window === "undefined") return;

  const headerRow = columns.map((column) => escapeCsv(normalizeCellValue(column.header))).join(",");
  const dataRows = rows.map((row, rowIndex) =>
    columns.map((column) => escapeCsv(normalizeCellValue(column.value(row, rowIndex)))).join(","),
  );
  const csv = [headerRow, ...dataRows].join("\r\n");

  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilenamePrefix(filenamePrefix)}-${buildTimestamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Backward-compatible export so existing callsites don't need to change.
export const downloadRowsAsExcel = downloadRowsAsCsv;
