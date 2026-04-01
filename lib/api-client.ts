import { BillRow, HouseRow, TransactionRow, UserRow } from "@/lib/mock-data";

const API_BASE_URL = "";

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
  status_date?: string;
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
  date: string;
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

async function request<T>(path: string, init?: RequestInit & MutationOptions): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.actorEmail ? { "x-actor-email": init.actorEmail } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as JsonRecord | null;
    const baseMessage = typeof errorBody?.message === "string" ? errorBody.message : "API request gagal.";
    const detail = typeof errorBody?.detail === "string" ? errorBody.detail : "";
    const message = detail ? `${baseMessage}: ${detail}` : baseMessage;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
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

  return (await response.json()) as T;
}

export const apiClient = {
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
};

export function emitDataChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("smart-perumahan-data-changed"));
}
