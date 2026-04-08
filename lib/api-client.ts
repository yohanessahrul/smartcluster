import { BillRow, HouseRow, TransactionRow, UserRow } from "@/lib/mock-data";
import { emitDeveloperError } from "@/lib/developer-error";

const API_BASE_URL = "";
const GET_CACHE_TTL_MS = 15_000;

type GenerateBillsPayload = {
  month: string;
  amount: string;
  updateExistingUnpaid?: boolean;
};
type BillCreatePayload = {
  id: string;
} & BillMutationPayload;
type BillMutationPayload = {
  house_id: string;
  periode: string;
  amount: string;
  payment_method: BillRow["payment_method"];
  status: BillRow["status"];
  payment_proof_url?: string | null;
  paid_to_developer: boolean;
  date_paid_period_to_developer: string | null;
};
type TransactionMutationPayload = {
  bill_id: string | null;
  transaction_type: TransactionRow["transaction_type"];
  transaction_name: string;
  category: TransactionRow["category"];
  amount: string;
  date?: string;
  payment_method: TransactionRow["payment_method"];
  status: TransactionRow["status"];
};
type HouseMutationPayload = Omit<HouseRow, "id"> & {
  primary_email?: string;
  secondary_email?: string;
  is_occupied?: boolean;
};

type JsonRecord = Record<string, unknown>;
type MutationOptions = {
  actorEmail?: string;
};

type ApiCacheEntry = {
  expiresAt: number;
  data: unknown;
};

const apiResponseCache = new Map<string, ApiCacheEntry>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();

export type UploadPaymentProofResponse = {
  status: boolean;
  billId: string;
  bucket: string;
  path: string;
  public_url: string;
};

export type AuditLogRow = {
  id: number;
  updated_at: string;
  author: string;
  table_name: string;
  action: string;
  record_id: string | null;
  before_value: JsonRecord | null;
  after_value: JsonRecord | null;
};

export type ServerStatusRow = {
  plan_limit_mb: number;
  max_bytes: number;
  used_bytes: number;
  remaining_bytes: number;
  over_limit: boolean;
  generated_at: string;
  storage_bucket: string;
  storage_max_bytes: number;
  storage_used_bytes: number;
  storage_remaining_bytes: number;
  storage_over_limit: boolean;
  storage_object_count: number;
  table_sizes: Array<{
    table_name: string;
    size_bytes: number;
    row_estimate: number;
  }>;
};

export type OverviewFinanceNeedActionRow = {
  id: string;
  house_id: string;
  unit: string;
  periode: string;
  amount: string;
  status: BillRow["status"];
  status_date: string;
};

export type OverviewFinanceLatestTransactionRow = {
  id: string;
  transaction_name: string;
  transaction_type: TransactionRow["transaction_type"];
  category: TransactionRow["category"];
  amount: string;
  payment_method: TransactionRow["payment_method"];
  status: TransactionRow["status"];
  status_date: string;
};

export type OverviewSnapshotRow = {
  generated_at: string;
  generated_by: string;
  admin?: {
    total_houses: number;
    owner_count: number;
    contract_count: number;
    total_warga: number;
    connected_users: number;
    manager_count: number;
    total_bills: number;
    pending_verification_count: number;
    paid_count: number;
    unpaid_count: number;
  };
  finance?: {
    success_count: number;
    success_total: number;
    need_verification_count: number;
    need_verification_total: number;
    need_follow_up_count: number;
    need_follow_up_total: number;
    total_unit_count: number;
    occupied_unit_count: number;
    need_action_rows: OverviewFinanceNeedActionRow[];
    latest_transactions: OverviewFinanceLatestTransactionRow[];
  };
  warga?: {
    total_lunas: number;
    total_menunggu_verifikasi: number;
    total_belum_bayar: number;
  };
};

function isTransientServerTimeoutMessage(message: string) {
  const lowered = message.toLowerCase();
  return lowered.includes("connection terminated due to connection timeout") || lowered.includes("timeout exceeded when trying to connect");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneValue<T>(value: T): T {
  if (value == null) return value;
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
  } catch {}
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildGetCacheKey(path: string, actorEmail?: string) {
  return `GET:${path}:actor=${(actorEmail ?? "").trim().toLowerCase()}`;
}

function getCachedGetResponse<T>(key: string): T | null {
  const entry = apiResponseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    apiResponseCache.delete(key);
    return null;
  }
  return cloneValue(entry.data as T);
}

