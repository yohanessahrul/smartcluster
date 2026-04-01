"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DEV_ERROR_EVENT_NAME, DeveloperErrorPayload, emitDeveloperError, normalizeUnknownError } from "@/lib/developer-error";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DeveloperErrorModal() {
  const [currentError, setCurrentError] = useState<DeveloperErrorPayload | null>(null);

  useEffect(() => {
    function onCustomEvent(event: Event) {
      const customEvent = event as CustomEvent<DeveloperErrorPayload>;
      if (!customEvent.detail) return;
      setCurrentError(customEvent.detail);
    }

    function onWindowError(event: ErrorEvent) {
      setCurrentError(
        normalizeUnknownError(event.error ?? event.message, "Runtime Error", event.filename || "window.onerror")
      );
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      setCurrentError(normalizeUnknownError(event.reason, "Unhandled Promise Rejection", "unhandledrejection"));
    }

    window.addEventListener(DEV_ERROR_EVENT_NAME, onCustomEvent as EventListener);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener(DEV_ERROR_EVENT_NAME, onCustomEvent as EventListener);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  const errorText = useMemo(() => {
    if (!currentError) return "";
    return [
      `Title: ${currentError.title}`,
      `Message: ${currentError.message}`,
      currentError.detail ? `Detail: ${currentError.detail}` : "",
      currentError.source ? `Source: ${currentError.source}` : "",
      `Timestamp: ${currentError.timestamp}`,
      currentError.stack ? `Stack:\n${currentError.stack}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [currentError]);

  if (!currentError) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-rose-950/30 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden border border-rose-300 bg-rose-50 shadow-xl">
        <div className="flex items-center justify-between border-b border-rose-200 bg-rose-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-700" />
            <p className="font-semibold text-rose-800">Developer Error Viewer</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-md px-2 text-rose-700 hover:bg-rose-200"
            onClick={() => setCurrentError(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-md border border-rose-200 bg-white px-3 py-2">
            <p className="text-xs text-rose-700">Error Type</p>
            <p className="text-sm font-medium text-rose-900">{currentError.title}</p>
          </div>
          <div className="rounded-md border border-rose-200 bg-white px-3 py-2">
            <p className="text-xs text-rose-700">Message</p>
            <p className="text-sm text-rose-900">{currentError.message}</p>
          </div>
          {currentError.detail ? (
            <div className="rounded-md border border-rose-200 bg-white px-3 py-2">
              <p className="text-xs text-rose-700">Detail</p>
              <p className="whitespace-pre-wrap text-sm text-rose-900">{currentError.detail}</p>
            </div>
          ) : null}
          <div className="rounded-md border border-rose-200 bg-white px-3 py-2">
            <p className="text-xs text-rose-700">Captured At</p>
            <p className="text-sm text-rose-900">{formatDateTime(currentError.timestamp)}</p>
          </div>
          {currentError.stack ? (
            <div className="rounded-md border border-rose-200 bg-white px-3 py-2">
              <p className="text-xs text-rose-700">Stack Trace</p>
              <pre className="max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-rose-950">
                {currentError.stack}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rose-200 bg-rose-100 px-4 py-3">
          <p className="flex items-center gap-1 text-xs text-rose-700">
            <Bug className="h-3.5 w-3.5" />
            Modal ini hanya untuk membantu debugging error non-form submit.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-rose-300 bg-white text-rose-800 hover:bg-rose-100"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(errorText);
                } catch (error) {
                  emitDeveloperError(normalizeUnknownError(error, "Clipboard Error", "developer-error-modal"));
                }
              }}
            >
              Copy Detail
            </Button>
            <Button type="button" className="bg-rose-700 text-white hover:bg-rose-800" onClick={() => setCurrentError(null)}>
              Tutup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
