import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type FormErrorAlertProps = {
  message?: string;
  className?: string;
};

export function FormErrorAlert({ message, className }: FormErrorAlertProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive",
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm leading-relaxed">{message}</p>
    </div>
  );
}
