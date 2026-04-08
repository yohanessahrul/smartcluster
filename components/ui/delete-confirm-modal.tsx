"use client";

import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";

type DeleteConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
};

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Konfirmasi Delete",
  description = "Data akan dihapus permanen. Lanjutkan?",
  confirmLabel = "Delete",
  cancelLabel = "Batal",
  loading = false,
}: DeleteConfirmModalProps) {
  return (
    <SimpleModal open={open} onClose={onClose} title={title} className="max-w-md" closeDisabled={loading}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Menghapus..." : confirmLabel}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
