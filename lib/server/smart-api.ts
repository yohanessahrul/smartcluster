import { PoolClient, QueryResult, QueryResultRow } from "pg";

import { pool, query } from "@/lib/server/db";
import { deletePaymentProofFromSupabase } from "@/lib/server/supabase";

type JsonRecord = Record<string, unknown>;
type QueryFn = (text: string, params?: unknown[]) => Promise<QueryResult<QueryResultRow>>;

type AuditLogPayload = {
  author: string;
  tableName: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  recordId: string | null;
  beforeValue: JsonRecord | null;
  afterValue: JsonRecord | null;
};

type CreateAutoIplTransactionPayload = {
  actor: string;
  billId: string;
  amount: string;
  billStatus: string;
  paymentMethod?: string | null;
};

type UpsertIplIncomeTransactionPayload = {
  actor: string;
  billId: string;
  amount: string;
  billStatus: string;
  paymentMethod?: string | null;
  createIfMissing?: boolean;
};

type GenerateBillsPayload = {
  month?: unknown;
  amount?: unknown;
  updateExistingUnpaid?: unknown;
};

type UpdateBillPayload = {
  house_id?: unknown;
  periode?: unknown;
  amount?: unknown;
  payment_method?: unknown;
  status?: unknown;
  payment_proof_url?: unknown;
  paid_to_developer?: unknown;
  date_paid_period_to_developer?: unknown;
};

type TransactionPayload = {
  id?: unknown;
  bill_id?: unknown;
  transaction_type?: unknown;
  transaction_name?: unknown;
  category?: unknown;
  amount?: unknown;
  date?: unknown;
  payment_method?: unknown;
  status?: unknown;
};

type HousePayload = {
  id?: unknown;
  blok?: unknown;
  nomor?: unknown;
  status?: unknown;
  residential_status?: unknown;
  is_occupied?: unknown;
  isOccupied?: unknown;
  primary_email?: unknown;
  secondary_email?: unknown;
  email_1?: unknown;
  email_2?: unknown;
  linked_emails?: unknown;
};

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const transactionTypeValues = ["Pemasukan", "Pengeluaran"] as const;
const transactionCategoryValues = ["IPL Warga", "IPL Cluster", "Barang Inventaris", "Other"] as const;
const billStatusValues = ["Lunas", "Belum bayar", "Menunggu Verifikasi", "Verifikasi"] as const;
const transactionStatusValues = ["Lunas", "Belum bayar", "Verifikasi", "Menunggu Verifikasi"] as const;
const residentialStatusValues = ["Owner", "Contract"] as const;
const userRoleValues = ["admin", "superadmin", "warga", "finance"] as const;
const paymentMethodValues = ["Transfer Bank", "Cash", "QRIS", "E-wallet"] as const;

type GlobalApiState = typeof globalThis & {
  smartPerumahanApiReadyPromise?: Promise<void>;
  smartPerumahanApiSchemaVersion?: number;
};

const API_SCHEMA_VERSION = 6;

export class ApiHttpError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "";
}

function getErrorDetail(error: unknown) {
  if (error && typeof error === "object") {
    const err = error as { detail?: unknown; message?: unknown };
    if (typeof err.detail === "string" && err.detail.trim()) return err.detail;
    if (typeof err.message === "string" && err.message.trim()) return err.message;
  }
  return "Unknown error";
}

function throwServerError(error: unknown): never {
  if (error instanceof ApiHttpError) {
    throw error;
  }
  throw new ApiHttpError(500, "Server error", getErrorDetail(error));
}

function normalizeDateTimeInput(value: unknown) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withT = trimmed.includes(" ") ? trimmed.replace(" ", "T") : trimmed;
  const withTimeIfDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(withT) ? `${withT}T12:00:00+07:00` : withT;
  const hasTimezone = withTimeIfDateOnly.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(withTimeIfDateOnly);
  const normalized = !hasTimezone
    ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(withTimeIfDateOnly)
      ? `${withTimeIfDateOnly}:00+07:00`
      : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(withTimeIfDateOnly)
        ? `${withTimeIfDateOnly}+07:00`
        : withTimeIfDateOnly
    : withTimeIfDateOnly;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeTransactionType(value: unknown) {
  const type = asString(value).trim();
  if (transactionTypeValues.includes(type as (typeof transactionTypeValues)[number])) return type;
  return null;
}

function normalizeTransactionCategory(value: unknown, defaultValue = "IPL Warga") {
  const category = asString(value).trim();
  if (!category) return defaultValue;
  if (transactionCategoryValues.includes(category as (typeof transactionCategoryValues)[number])) return category;

  const lowered = category.toLowerCase();
  if (["ipl", "ipl warga", "warga", "pemasukan"].includes(lowered)) return "IPL Warga";
  if (["ipl cluster", "cluster"].includes(lowered)) return "IPL Cluster";
  if (["barang inventaris", "inventaris", "barang"].includes(lowered)) return "Barang Inventaris";
  if (["other", "pengeluaran lainnya", "lainnya", "kas rw", "santunan", "lain lain", "lain-lain"].includes(lowered)) {
    return "Other";
  }
  return null;
}

function defaultTransactionName(category: string, transactionType: string) {
  if (category === "Barang Inventaris") {
    return transactionType === "Pengeluaran" ? "Pembelian Barang Inventaris" : "Pemasukan Barang Inventaris";
  }
  if (category === "Other") {
    return transactionType === "Pengeluaran" ? "Pengeluaran Lainnya" : "Pemasukan Lainnya";
  }
  if (category === "IPL Cluster") {
    return transactionType === "Pengeluaran" ? "Transfer IPL ke Cluster" : "Pemasukan IPL Cluster";
  }
  return "Pembayaran IPL Warga";
}

function normalizeBillId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeIplId(value: unknown) {
  const billId = normalizeBillId(value);
  if (!billId) return null;
  const upper = billId.toUpperCase();
  if (upper.startsWith("BILL")) return `BILL${upper.slice(4)}`;
  if (upper.startsWith("IPL")) return `BILL${upper.slice(3)}`;
  return billId;
}

function normalizeBillStatus(value: unknown) {
  const status = asString(value).trim();
  if (!status) return null;
  if (billStatusValues.includes(status as (typeof billStatusValues)[number])) return status;

  const lowered = status.toLowerCase();
  if (lowered === "belum dibayar" || lowered === "belum bayar") return "Belum bayar";
  if (lowered === "pending" || lowered === "menunggu verifikasi" || lowered === "menunggu_verifikasi") {
    return "Menunggu Verifikasi";
  }
  if (lowered === "verifikasi") return "Verifikasi";
  if (lowered === "lunas") return "Lunas";

  return null;
}

function normalizeTransactionStatus(value: unknown) {
  const status = asString(value).trim();
  if (transactionStatusValues.includes(status as (typeof transactionStatusValues)[number])) return status;
  const lowered = status.toLowerCase();
  if (lowered === "pending" || lowered === "menunggu verifikasi" || lowered === "menunggu_verifikasi") {
    return "Menunggu Verifikasi";
  }
  if (lowered === "belum dibayar" || lowered === "belum bayar") return "Belum bayar";
  if (lowered === "verifikasi") return "Verifikasi";
  if (lowered === "lunas") return "Lunas";
  return null;
}

function normalizePaymentMethod(value: unknown, defaultValue = "Transfer Bank") {
  const method = asString(value).trim();
  if (paymentMethodValues.includes(method as (typeof paymentMethodValues)[number])) return method;
  return defaultValue;
}