function setCachedGetResponse<T>(key: string, value: T) {
  apiResponseCache.set(key, {
    expiresAt: Date.now() + GET_CACHE_TTL_MS,
    data: cloneValue(value),
  });
}

export function clearApiCache() {
  apiResponseCache.clear();
  inFlightGetRequests.clear();
}

async function request<T>(path: string, init?: RequestInit & MutationOptions): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isGetRequest = method === "GET";
  const isNonFormRequest = method === "GET" || method === "HEAD";
  const maxAttempts = isNonFormRequest ? 2 : 1;
  const cacheKey = isGetRequest ? buildGetCacheKey(path, init?.actorEmail) : null;
  let lastError: unknown = null;

  if (cacheKey) {
    const cached = getCachedGetResponse<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const inFlight = inFlightGetRequests.get(cacheKey);
    if (inFlight) {
      return (await inFlight) as T;
    }
  }

  const runRequest = async () => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
          "Content-Type": "application/json",
          ...(init?.actorEmail ? { "x-actor-email": init.actorEmail } : {}),
          ...(init?.headers ?? {}),
        },
        ...init,
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await wait(250);
        continue;
      }
      if (isNonFormRequest) {
        emitDeveloperError({
          title: "Network Request Failed",
          message: error instanceof Error ? error.message : "Fetch failed.",
          detail: `Request: ${method} ${path}`,
          source: "api-client/request",
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      throw error;
    }

    if (response.ok) {
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    }

    const errorBody = (await response.json().catch(() => null)) as JsonRecord | null;
    const baseMessage = typeof errorBody?.message === "string" ? errorBody.message : "API request gagal.";
    const detail = typeof errorBody?.detail === "string" ? errorBody.detail : "";
    const message = detail ? `${baseMessage}: ${detail}` : baseMessage;
    lastError = new Error(message);

    const canRetry =
      isNonFormRequest && attempt < maxAttempts && response.status >= 500 && isTransientServerTimeoutMessage(message);

    if (canRetry) {
      await wait(300);
      continue;
    }

    const shouldEmitDeveloperError = isNonFormRequest && response.status !== 401;
    if (shouldEmitDeveloperError) {
      emitDeveloperError({
        title: "API Request Error",
        message,
        detail: `Request: ${method} ${path}\nHTTP: ${response.status} ${response.statusText}`,
        source: "api-client/request",
      });
    }

      throw new Error(message);
  }

    throw lastError instanceof Error ? lastError : new Error("API request gagal.");
  };

  if (cacheKey) {
    const promise = runRequest();
    inFlightGetRequests.set(cacheKey, promise as Promise<unknown>);
    try {
      const result = await promise;
      setCachedGetResponse(cacheKey, result);
      return result;
    } finally {
      if (inFlightGetRequests.get(cacheKey) === promise) {
        inFlightGetRequests.delete(cacheKey);
      }
    }
  }

  const result = await runRequest();
  clearApiCache();
  return result;
}

async function uploadRequest<T>(path: string, formData: FormData, options?: MutationOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...(options?.actorEmail ? { "x-actor-email": options.actorEmail } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as JsonRecord | null;
    const baseMessage = typeof errorBody?.message === "string" ? errorBody.message : "Upload gagal.";
    const detail = typeof errorBody?.detail === "string" ? errorBody.detail : "";
    const message = detail ? `${baseMessage}: ${detail}` : baseMessage;
    throw new Error(message);
  }

  const payload = (await response.json()) as T;
  clearApiCache();
  return payload;
}

