const formatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function parseDateTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatDateTimeUnified(value: string | Date | null | undefined) {
  if (!value) return "-";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-";
    const parts = formatter.formatToParts(value);
    return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")} ${getPart(parts, "hour")}:${getPart(parts, "minute")}`;
  }

  const raw = value.trim();
  if (!raw) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const directDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (directDateTime && !raw.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(raw)) {
    return `${directDateTime[1]} ${directDateTime[2]}`;
  }

  const parsed = parseDateTime(raw);
  if (!parsed) return raw;

  const parts = formatter.formatToParts(parsed);
  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")} ${getPart(parts, "hour")}:${getPart(parts, "minute")}`;
}

export function getTodayIsoDateLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNowDateTimeLocalInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function toDateTimeLocalInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value).trim();
  if (!raw) return "";
  const normalized = raw.includes(" ") ? raw.replace(" ", "T") : raw;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function toIsoFromDateTimeLocal(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
