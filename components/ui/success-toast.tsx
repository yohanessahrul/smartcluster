"use client";

import { useEffect } from "react";

type SuccessToastProps = {
  message: string;
  onClose: () => void;
  durationMs?: number;
};

export function SuccessToast({ message, onClose, durationMs = 3000 }: SuccessToastProps) {
  useEffect(() => {
    if (!message) return;
    const timeoutId = window.setTimeout(() => {
      onClose();
    }, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [durationMs, message, onClose]);

  if (!message) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[70] w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-emerald-700 bg-emerald-600 p-3 text-white shadow-lg"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-white">Berhasil</p>
      <p className="mt-1 text-sm text-emerald-50">{message}</p>
    </div>
  );
}
