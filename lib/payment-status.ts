export type CanonicalPaymentStatus = "Belum bayar" | "Menunggu Verifikasi" | "Verifikasi" | "Lunas";

export function normalizePaymentStatus(status: string | null | undefined): CanonicalPaymentStatus | null {
  if (!status) return null;
  const lowered = status.trim().toLowerCase();
  if (lowered === "lunas") return "Lunas";
  if (lowered === "pending" || lowered === "menunggu verifikasi" || lowered === "menunggu_verifikasi") {
    return "Menunggu Verifikasi";
  }
  if (lowered === "verifikasi") return "Verifikasi";
  if (lowered === "belum bayar" || lowered === "belum dibayar") return "Belum bayar";
  return null;
}

export function isLunasPaymentStatus(status: string | null | undefined) {
  return normalizePaymentStatus(status) === "Lunas";
}

