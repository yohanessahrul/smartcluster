import { formatDateTimeUnified } from "@/lib/date-time";
import { cn } from "@/lib/utils";

type DateTimeTextProps = {
  value: string | Date | null | undefined;
  fallback?: string;
  className?: string;
};

export function DateTimeText({ value, fallback = "-", className }: DateTimeTextProps) {
  const formatted = formatDateTimeUnified(value);
  return <span className={cn(className)}>{formatted === "-" ? fallback : formatted}</span>;
}
