export function parseRupiahToNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const numeric = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatRupiah(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? "-" : "";
  const absolute = Math.abs(safe);
  return `${sign}Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(absolute)}`;
}

export function formatRupiahFromAny(value: string | number | null | undefined): string {
  return formatRupiah(parseRupiahToNumber(value));
}
