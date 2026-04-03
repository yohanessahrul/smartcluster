"use client";

import { TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrandLoadingContent } from "@/components/ui/page-loading-screen";
import { cn } from "@/lib/utils";

type ApiLoadingStateProps = {
  message?: string;
  className?: string;
};

type ApiTableLoadingRowProps = {
  colSpan: number;
  message?: string;
};

type ApiTableLoadingHeadProps = {
  colSpan: number;
  label?: string;
};

const DEFAULT_LOADING_MESSAGE = "Loading...";

export function ApiLoadingState({ message = DEFAULT_LOADING_MESSAGE, className }: ApiLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[120px] items-center justify-center rounded-lg border border-border/60 bg-muted/30 px-4 py-5",
        className
      )}
    >
      <BrandLoadingContent label={message} logoClassName="h-10 w-10" />
    </div>
  );
}

export function ApiTableLoadingRow({ colSpan, message = DEFAULT_LOADING_MESSAGE }: ApiTableLoadingRowProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-6 text-center text-muted-foreground whitespace-normal first:pl-0 last:pr-0">
        <BrandLoadingContent label={message} logoClassName="h-10 w-10" />
      </TableCell>
    </TableRow>
  );
}

export function ApiTableLoadingHead({ colSpan, label = "Loading..." }: ApiTableLoadingHeadProps) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead colSpan={colSpan} className="text-center">
          {label}
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