export const apiClient = {
  getOverviewSnapshot: () =>
    request<{ can_refresh: boolean; snapshot: OverviewSnapshotRow }>("/api/overview"),
  refreshOverviewSnapshot: (options?: MutationOptions) =>
    request<{ status: boolean; message: string; snapshot: OverviewSnapshotRow }>("/api/overview/refresh", {
      method: "POST",
      ...options,
    }),

  getUsers: () => request<UserRow[]>("/api/users"),
  createUser: (payload: UserRow, options?: MutationOptions) =>
    request<UserRow>("/api/users", { method: "POST", body: JSON.stringify(payload), ...options }),
  updateUser: (id: string, payload: Omit<UserRow, "id">, options?: MutationOptions) =>
    request<UserRow>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(payload), ...options }),
  deleteUser: (id: string, options?: MutationOptions) =>
    request<{ status: boolean }>(`/api/users/${id}`, { method: "DELETE", ...options }),

  getHouses: () => request<HouseRow[]>("/api/houses"),
  createHouse: (
    payload: HouseRow & { primary_email?: string; secondary_email?: string; is_occupied?: boolean },
    options?: MutationOptions
  ) =>
    request<HouseRow>("/api/houses", { method: "POST", body: JSON.stringify(payload), ...options }),
  updateHouse: (id: string, payload: HouseMutationPayload, options?: MutationOptions) =>
    request<HouseRow>(`/api/houses/${id}`, { method: "PUT", body: JSON.stringify(payload), ...options }),
  deleteHouse: (id: string, options?: MutationOptions) =>
    request<{ status: boolean }>(`/api/houses/${id}`, { method: "DELETE", ...options }),

  getBills: () => request<BillRow[]>("/api/bills"),
  createBill: (payload: BillCreatePayload, options?: MutationOptions) =>
    request<BillRow>("/api/bills", { method: "POST", body: JSON.stringify(payload), ...options }),
  updateBill: (id: string, payload: BillMutationPayload, options?: MutationOptions) =>
    request<BillRow>(`/api/bills/${id}`, { method: "PUT", body: JSON.stringify(payload), ...options }),
  deleteBill: (id: string, options?: MutationOptions) =>
    request<{ status: boolean }>(`/api/bills/${id}`, { method: "DELETE", ...options }),
  generateBills: (payload: GenerateBillsPayload, options?: MutationOptions) =>
    request<{
      periode: string;
      created: number;
      updated: number;
      skipPaid: number;
      skipExisting: number;
      message: string;
    }>("/api/bills/generate", {
      method: "POST",
      body: JSON.stringify(payload),
      ...options,
    }),

  getTransactions: () => request<TransactionRow[]>("/api/transactions"),
  createTransaction: (payload: Omit<TransactionRow, "id" | "status_date"> & { id: string }, options?: MutationOptions) =>
    request<TransactionRow>("/api/transactions", { method: "POST", body: JSON.stringify(payload), ...options }),
  updateTransaction: (id: string, payload: TransactionMutationPayload, options?: MutationOptions) =>
    request<TransactionRow>(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(payload), ...options }),
  deleteTransaction: (id: string, options?: MutationOptions) =>
    request<{ status: boolean }>(`/api/transactions/${id}`, { method: "DELETE", ...options }),

  payBillWithQris: (billId: string, options?: MutationOptions) =>
    request<{ status: boolean; billId: string; newBillStatus: BillRow["status"] }>("/api/warga/pay-qris", {
      method: "POST",
      body: JSON.stringify({ billId }),
      ...options,
    }),
  payBill: (
    payload: { billId: string; payment_method?: BillRow["payment_method"]; payment_proof_url: string },
    options?: MutationOptions
  ) =>
    request<{ status: boolean; billId: string; newBillStatus: BillRow["status"] }>("/api/warga/pay-qris", {
      method: "POST",
      body: JSON.stringify(payload),
      ...options,
    }),
  payBillsBulk: (
    payload: { house_id: string; months_count: 3 | 6 | 12; payment_method?: BillRow["payment_method"]; payment_proof_url: string },
    options?: MutationOptions
  ) =>
    request<{
      status: boolean;
      months_count: number;
      start_periode: string | null;
      total_processed: number;
      processed_bill_ids: string[];
      processed_periods: string[];
      skipped_periods: string[];
    }>(
      "/api/warga/pay-bulk",
      {
        method: "POST",
        body: JSON.stringify(payload),
        ...options,
      }
    ),
  uploadBillPaymentProof: async (billId: string, file: File, options?: MutationOptions) => {
    const formData = new FormData();
    formData.set("billId", billId);
    formData.set("file", file);
    return uploadRequest<UploadPaymentProofResponse>("/api/storage/payment-proof", formData, options);
  },
  getAuditLogs: (tableName: string, limit = 50, recordId?: string) => {
    const params = new URLSearchParams();
    params.set("table", tableName);
    params.set("limit", String(limit));
    if (recordId) params.set("record_id", recordId);
    return request<AuditLogRow[]>(`/api/audit-logs?${params.toString()}`);
  },
  getGlobalAuditLogs: (limit = 200, recordId?: string) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (recordId) params.set("record_id", recordId);
    return request<AuditLogRow[]>(`/api/audit-logs?${params.toString()}`);
  },
  getServerStatus: () => request<ServerStatusRow>("/api/server-status"),
};

export function emitDataChanged() {
  if (typeof window === "undefined") return;
  clearApiCache();
  window.dispatchEvent(new Event("smart-perumahan-data-changed"));
}