function normalizeBoolean(value: unknown, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return defaultValue;
}

function normalizeOptionalDateOnly(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dateTime = normalizeDateTimeInput(trimmed);
  if (!dateTime) return null;
  return dateTime.slice(0, 10);
}

function normalizeOptionalUrl(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeResidentialStatus(value: unknown, defaultValue = "Owner") {
  const status = asString(value).trim();
  if (residentialStatusValues.includes(status as (typeof residentialStatusValues)[number])) return status;
  return defaultValue;
}

function normalizeUserRole(value: unknown, defaultValue = "warga") {
  const role = asString(value).trim().toLowerCase();
  if (userRoleValues.includes(role as (typeof userRoleValues)[number])) return role;
  return defaultValue;
}

function toPeriode(monthValue: string) {
  const [year, month] = String(monthValue).split("-");
  const index = Number(month) - 1;
  return `${monthNames[index]} ${year}`;
}

function mapBillStatusToTransactionStatus(status: string) {
  if (status === "Lunas") return "Lunas";
  if (status === "Verifikasi") return "Verifikasi";
  if (status === "Menunggu Verifikasi") return "Menunggu Verifikasi";
  return "Belum bayar";
}

function validateHouseEmails(linkedEmails: unknown) {
  const emails = (Array.isArray(linkedEmails) ? linkedEmails : [])
    .map((email) => String(email).trim().toLowerCase())
    .filter(Boolean);
  const uniqueEmails = Array.from(new Set(emails));
  if (uniqueEmails.length > 2) return { ok: false as const, message: "linked_emails maksimal 2 email." };
  return { ok: true as const, emails: uniqueEmails };
}

export function getActorFromHeaders(headers: Headers) {
  const actorHeader = headers.get("x-actor-email");
  if (!actorHeader) return "system@smart-perumahan";
  const actor = actorHeader.trim().toLowerCase();
  return actor || "system@smart-perumahan";
}

async function writeAuditLog(queryFn: QueryFn, payload: AuditLogPayload) {
  const { author, tableName, action, recordId, beforeValue, afterValue } = payload;
  await queryFn(
    `
      INSERT INTO audit_logs (author, table_name, action, record_id, before_value, after_value)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
    `,
    [author, tableName, action, recordId, JSON.stringify(beforeValue), JSON.stringify(afterValue)],
  );
}

async function getNextPrefixedId(prefix: string, tableName: string, queryFn: QueryFn = query) {
  const regex = `^${prefix}[0-9]+$`;
  const sql = `
    SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM '[0-9]+$') AS INTEGER)), 0) AS max_id
    FROM ${tableName}
    WHERE id ~ $1
  `;
  const result = await queryFn(sql, [regex]);
  const next = Number(result.rows[0]?.max_id || 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

async function createAutoIplTransaction(queryFn: QueryFn, payload: CreateAutoIplTransactionPayload) {
  const { actor, billId, amount, billStatus, paymentMethod = "Transfer Bank" } = payload;
  const trxId = await getNextPrefixedId("TRX", "transactions", queryFn);
  const trxStatus = mapBillStatusToTransactionStatus(billStatus);
  const result = await queryFn(
    "INSERT INTO transactions (id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date) VALUES ($1,$2,'Pemasukan',$3,'IPL Warga',$4,NOW(),$5,$6,NOW()) RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
    [trxId, billId, "Pembayaran IPL Warga", amount, normalizePaymentMethod(paymentMethod), trxStatus],
  );

  await writeAuditLog(queryFn, {
    author: actor,
    tableName: "transactions",
    action: "CREATE",
    recordId: trxId,
    beforeValue: null,
    afterValue: result.rows[0] as JsonRecord,
  });

  return result.rows[0] as JsonRecord;
}

async function upsertIplIncomeTransaction(queryFn: QueryFn, payload: UpsertIplIncomeTransactionPayload) {
  const { actor, billId, amount, billStatus, paymentMethod = null, createIfMissing = true } = payload;
  const existing = await queryFn(
    "SELECT id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date FROM transactions WHERE bill_id=$1 AND transaction_type='Pemasukan' AND category='IPL Warga' ORDER BY date DESC, id DESC LIMIT 1",
    [billId],
  );

  const trxStatus = mapBillStatusToTransactionStatus(billStatus);

  if (!existing.rowCount) {
    if (!createIfMissing) return null;
    return createAutoIplTransaction(queryFn, { actor, billId, amount, billStatus, paymentMethod });
  }

  const previous = existing.rows[0] as JsonRecord;
  const previousTransactionName = asString(previous.transaction_name) || "Pembayaran IPL Warga";
  const previousPaymentMethod = asString(previous.payment_method);

  const result = await queryFn(
    "UPDATE transactions SET transaction_name=$1, amount=$2, date=NOW(), payment_method=COALESCE($3, payment_method), status=$4, status_date=CASE WHEN status IS DISTINCT FROM $4 THEN NOW() ELSE status_date END WHERE id=$5 RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
    [
      previousTransactionName,
      amount,
      paymentMethod ? normalizePaymentMethod(paymentMethod, previousPaymentMethod) : null,
      trxStatus,
      asString(previous.id),
    ],
  );

  await writeAuditLog(queryFn, {
    author: actor,
    tableName: "transactions",
    action: "UPDATE",
    recordId: asString(previous.id),
    beforeValue: previous,
    afterValue: result.rows[0] as JsonRecord,
  });

  return result.rows[0] as JsonRecord;
}

async function getHouseSnapshot(queryFn: QueryFn, id: string) {
  const result = await queryFn(
    `
      SELECT
        h.id,
        h.blok,
        h.nomor,
        COALESCE(h.residential_status, 'Owner') AS residential_status,
        COALESCE(h.is_occupied, FALSE) AS "isOccupied",
        COALESCE(array_agg(hu.user_email ORDER BY hu.user_order ASC, hu.user_email ASC) FILTER (WHERE hu.user_email IS NOT NULL), '{}') AS linked_emails
      FROM houses h
      LEFT JOIN house_users hu ON hu.house_id = h.id
      WHERE h.id = $1
      GROUP BY h.id, h.blok, h.nomor, h.residential_status, h.is_occupied
    `,
    [id],
  );
  return (result.rows[0] as JsonRecord | undefined) ?? null;
}

async function ensureAuditTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      author TEXT NOT NULL,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL,
      record_id TEXT,
      before_value JSONB,
      after_value JSONB
    )
  `);
}

async function ensureHouseColumns() {
  await query("ALTER TABLE houses ADD COLUMN IF NOT EXISTS residential_status TEXT");
  await query("ALTER TABLE houses ADD COLUMN IF NOT EXISTS is_occupied BOOLEAN");
  await query("UPDATE houses SET residential_status = 'Owner' WHERE residential_status IS NULL");
  await query("UPDATE houses SET is_occupied = FALSE WHERE is_occupied IS NULL");
  await query("ALTER TABLE houses ALTER COLUMN residential_status SET DEFAULT 'Owner'");
  await query("ALTER TABLE houses ALTER COLUMN residential_status SET NOT NULL");
  await query("ALTER TABLE houses ALTER COLUMN is_occupied SET DEFAULT FALSE");
  await query("ALTER TABLE houses ALTER COLUMN is_occupied SET NOT NULL");
  await query("ALTER TABLE houses DROP CONSTRAINT IF EXISTS houses_residential_status_check");
  await query(`
    DO $$
    BEGIN
      ALTER TABLE houses
      ADD CONSTRAINT houses_residential_status_check
      CHECK (residential_status IN ('Owner', 'Contract'));
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
  `);
}

async function ensureHouseUserOrderColumn() {
  await query("ALTER TABLE house_users ADD COLUMN IF NOT EXISTS user_order SMALLINT");
  await query(`
    WITH ranked AS (
      SELECT
        house_id,
        user_email,
        ROW_NUMBER() OVER (PARTITION BY house_id ORDER BY user_email ASC) AS row_num
      FROM house_users
    )
    UPDATE house_users hu
    SET user_order = LEAST(ranked.row_num, 2)
    FROM ranked
    WHERE hu.house_id = ranked.house_id
      AND hu.user_email = ranked.user_email
      AND hu.user_order IS NULL
  `);
  await query("ALTER TABLE house_users ALTER COLUMN user_order SET DEFAULT 1");
  await query("ALTER TABLE house_users ALTER COLUMN user_order SET NOT NULL");
  await query("ALTER TABLE house_users DROP CONSTRAINT IF EXISTS house_users_user_order_check");
  await query(`
    DO $$
    BEGIN
      ALTER TABLE house_users
      ADD CONSTRAINT house_users_user_order_check
      CHECK (user_order IN (1, 2));
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
  `);
  await query("ALTER TABLE house_users DROP CONSTRAINT IF EXISTS house_users_house_id_user_order_key");
  await query(`
    DO $$
    BEGIN
      ALTER TABLE house_users
      ADD CONSTRAINT house_users_house_id_user_order_key
      UNIQUE (house_id, user_order);
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
  `);
}

async function ensureUserRoleConstraint() {
  await query(`
    DO $$
    DECLARE constraint_row RECORD;
    BEGIN
      FOR constraint_row IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'users'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%role%'
      LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', constraint_row.conname);
      END LOOP;
    END $$;
  `);
  await query("UPDATE users SET role = 'warga' WHERE role IS NULL OR BTRIM(role) = ''");
  await query("UPDATE users SET role = 'warga' WHERE role NOT IN ('admin', 'superadmin', 'warga', 'finance')");
  await query("ALTER TABLE users ALTER COLUMN role SET NOT NULL");
  await query(`
    DO $$
    BEGIN
      ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'superadmin', 'warga', 'finance'));
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
  `);
}

async function ensureBillColumns() {
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS status TEXT");
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS status_date TIMESTAMPTZ");
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_to_developer BOOLEAN");
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS date_paid_period_to_developer DATE");
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method TEXT");
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_proof_url TEXT");
  await query(`
    DO $$
    DECLARE column_type TEXT;
    BEGIN
      SELECT data_type
      INTO column_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'status_date';

      IF column_type = 'date' THEN
        ALTER TABLE bills
        ALTER COLUMN status_date TYPE TIMESTAMPTZ
        USING (status_date::timestamp AT TIME ZONE 'Asia/Jakarta');
      ELSIF column_type = 'timestamp without time zone' THEN
        ALTER TABLE bills
        ALTER COLUMN status_date TYPE TIMESTAMPTZ
        USING (status_date AT TIME ZONE 'Asia/Jakarta');
      END IF;
    END $$;
  `);
  await query(`
    DO $$
    DECLARE constraint_row RECORD;
    BEGIN
      FOR constraint_row IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'bills'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE bills DROP CONSTRAINT IF EXISTS %I', constraint_row.conname);
      END LOOP;
    END $$;
  `);
  await query(`
    UPDATE bills
    SET status = CASE
      WHEN status IS NULL OR BTRIM(status) = '' THEN 'Belum bayar'
      WHEN LOWER(BTRIM(status)) IN ('belum dibayar', 'belum bayar') THEN 'Belum bayar'
      WHEN LOWER(BTRIM(status)) IN ('pending', 'menunggu verifikasi', 'menunggu_verifikasi') THEN 'Menunggu Verifikasi'
      WHEN LOWER(BTRIM(status)) = 'verifikasi' THEN 'Verifikasi'
      WHEN LOWER(BTRIM(status)) = 'lunas' THEN 'Lunas'
      ELSE 'Belum bayar'
    END
  `);
  await query("ALTER TABLE bills ALTER COLUMN status SET NOT NULL");
  await query("ALTER TABLE bills ALTER COLUMN status SET DEFAULT 'Belum bayar'");
  await query(`
    DO $$
    BEGIN
      ALTER TABLE bills
      ADD CONSTRAINT bills_status_check
      CHECK (status IN ('Belum bayar', 'Menunggu Verifikasi', 'Verifikasi', 'Lunas'));
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
  `);
  await query("UPDATE bills SET status_date = NOW() WHERE status_date IS NULL");
  await query(`
    UPDATE bills b
    SET status_date = COALESCE(
      (
        SELECT al.updated_at
        FROM audit_logs al
        WHERE al.table_name = 'bills' AND al.record_id = b.id
        ORDER BY al.updated_at DESC
        LIMIT 1
      ),
      b.status_date + INTERVAL '12 hours'
    )
    WHERE date_part('hour', b.status_date) = 0
      AND date_part('minute', b.status_date) = 0
      AND date_part('second', b.status_date) = 0
  `);
  await query("ALTER TABLE bills ALTER COLUMN status_date SET NOT NULL");
  await query("ALTER TABLE bills ALTER COLUMN status_date SET DEFAULT NOW()");
  await query("UPDATE bills SET paid_to_developer = FALSE WHERE paid_to_developer IS NULL");
  await query("ALTER TABLE bills ALTER COLUMN paid_to_developer SET NOT NULL");
  await query("ALTER TABLE bills ALTER COLUMN paid_to_developer SET DEFAULT FALSE");
  await query(
    "UPDATE bills SET payment_method = 'Transfer Bank' WHERE payment_method IS NULL OR BTRIM(payment_method) = '' OR payment_method NOT IN ('Transfer Bank', 'Cash', 'QRIS', 'E-wallet')",
  );
  await query("ALTER TABLE bills ALTER COLUMN payment_method SET NOT NULL");
  await query("ALTER TABLE bills ALTER COLUMN payment_method SET DEFAULT 'Transfer Bank'");
  await query("ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_payment_method_check");
  await query(`
    DO $$
    BEGIN
      ALTER TABLE bills
      ADD CONSTRAINT bills_payment_method_check
      CHECK (payment_method IN ('Transfer Bank', 'Cash', 'QRIS', 'E-wallet'));
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
  `);
}

async function ensureTransactionColumns() {
  await query("ALTER TABLE transactions ALTER COLUMN bill_id DROP NOT NULL");
  await query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT");
  await query("UPDATE transactions SET transaction_type='Pemasukan' WHERE transaction_type IS NULL");
  await query("ALTER TABLE transactions ALTER COLUMN transaction_type SET NOT NULL");
  await query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_name TEXT");
  await query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT");
  await query(
    "UPDATE transactions SET category='IPL Warga' WHERE category IS NULL OR BTRIM(category) = '' OR LOWER(BTRIM(category)) IN ('ipl', 'ipl warga', 'warga', 'pemasukan')",
  );
  await query("UPDATE transactions SET category='IPL Cluster' WHERE LOWER(BTRIM(category)) IN ('ipl cluster', 'cluster')");
  await query(
    "UPDATE transactions SET category='Barang Inventaris' WHERE LOWER(BTRIM(category)) IN ('barang inventaris', 'inventaris', 'barang')",
  );
  await query(
    "UPDATE transactions SET category='Other' WHERE LOWER(BTRIM(category)) IN ('other', 'pengeluaran lainnya', 'lainnya', 'kas rw', 'santunan', 'lain lain', 'lain-lain')",
  );
  await query(
    "UPDATE transactions SET category = CASE WHEN transaction_type='Pengeluaran' THEN 'Other' ELSE 'IPL Warga' END WHERE category NOT IN ('IPL Warga', 'IPL Cluster', 'Barang Inventaris', 'Other')",
  );
  await query("ALTER TABLE transactions ALTER COLUMN category SET NOT NULL");
  await query("ALTER TABLE transactions ALTER COLUMN category SET DEFAULT 'IPL Warga'");
  await query(
    "UPDATE transactions SET transaction_name = CASE WHEN category='IPL Cluster' THEN 'Transfer IPL ke Cluster' WHEN category='Barang Inventaris' THEN 'Pembelian Barang Inventaris' WHEN category='Other' THEN CASE WHEN transaction_type='Pengeluaran' THEN 'Pengeluaran Lainnya' ELSE 'Pemasukan Lainnya' END ELSE 'Pembayaran IPL Warga' END WHERE transaction_name IS NULL OR BTRIM(transaction_name) = ''",
  );
  await query("ALTER TABLE transactions ALTER COLUMN transaction_name SET NOT NULL");
  await query("ALTER TABLE transactions ALTER COLUMN transaction_name SET DEFAULT 'Pembayaran IPL Warga'");
  await query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT");
  await query(`
    DO $$
    DECLARE constraint_row RECORD;
    BEGIN
      FOR constraint_row IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'transactions'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS %I', constraint_row.conname);
      END LOOP;
    END $$;
  `);
  await query("UPDATE transactions SET status='Lunas' WHERE status IS NULL");
  await query("UPDATE transactions SET status='Belum bayar' WHERE LOWER(BTRIM(status)) IN ('belum dibayar', 'belum bayar')");
  await query(
    "UPDATE transactions SET status='Menunggu Verifikasi' WHERE LOWER(BTRIM(status)) IN ('pending', 'menunggu verifikasi', 'menunggu_verifikasi')",
  );
  await query("UPDATE transactions SET status='Verifikasi' WHERE LOWER(BTRIM(status)) = 'verifikasi'");
  await query("UPDATE transactions SET status='Lunas' WHERE LOWER(BTRIM(status)) = 'lunas'");
  await query(
    "UPDATE transactions SET status='Menunggu Verifikasi' WHERE status NOT IN ('Lunas', 'Belum bayar', 'Verifikasi', 'Menunggu Verifikasi')",
  );
  await query("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check");
  await query("ALTER TABLE transactions ALTER COLUMN status SET NOT NULL");
  await query("ALTER TABLE transactions ALTER COLUMN date SET DEFAULT NOW()");
  await query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status_date TIMESTAMPTZ");
  await query(`
    DO $$
    DECLARE column_type TEXT;
    BEGIN
      SELECT data_type
      INTO column_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'date';

      IF column_type = 'date' THEN
        ALTER TABLE transactions
        ALTER COLUMN date TYPE TIMESTAMPTZ
        USING (date::timestamp AT TIME ZONE 'Asia/Jakarta');
      ELSIF column_type = 'timestamp without time zone' THEN
        ALTER TABLE transactions
        ALTER COLUMN date TYPE TIMESTAMPTZ
        USING (date AT TIME ZONE 'Asia/Jakarta');
      END IF;
    END $$;
  `);
  await query(`
    DO $$
    DECLARE column_type TEXT;
    BEGIN
      SELECT data_type
      INTO column_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'status_date';

      IF column_type = 'date' THEN
        ALTER TABLE transactions
        ALTER COLUMN status_date TYPE TIMESTAMPTZ
        USING (status_date::timestamp AT TIME ZONE 'Asia/Jakarta');
      ELSIF column_type = 'timestamp without time zone' THEN
        ALTER TABLE transactions
        ALTER COLUMN status_date TYPE TIMESTAMPTZ
        USING (status_date AT TIME ZONE 'Asia/Jakarta');
      END IF;
    END $$;
  `);
  await query("UPDATE transactions SET date = NOW() WHERE date IS NULL");
  await query("UPDATE transactions SET status_date = NOW() WHERE status_date IS NULL");
  await query(`
    UPDATE transactions t
    SET date = COALESCE(
      (
        SELECT al.updated_at
        FROM audit_logs al
        WHERE al.table_name = 'transactions' AND al.record_id = t.id
        ORDER BY al.updated_at ASC
        LIMIT 1
      ),
      t.date + INTERVAL '12 hours'
    )
    WHERE date_part('hour', t.date) = 0
      AND date_part('minute', t.date) = 0
      AND date_part('second', t.date) = 0
  `);
  await query(`
    UPDATE transactions t
    SET status_date = COALESCE(
      (
        SELECT al.updated_at
        FROM audit_logs al
        WHERE al.table_name = 'transactions' AND al.record_id = t.id
        ORDER BY al.updated_at DESC
        LIMIT 1
      ),
      t.status_date + INTERVAL '12 hours'
    )
    WHERE date_part('hour', t.status_date) = 0
      AND date_part('minute', t.status_date) = 0
      AND date_part('second', t.status_date) = 0
  `);
  await query("ALTER TABLE transactions ALTER COLUMN date SET NOT NULL");
  await query("ALTER TABLE transactions ALTER COLUMN date SET DEFAULT NOW()");
  await query("ALTER TABLE transactions ALTER COLUMN status_date SET NOT NULL");
  await query("ALTER TABLE transactions ALTER COLUMN status_date SET DEFAULT NOW()");
  await query(`
    DO $$
    DECLARE constraint_row RECORD;
    BEGIN
      FOR constraint_row IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'transactions'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS %I', constraint_row.conname);
      END LOOP;
    END $$;
  `);
  await query("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_check");
  await query(`
    DO $$
    BEGIN
      ALTER TABLE transactions
      ADD CONSTRAINT transactions_category_check
      CHECK (category IN ('IPL Warga', 'IPL Cluster', 'Barang Inventaris', 'Other'));
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      ALTER TABLE transactions
      ADD CONSTRAINT transactions_transaction_type_check
      CHECK (transaction_type IN ('Pemasukan', 'Pengeluaran'));
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      ALTER TABLE transactions
      ADD CONSTRAINT transactions_status_check
      CHECK (status IN ('Lunas', 'Belum bayar', 'Verifikasi', 'Menunggu Verifikasi'));
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
  `);
}

async function ensurePerformanceIndexes() {
  await query("CREATE INDEX IF NOT EXISTS idx_bills_periode ON bills (periode)");
  await query("CREATE INDEX IF NOT EXISTS idx_bills_status_periode ON bills (status, periode)");
  await query("CREATE INDEX IF NOT EXISTS idx_transactions_bill_lookup ON transactions (bill_id, transaction_type, category, date DESC, id DESC)");
  await query("CREATE INDEX IF NOT EXISTS idx_transactions_status_date ON transactions (status, date DESC, id DESC)");
  await query("CREATE INDEX IF NOT EXISTS idx_audit_logs_updated_desc ON audit_logs (updated_at DESC, id DESC)");
  await query(
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record_updated_desc ON audit_logs (table_name, record_id, updated_at DESC, id DESC)",
  );
}

async function beginTransaction(client: PoolClient) {
  await client.query("BEGIN");
}

async function commitTransaction(client: PoolClient) {
  await client.query("COMMIT");
}

async function rollbackTransaction(client: PoolClient) {
  await client.query("ROLLBACK");
}

export async function ensureBackendReady() {
  const globalState = globalThis as GlobalApiState;
  const hasCurrentVersion =
    globalState.smartPerumahanApiReadyPromise && globalState.smartPerumahanApiSchemaVersion === API_SCHEMA_VERSION;

  if (!hasCurrentVersion) {
    globalState.smartPerumahanApiReadyPromise = (async () => {
      await ensureAuditTable();
      await ensureUserRoleConstraint();
      await ensureHouseColumns();
      await ensureHouseUserOrderColumn();
      await ensureBillColumns();
      await ensureTransactionColumns();
      await ensurePerformanceIndexes();
      globalState.smartPerumahanApiSchemaVersion = API_SCHEMA_VERSION;
    })().catch((error) => {
      globalState.smartPerumahanApiReadyPromise = undefined;
      globalState.smartPerumahanApiSchemaVersion = undefined;
      throw error;
    });
  }
  return globalState.smartPerumahanApiReadyPromise;
}

export function getHealthStatus() {
  return { status: "ok", service: "smart-perumahan-api" };
}

export async function listAuditLogs(params: { table?: string | null; recordId?: string | null; limit?: number }) {
  try {
    const tableName = params.table ?? null;
    const recordId = params.recordId ?? null;
    const limitRaw = Number(params.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const whereParts: string[] = [];
    const sqlParams: unknown[] = [];

    if (tableName) {
      whereParts.push(`table_name = $${sqlParams.length + 1}`);
      sqlParams.push(tableName);
    }
    if (recordId) {
      whereParts.push(`record_id = $${sqlParams.length + 1}`);
      sqlParams.push(recordId);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const sql = `
      SELECT id, updated_at, author, table_name, action, record_id, before_value, after_value
      FROM audit_logs
      ${whereClause}
      ORDER BY updated_at DESC, id DESC
      LIMIT $${sqlParams.length + 1}
    `;
    sqlParams.push(limit);

    const result = await query(sql, sqlParams);
    return result.rows;
  } catch (error) {
    throwServerError(error);
  }
}

export async function listUsers() {
  try {
    const result = await query("SELECT id, name, email, phone, role FROM users ORDER BY id ASC");
    return result.rows;
  } catch (error) {
    throwServerError(error);
  }
}

export async function createUser(payload: JsonRecord, actor: string) {
  try {
    const role = normalizeUserRole(payload.role, "");
    if (!role) {
      throw new ApiHttpError(400, "Role tidak valid. Gunakan admin, superadmin, warga, atau finance.");
    }
    await ensureUserRoleConstraint();

    const result = await query(
      "INSERT INTO users (id, name, email, phone, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, phone, role",
      [
        payload.id,
        payload.name,
        asString(payload.email).toLowerCase(),
        payload.phone,
        role,
      ],
    );

    await writeAuditLog(query, {
      author: actor,
      tableName: "users",
      action: "CREATE",
      recordId: asString(result.rows[0]?.id),
      beforeValue: null,
      afterValue: (result.rows[0] as JsonRecord) ?? null,
    });

    return result.rows[0];
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "23505") {
      throw new ApiHttpError(409, "ID atau email sudah digunakan.");
    }
    if (code === "23514") {
      throw new ApiHttpError(400, "Role tidak valid. Gunakan admin, superadmin, warga, atau finance.");
    }
    throwServerError(error);
  }
}

export async function updateUser(id: string, payload: JsonRecord, actor: string) {
  try {
    const role = normalizeUserRole(payload.role, "");
    if (!role) {
      throw new ApiHttpError(400, "Role tidak valid. Gunakan admin, superadmin, warga, atau finance.");
    }
    await ensureUserRoleConstraint();

    const before = await query("SELECT id, name, email, phone, role FROM users WHERE id=$1", [id]);
    if (!before.rows.length) throw new ApiHttpError(404, "User tidak ditemukan.");

    const result = await query(
      "UPDATE users SET name=$1, email=$2, phone=$3, role=$4 WHERE id=$5 RETURNING id, name, email, phone, role",
      [payload.name, asString(payload.email).toLowerCase(), payload.phone, role, id],
    );

    await writeAuditLog(query, {
      author: actor,
      tableName: "users",
      action: "UPDATE",
      recordId: id,
      beforeValue: before.rows[0] as JsonRecord,
      afterValue: result.rows[0] as JsonRecord,
    });

    return result.rows[0];
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "23505") throw new ApiHttpError(409, "Email sudah digunakan user lain.");
    if (code === "23514") throw new ApiHttpError(400, "Role tidak valid. Gunakan admin, superadmin, warga, atau finance.");
    throwServerError(error);
  }
}

export async function deleteUser(id: string, actor: string) {
  try {
    const result = await query("DELETE FROM users WHERE id=$1 RETURNING id, name, email, phone, role", [id]);
    if (!result.rows.length) throw new ApiHttpError(404, "User tidak ditemukan.");

    await writeAuditLog(query, {
      author: actor,
      tableName: "users",
      action: "DELETE",
      recordId: id,
      beforeValue: result.rows[0] as JsonRecord,
      afterValue: null,
    });

    return { status: true };
  } catch (error) {
    throwServerError(error);
  }
}

export async function listHouses() {
  try {
    const result = await query(`
      SELECT
        h.id,
        h.blok,
        h.nomor,
        COALESCE(h.residential_status, 'Owner') AS residential_status,
        COALESCE(h.is_occupied, FALSE) AS "isOccupied",
        COALESCE(array_agg(hu.user_email ORDER BY hu.user_order ASC, hu.user_email ASC) FILTER (WHERE hu.user_email IS NOT NULL), '{}') AS linked_emails
      FROM houses h
      LEFT JOIN house_users hu ON hu.house_id = h.id
      GROUP BY h.id, h.blok, h.nomor, h.residential_status, h.is_occupied
      ORDER BY h.id ASC
    `);
    return result.rows;
  } catch (error) {
    throwServerError(error);
  }
}

export async function createHouse(payload: HousePayload, actor: string) {
  const transaction = await pool.connect();
  try {
    const linkedEmailsInput = Array.isArray(payload.linked_emails)
      ? payload.linked_emails
      : [payload.primary_email ?? payload.email_1, payload.secondary_email ?? payload.email_2];
    const validation = validateHouseEmails(linkedEmailsInput);
    if (!validation.ok) throw new ApiHttpError(400, validation.message);

    const residentialStatus = normalizeResidentialStatus(payload.residential_status ?? payload.status);
    const isOccupied = normalizeBoolean(payload.isOccupied ?? payload.is_occupied, false);

    await beginTransaction(transaction);

    const usersFound = await transaction.query("SELECT email FROM users WHERE email = ANY($1::text[])", [validation.emails]);
    if (usersFound.rowCount !== validation.emails.length) {
      await rollbackTransaction(transaction);
      throw new ApiHttpError(400, "Ada email house yang belum terdaftar di users.");
    }

    await transaction.query(
      "INSERT INTO houses (id, blok, nomor, residential_status, is_occupied) VALUES ($1,$2,$3,$4,$5)",
      [payload.id, payload.blok, payload.nomor, residentialStatus, isOccupied],
    );

    for (const [index, email] of validation.emails.entries()) {
      await transaction.query("INSERT INTO house_users (house_id, user_email, user_order) VALUES ($1,$2,$3)", [
        payload.id,
        email,
        index + 1,
      ]);
    }

    const afterSnapshot = await getHouseSnapshot((text, params) => transaction.query(text, params), asString(payload.id));

    await writeAuditLog((text, params) => transaction.query(text, params), {
      author: actor,
      tableName: "houses",
      action: "CREATE",
      recordId: asString(payload.id),
      beforeValue: null,
      afterValue: afterSnapshot,
    });

    await commitTransaction(transaction);
    return afterSnapshot;
  } catch (error) {
    await rollbackTransaction(transaction).catch(() => null);
    if (getErrorCode(error) === "23505") {
      throw new ApiHttpError(409, "ID house sudah digunakan.");
    }
    throwServerError(error);
  } finally {
    transaction.release();
  }
}

export async function updateHouse(id: string, payload: HousePayload, actor: string) {
  const transaction = await pool.connect();
  try {
    const linkedEmailsInput = Array.isArray(payload.linked_emails)
      ? payload.linked_emails
      : [payload.primary_email ?? payload.email_1, payload.secondary_email ?? payload.email_2];
    const validation = validateHouseEmails(linkedEmailsInput);
    if (!validation.ok) throw new ApiHttpError(400, validation.message);

    const residentialStatus = normalizeResidentialStatus(payload.residential_status ?? payload.status);
    const isOccupied = normalizeBoolean(payload.isOccupied ?? payload.is_occupied, false);

    await beginTransaction(transaction);

    const beforeSnapshot = await getHouseSnapshot((text, params) => transaction.query(text, params), id);
    if (!beforeSnapshot) {
      await rollbackTransaction(transaction);
      throw new ApiHttpError(404, "House tidak ditemukan.");
    }

    const usersFound = await transaction.query("SELECT email FROM users WHERE email = ANY($1::text[])", [validation.emails]);
    if (usersFound.rowCount !== validation.emails.length) {
      await rollbackTransaction(transaction);
      throw new ApiHttpError(400, "Ada email house yang belum terdaftar di users.");
    }

    await transaction.query("UPDATE houses SET blok=$1, nomor=$2, residential_status=$3, is_occupied=$4 WHERE id=$5", [
      payload.blok,
      payload.nomor,
      residentialStatus,
      isOccupied,
      id,
    ]);
    await transaction.query("DELETE FROM house_users WHERE house_id=$1", [id]);
    for (const [index, email] of validation.emails.entries()) {
      await transaction.query("INSERT INTO house_users (house_id, user_email, user_order) VALUES ($1,$2,$3)", [
        id,
        email,
        index + 1,
      ]);
    }

    const afterSnapshot = await getHouseSnapshot((text, params) => transaction.query(text, params), id);
    await writeAuditLog((text, params) => transaction.query(text, params), {
      author: actor,
      tableName: "houses",
      action: "UPDATE",
      recordId: id,
      beforeValue: beforeSnapshot,
      afterValue: afterSnapshot,
    });

    await commitTransaction(transaction);
    return afterSnapshot;
  } catch (error) {
    await rollbackTransaction(transaction).catch(() => null);
    throwServerError(error);
  } finally {
    transaction.release();
  }
}

export async function deleteHouse(id: string, actor: string) {
  const transaction = await pool.connect();
  try {
    await beginTransaction(transaction);

    const beforeSnapshot = await getHouseSnapshot((text, params) => transaction.query(text, params), id);
    if (!beforeSnapshot) {
      await rollbackTransaction(transaction);
      throw new ApiHttpError(404, "House tidak ditemukan.");
    }

    await transaction.query("DELETE FROM houses WHERE id=$1", [id]);
    await writeAuditLog((text, params) => transaction.query(text, params), {
      author: actor,
      tableName: "houses",
      action: "DELETE",
      recordId: id,
      beforeValue: beforeSnapshot,
      afterValue: null,
    });

    await commitTransaction(transaction);
    return { status: true };
  } catch (error) {
    await rollbackTransaction(transaction).catch(() => null);
    throwServerError(error);
  } finally {
    transaction.release();
  }
}

export async function listBills() {
  try {
    const result = await query(
      "SELECT id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer FROM bills ORDER BY id DESC",
    );
    return result.rows;
  } catch (error) {
    throwServerError(error);
  }
}

export async function createBill(payload: JsonRecord, actor: string) {
  const transaction = await pool.connect();
  let paymentProofToDeleteAfterCommit: string | null = null;
  try {
    const status = normalizeBillStatus(payload.status) ?? "Belum bayar";
    const paymentMethod = normalizePaymentMethod(payload.payment_method, "Transfer Bank");
    const resolvedPaymentProofUrl = normalizeOptionalUrl(payload.payment_proof_url);
    const paymentProofUrl = status === "Lunas" ? null : resolvedPaymentProofUrl;
    if (status === "Lunas" && resolvedPaymentProofUrl) {
      paymentProofToDeleteAfterCommit = resolvedPaymentProofUrl;
    }
    const paidToDeveloper = normalizeBoolean(payload.paid_to_developer, false);
    const datePaidPeriodToDeveloper = paidToDeveloper
      ? normalizeOptionalDateOnly(payload.date_paid_period_to_developer)
      : null;

    await beginTransaction(transaction);
    const result = await transaction.query(
      "INSERT INTO bills (id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9) RETURNING id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer",
      [
        payload.id,
        payload.house_id,
        payload.periode,
        payload.amount,
        paymentMethod,
        status,
        paymentProofUrl,
        paidToDeveloper,
        datePaidPeriodToDeveloper,
      ],
    );

    await writeAuditLog((text, params) => transaction.query(text, params), {
      author: actor,
      tableName: "bills",
      action: "CREATE",
      recordId: asString(result.rows[0]?.id),
      beforeValue: null,
      afterValue: (result.rows[0] as JsonRecord) ?? null,
    });

    await commitTransaction(transaction);

    if (paymentProofToDeleteAfterCommit) {
      try {
        await deletePaymentProofFromSupabase(paymentProofToDeleteAfterCommit);
      } catch (error) {
        console.error("[bills] gagal hapus bukti pembayaran saat create IPL Lunas:", error);
      }
    }

    return result.rows[0];
  } catch (error) {
    await rollbackTransaction(transaction).catch(() => null);
    if (getErrorCode(error) === "23505") {
      throw new ApiHttpError(409, "ID IPL atau kombinasi house+periode sudah digunakan.");
    }
    throwServerError(error);
  } finally {
    transaction.release();
  }
}

export async function updateBill(id: string, payload: UpdateBillPayload, actor: string) {
  const transaction = await pool.connect();
  let paymentProofToDeleteAfterCommit: string | null = null;
  try {
    const status = normalizeBillStatus(payload.status) ?? "Belum bayar";
    await beginTransaction(transaction);

    const before = await transaction.query(
      "SELECT id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer FROM bills WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!before.rows.length) {
      await rollbackTransaction(transaction);
      throw new ApiHttpError(404, "IPL tidak ditemukan.");
    }

    const previous = before.rows[0] as JsonRecord;
    const paidToDeveloper = normalizeBoolean(payload.paid_to_developer, Boolean(previous.paid_to_developer));
    const paymentMethod = normalizePaymentMethod(payload.payment_method, asString(previous.payment_method) || "Transfer Bank");
    const resolvedPaymentProofUrl = payload.payment_proof_url === undefined
      ? normalizeOptionalUrl(previous.payment_proof_url)
      : normalizeOptionalUrl(payload.payment_proof_url);
    const paymentProofUrl = status === "Lunas" ? null : resolvedPaymentProofUrl;
    if (status === "Lunas" && resolvedPaymentProofUrl) {
      paymentProofToDeleteAfterCommit = resolvedPaymentProofUrl;
    }
    const datePaidPeriodToDeveloper = !paidToDeveloper
      ? null
      : payload.date_paid_period_to_developer === undefined
        ? previous.date_paid_period_to_developer
        : normalizeOptionalDateOnly(payload.date_paid_period_to_developer);

    const result = await transaction.query(
      "UPDATE bills SET house_id=$1, periode=$2, amount=$3, payment_method=$4, status=$5, status_date=CASE WHEN status IS DISTINCT FROM $5 THEN NOW() ELSE status_date END, payment_proof_url=$6, paid_to_developer=$7, date_paid_period_to_developer=$8 WHERE id=$9 RETURNING id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer",
      [
        payload.house_id,
        payload.periode,
        payload.amount,
        paymentMethod,
        status,
        paymentProofUrl,
        paidToDeveloper,
        datePaidPeriodToDeveloper,
        id,
      ],
    );

    await writeAuditLog((text, params) => transaction.query(text, params), {
      author: actor,
      tableName: "bills",
      action: "UPDATE",
      recordId: id,
      beforeValue: previous,
      afterValue: result.rows[0] as JsonRecord,
    });

    await upsertIplIncomeTransaction((text, params) => transaction.query(text, params), {
      actor,
      billId: id,
      amount: asString(payload.amount),
      billStatus: status,
      paymentMethod,
      createIfMissing: false,
    });

    await commitTransaction(transaction);

    if (paymentProofToDeleteAfterCommit) {
      try {
        await deletePaymentProofFromSupabase(paymentProofToDeleteAfterCommit);
      } catch (error) {
        console.error("[bills] gagal hapus bukti pembayaran saat status Lunas:", error);
      }
    }

    return result.rows[0];
  } catch (error) {
    await rollbackTransaction(transaction).catch(() => null);
    if (getErrorCode(error) === "23505") {
      throw new ApiHttpError(409, "Kombinasi house+periode sudah digunakan.");
    }
    throwServerError(error);
  } finally {
    transaction.release();
  }
}

export async function deleteBill(id: string, actor: string) {
  try {
    const result = await query(
      "DELETE FROM bills WHERE id=$1 RETURNING id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer",
      [id],
    );
    if (!result.rows.length) throw new ApiHttpError(404, "IPL tidak ditemukan.");

    await writeAuditLog(query, {
      author: actor,
      tableName: "bills",
      action: "DELETE",
      recordId: id,
      beforeValue: result.rows[0] as JsonRecord,
      afterValue: null,
    });

    return { status: true };
  } catch (error) {
    throwServerError(error);
  }
}

export async function generateBills(payload: GenerateBillsPayload, actor: string) {
  const transaction = await pool.connect();
  try {
    const month = asString(payload.month);
    const amount = asString(payload.amount);
    const updateExistingUnpaid = normalizeBoolean(payload.updateExistingUnpaid, false);
    if (!month || !amount) throw new ApiHttpError(400, "month dan amount wajib diisi.");

    const periode = toPeriode(month);
    await beginTransaction(transaction);

    const houses = await transaction.query("SELECT id FROM houses ORDER BY id ASC");
    await transaction.query(
      "UPDATE bills SET payment_method='Transfer Bank' WHERE periode=$1 AND (payment_method IS NULL OR BTRIM(payment_method) = '' OR payment_method NOT IN ('Transfer Bank', 'Cash', 'QRIS', 'E-wallet'))",
      [periode],
    );
    const existingBills = await transaction.query(
      "SELECT id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer FROM bills WHERE periode=$1",
      [periode],
    );
    const billByHouse = new Map(existingBills.rows.map((row) => [asString(row.house_id), row]));

    let created = 0;
    let updated = 0;
    let skipPaid = 0;
    let skipExisting = 0;

    const nextBillId = await getNextPrefixedId("BILL", "bills", (text, params) => transaction.query(text, params));
    let nextNumber = Number(nextBillId.replace("BILL", ""));

    for (const house of houses.rows) {
      const houseId = asString(house.id);
      const existing = billByHouse.get(houseId);
      if (existing) {
        if (asString(existing.status) === "Lunas") {
          skipPaid += 1;
          continue;
        }

        if (updateExistingUnpaid) {
          const beforeValue = { ...existing } as JsonRecord;
          const updatedResult = await transaction.query(
            "UPDATE bills SET amount=$1 WHERE id=$2 RETURNING id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer",
            [amount, existing.id],
          );
          await writeAuditLog((text, params) => transaction.query(text, params), {
            author: actor,
            tableName: "bills",
            action: "UPDATE",
            recordId: asString(existing.id),
            beforeValue,
            afterValue: updatedResult.rows[0] as JsonRecord,
          });
          updated += 1;
        } else {
          skipExisting += 1;
        }
        continue;
      }

      const billId = `BILL${String(nextNumber).padStart(3, "0")}`;
      const inserted = await transaction.query(
        "INSERT INTO bills (id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9) RETURNING id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer",
        [billId, houseId, periode, amount, "Transfer Bank", "Belum bayar", null, false, null],
      );
      await writeAuditLog((text, params) => transaction.query(text, params), {
        author: actor,
        tableName: "bills",
        action: "CREATE",
        recordId: billId,
        beforeValue: null,
        afterValue: inserted.rows[0] as JsonRecord,
      });
      nextNumber += 1;
      created += 1;
    }

    await commitTransaction(transaction);
    return {
      periode,
      created,
      updated,
      skipPaid,
      skipExisting,
      message: `Generate ${periode} selesai.`,
    };
  } catch (error) {
    await rollbackTransaction(transaction).catch(() => null);
    throwServerError(error);
  } finally {
    transaction.release();
  }
}

export async function listTransactions() {
  try {
    const result = await query(
      "SELECT id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date FROM transactions ORDER BY id DESC",
    );
    return result.rows;
  } catch (error) {
    throwServerError(error);
  }
}

export async function createTransaction(payload: TransactionPayload, actor: string) {
  try {
    const billId = normalizeIplId(payload.bill_id);
    const transactionType = normalizeTransactionType(payload.transaction_type) || "Pemasukan";
    const defaultCategory = transactionType === "Pengeluaran" ? "Other" : "IPL Warga";
    const category = normalizeTransactionCategory(payload.category, defaultCategory);
    const transactionName =
      typeof payload.transaction_name === "string" && payload.transaction_name.trim()
        ? payload.transaction_name.trim()
        : defaultTransactionName(category || defaultCategory, transactionType);
    const status = normalizeTransactionStatus(payload.status) || "Lunas";
    const transactionDate = normalizeDateTimeInput(payload.date);
    const paymentMethod = asString(payload.payment_method);

    if (!payload.id || !payload.amount || !payload.date || !paymentMethod || !transactionName) {
      throw new ApiHttpError(400, "id, transaction_name, amount, date, dan payment_method wajib diisi.");
    }
    if (!transactionDate) {
      throw new ApiHttpError(400, "Format date tidak valid. Gunakan format datetime yang benar.");
    }
    if (!category) {
      throw new ApiHttpError(400, "category tidak valid. Pilih IPL Warga, IPL Cluster, Barang Inventaris, atau Other.");
    }

    if (billId) {
      const billExists = await query("SELECT 1 FROM bills WHERE id=$1 LIMIT 1", [billId]);
      if (!billExists.rowCount) {
        throw new ApiHttpError(400, "ipl_id tidak valid. Pilih IPL yang tersedia atau kosongkan untuk non-IPL.");
      }
    }

    const result = await query(
      "INSERT INTO transactions (id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
      [payload.id, billId, transactionType, transactionName, category, payload.amount, transactionDate, paymentMethod, status],
    );

    await writeAuditLog(query, {
      author: actor,
      tableName: "transactions",
      action: "CREATE",
      recordId: asString(result.rows[0]?.id),
      beforeValue: null,
      afterValue: (result.rows[0] as JsonRecord) ?? null,
    });

    return result.rows[0];
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "23505") throw new ApiHttpError(409, "ID transaction sudah digunakan.");
    if (code === "23514") {
      throw new ApiHttpError(400, "Nilai transaction_type, category, payment_method, atau status tidak valid.");
    }
    if (code === "23502") throw new ApiHttpError(400, "Data transaction belum lengkap. Cek kembali form.");
    if (code === "23503") {
      throw new ApiHttpError(400, "ipl_id tidak valid. Gunakan ID IPL yang tersedia atau kosongkan untuk non-IPL.");
    }
    throwServerError(error);
  }
}

export async function updateTransaction(id: string, payload: TransactionPayload, actor: string) {
  try {
    const billId = normalizeIplId(payload.bill_id);
    const transactionType = normalizeTransactionType(payload.transaction_type) || "Pemasukan";
    const defaultCategory = transactionType === "Pengeluaran" ? "Other" : "IPL Warga";
    const category = normalizeTransactionCategory(payload.category, defaultCategory);
    const status = normalizeTransactionStatus(payload.status) || "Lunas";
    const transactionDate = normalizeDateTimeInput(payload.date);
    const paymentMethod = asString(payload.payment_method);
    const transactionName =
      typeof payload.transaction_name === "string" && payload.transaction_name.trim()
        ? payload.transaction_name.trim()
        : defaultTransactionName(category || defaultCategory, transactionType);

    if (!payload.amount || !payload.date || !paymentMethod || !transactionName) {
      throw new ApiHttpError(400, "transaction_name, amount, date, dan payment_method wajib diisi.");
    }
    if (!transactionDate) {
      throw new ApiHttpError(400, "Format date tidak valid. Gunakan format datetime yang benar.");
    }
    if (!category) {
      throw new ApiHttpError(400, "category tidak valid. Pilih IPL Warga, IPL Cluster, Barang Inventaris, atau Other.");
    }

    if (billId) {
      const billExists = await query("SELECT 1 FROM bills WHERE id=$1 LIMIT 1", [billId]);
      if (!billExists.rowCount) {
        throw new ApiHttpError(400, "ipl_id tidak valid. Pilih IPL yang tersedia atau kosongkan untuk non-IPL.");
      }
    }

    const before = await query(
      "SELECT id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date FROM transactions WHERE id=$1",
      [id],
    );
    if (!before.rows.length) throw new ApiHttpError(404, "Transaction tidak ditemukan.");
    const previous = before.rows[0] as JsonRecord;

    const result = await query(
      "UPDATE transactions SET bill_id=$1, transaction_type=$2, transaction_name=$3, category=$4, amount=$5, date=$6, payment_method=$7, status=$8, status_date=CASE WHEN status IS DISTINCT FROM $8 THEN NOW() ELSE status_date END WHERE id=$9 RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
      [billId, transactionType, transactionName, category, payload.amount, transactionDate, paymentMethod, status, id],
    );

    await writeAuditLog(query, {
      author: actor,
      tableName: "transactions",
      action: "UPDATE",
      recordId: id,
      beforeValue: previous,
      afterValue: result.rows[0] as JsonRecord,
    });

    return result.rows[0];
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "23514") {
      throw new ApiHttpError(400, "Nilai transaction_type, category, payment_method, atau status tidak valid.");
    }
    if (code === "23502") throw new ApiHttpError(400, "Data transaction belum lengkap. Cek kembali form.");
    if (code === "23503") {
      throw new ApiHttpError(400, "ipl_id tidak valid. Gunakan ID IPL yang tersedia atau kosongkan untuk non-IPL.");
    }
    throwServerError(error);
  }
}

export async function deleteTransaction(id: string, actor: string) {
  try {
    const result = await query(
      "DELETE FROM transactions WHERE id=$1 RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
      [id],
    );
    if (!result.rows.length) throw new ApiHttpError(404, "Transaction tidak ditemukan.");

    await writeAuditLog(query, {
      author: actor,
      tableName: "transactions",
      action: "DELETE",
      recordId: id,
      beforeValue: result.rows[0] as JsonRecord,
      afterValue: null,
    });

    return { status: true };
  } catch (error) {
    throwServerError(error);
  }
}

export async function payBillWithQris(
  payload: { billId?: unknown; payment_method?: unknown; payment_proof_url?: unknown },
  actor: string,
) {
  const transaction = await pool.connect();
  try {
    const billId = asString(payload.billId);
    if (!billId) throw new ApiHttpError(400, "billId wajib diisi.");
    const paymentMethod = normalizePaymentMethod(payload.payment_method, "Transfer Bank");
    const paymentProofUrl = normalizeOptionalUrl(payload.payment_proof_url);
    if (!paymentProofUrl) throw new ApiHttpError(400, "Bukti transaksi wajib diupload.");

    await beginTransaction(transaction);
    const billResult = await transaction.query(
      "SELECT id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer FROM bills WHERE id=$1 FOR UPDATE",
      [billId],
    );
    const bill = billResult.rows[0] as JsonRecord | undefined;
    if (!bill) {
      await rollbackTransaction(transaction);
      throw new ApiHttpError(404, "IPL tidak ditemukan.");
    }

    let latestBill = bill;
    const currentStatus = asString(bill.status);
    if (currentStatus === "Lunas") {
      await rollbackTransaction(transaction);
      throw new ApiHttpError(400, "IPL sudah lunas.");
    }

    if (
      currentStatus === "Belum bayar" ||
      currentStatus === "Pending" ||
      currentStatus === "Menunggu Verifikasi" ||
      currentStatus === "Verifikasi"
    ) {
      const updatedBill = await transaction.query(
        "UPDATE bills SET status=$1, status_date=NOW(), payment_method=$2, payment_proof_url=$3 WHERE id=$4 RETURNING id, house_id, periode, amount, payment_method, status, status_date, payment_proof_url, paid_to_developer, date_paid_period_to_developer",
        ["Menunggu Verifikasi", paymentMethod, paymentProofUrl, billId],
      );
      latestBill = (updatedBill.rows[0] as JsonRecord) ?? bill;
      await writeAuditLog((text, params) => transaction.query(text, params), {
        author: actor,
        tableName: "bills",
        action: "UPDATE",
        recordId: billId,
        beforeValue: bill,
        afterValue: latestBill,
      });
    }

    const upsertedTransaction = await upsertIplIncomeTransaction((text, params) => transaction.query(text, params), {
      actor,
      billId,
      amount: asString(latestBill.amount),
      billStatus: asString(latestBill.status),
      paymentMethod: asString(latestBill.payment_method),
    });

    await commitTransaction(transaction);
    return {
      status: true,
      billId,
      newBillStatus: asString(latestBill.status),
      transaction: upsertedTransaction,
    };
  } catch (error) {
    await rollbackTransaction(transaction).catch(() => null);
    throwServerError(error);
  } finally {
    transaction.release();
  }
}
