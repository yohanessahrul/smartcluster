"use client";

import { Loader2 } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ApiLoadingStateProps = {
  message?: string;
  className?: string;
};

type ApiTableLoadingRowProps = {
  colSpan: number;
  message?: string;
};

const DEFAULT_LOADING_MESSAGE = "Memuat data dari server...";

export function ApiLoadingState({ message = DEFAULT_LOADING_MESSAGE, className }: ApiLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[92px] items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-5 text-sm text-muted-foreground",
        className
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{message}</span>
    </div>
  );
}

export function ApiTableLoadingRow({ colSpan, message = DEFAULT_LOADING_MESSAGE }: ApiTableLoadingRowProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-6 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{message}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}
