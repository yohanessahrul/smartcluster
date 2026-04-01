"use client";

import { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SimpleModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
};

export function SimpleModal({ open, onClose, title, children, className }: SimpleModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 px-3 py-4 sm:px-4 sm:py-8">
      <div
        className={cn("w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-background shadow-soft max-h-[92vh]", className)}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-heading text-lg">{title}</h3>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
        <div className="max-h-[calc(92vh-78px)] overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
