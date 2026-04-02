const machineFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

const humanDateFormatter = new Intl.DateTimeFormat("id-ID", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Jakarta",
});

const humanDateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function normalizeDateTimeString(value: string) {
  let normalized = value.includes("T") ? value : value.replace(" ", "T");

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T00:00:00+07:00`;
  }

  // PostgreSQL sering kirim timezone offset dalam format +00 / +07.
  // Samakan ke +00:00 / +07:00 agar parser Date konsisten.
  normalized = normalized.replace(/([+-]\d{2})$/, "$1:00");
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");

  // Jika fractional second terlalu panjang (mis. microseconds), rapikan ke millisecond.
  normalized = normalized.replace(/\.(\d{3})\d+(?=(Z|[+-]\d{2}:\d{2})$)/, ".$1");
  normalized = normalized.replace(/\.(\d{3})\d+$/, ".$1");

  const hasTimezone = normalized.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(normalized);
  if (!hasTimezone && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(normalized)) {
    const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized) ? `${normalized}:00` : normalized;
    return `${withSeconds}+07:00`;
  }

  return normalized;
}

function parseDateTime(value: string) {
  const normalized = normalizeDateTimeString(value);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDateTimeUnified(value: string | Date | null | undefined) {
  if (!value) return "-";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-";
    const parts = humanDateTimeFormatter.formatToParts(value);
    return `${getPart(parts, "day")} ${getPart(parts, "month")} ${getPart(parts, "year")}, ${getPart(parts, "hour")}:${getPart(parts, "minute")}`;
  }

  const raw = value.trim();
  if (!raw) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsedDateOnly = parseDateTime(raw);
    if (!parsedDateOnly) return raw;
    const parts = humanDateFormatter.formatToParts(parsedDateOnly);
    return `${getPart(parts, "day")} ${getPart(parts, "month")} ${getPart(parts, "year")}`;
  }

  const parsed = parseDateTime(raw);
  if (!parsed) return raw;

  const parts = humanDateTimeFormatter.formatToParts(parsed);
  return `${getPart(parts, "day")} ${getPart(parts, "month")} ${getPart(parts, "year")}, ${getPart(parts, "hour")}:${getPart(parts, "minute")}`;
}

export function getTodayIsoDateLocal() {
  const now = new Date();
  const parts = machineFormatter.formatToParts(now);
  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}`;
}

export function getNowDateTimeLocalInput() {
  const now = new Date();
  const parts = machineFormatter.formatToParts(now);
  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}T${getPart(parts, "hour")}:${getPart(parts, "minute")}`;
}

export function toDateTimeLocalInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value).trim();
  if (!raw) return "";
  const normalized = normalizeDateTimeString(raw);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = machineFormatter.formatToParts(parsed);
  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}T${getPart(parts, "hour")}:${getPart(parts, "minute")}`;
}

export function toIsoFromDateTimeLocal(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = normalizeDateTimeString(trimmed);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
