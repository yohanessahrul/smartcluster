export const DEV_ERROR_EVENT_NAME = "smart-perumahan:developer-error";

export type DeveloperErrorPayload = {
  title: string;
  message: string;
  detail?: string;
  source?: string;
  stack?: string;
  timestamp: string;
};

function toMessage(value: unknown, fallback = "Unknown error") {
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Error && value.message.trim()) return value.message;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string" && value.message.trim()) {
    return value.message;
  }
  return fallback;
}

function toStack(value: unknown) {
  if (value instanceof Error && typeof value.stack === "string" && value.stack.trim()) return value.stack;
  return undefined;
}

export function emitDeveloperError(payload: Omit<DeveloperErrorPayload, "timestamp">) {
  if (typeof window === "undefined") return;
  const completePayload: DeveloperErrorPayload = {
    ...payload,
    timestamp: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent<DeveloperErrorPayload>(DEV_ERROR_EVENT_NAME, { detail: completePayload }));
}

export function normalizeUnknownError(error: unknown, title = "Unhandled Error", source = "runtime"): DeveloperErrorPayload {
  return {
    title,
    message: toMessage(error),
    detail: typeof error === "string" ? error : undefined,
    source,
    stack: toStack(error),
    timestamp: new Date().toISOString(),
  };
}
