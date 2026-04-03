const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const { pool, query } = require("./db");

const app = express();
const PORT = Number(process.env.API_PORT || 4000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

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
const transactionTypeValues = ["Pemasukan", "Pengeluaran"];
const transactionCategoryValues = ["IPL Warga", "IPL Cluster", "Barang Inventaris", "Other"];
const billStatusValues = ["Lunas", "Belum Dibayar", "Verifikasi"];
const transactionStatusValues = ["Lunas", "Verifikasi", "Pending"];
const residentialStatusValues = ["Owner", "Contract"];
const userRoleValues = ["admin", "superadmin", "warga", "finance"];
const paymentMethodValues = ["Transfer Bank", "Cash", "QRIS", "E-wallet"];

function nowDateTime() {
  return new Date().toISOString();
}

function normalizeDateTimeInput(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withTimeIfDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T12:00:00+07:00`
    : trimmed;

  const normalized = withTimeIfDateOnly.includes(" ")
    ? withTimeIfDateOnly.replace(" ", "T")
    : withTimeIfDateOnly;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeTransactionType(value) {
  const type = typeof value === "string" ? value.trim() : "";
  if (transactionTypeValues.includes(type)) return type;
  return null;
}

function normalizeTransactionCategory(value, defaultValue = "IPL Warga") {
  const category = typeof value === "string" ? value.trim() : "";
  if (!category) return defaultValue;
  if (transactionCategoryValues.includes(category)) return category;

  const lowered = category.toLowerCase();
  if (["ipl", "ipl warga", "warga", "pemasukan"].includes(lowered)) return "IPL Warga";
  if (["ipl cluster", "cluster"].includes(lowered)) {
    return "IPL Cluster";
  }
  if (["barang inventaris", "inventaris", "barang"].includes(lowered)) return "Barang Inventaris";
  if (["other", "pengeluaran lainnya", "lainnya", "kas rw", "santunan", "lain lain", "lain-lain"].includes(lowered)) {
    return "Other";
  }
  return null;
}

function defaultTransactionName(category, transactionType) {
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

function normalizeBillId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeIplId(value) {
  const billId = normalizeBillId(value);
  if (!billId) return null;

  const upper = billId.toUpperCase();
  if (upper.startsWith("BILL")) {
    return `BILL${upper.slice(4)}`;
  }
  if (upper.startsWith("IPL")) {
    return `BILL${upper.slice(3)}`;
  }
  return billId;
}

function normalizeBillStatus(value) {
  const status = typeof value === "string" ? value.trim() : "";
  if (billStatusValues.includes(status)) return status;
  return null;
}

function normalizeTransactionStatus(value) {
  const status = typeof value === "string" ? value.trim() : "";
  if (transactionStatusValues.includes(status)) return status;
  return null;
}

function normalizePaymentMethod(value, defaultValue = "Transfer Bank") {
  const method = typeof value === "string" ? value.trim() : "";
  if (paymentMethodValues.includes(method)) return method;
  return defaultValue;
}

function normalizeBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return defaultValue;
}

function normalizeOptionalDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dateTime = normalizeDateTimeInput(trimmed);
  if (!dateTime) return null;
  return dateTime.slice(0, 10);
}

function normalizeResidentialStatus(value, defaultValue = "Owner") {
  const status = typeof value === "string" ? value.trim() : "";
  if (residentialStatusValues.includes(status)) return status;
  return defaultValue;
}

function normalizeUserRole(value, defaultValue = "warga") {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (userRoleValues.includes(role)) return role;
  return defaultValue;
}

function mapBillRowDates(row) {
  return row;
}

function mapTransactionRowDates(row) {
  return row;
}

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());

function toPeriode(monthValue) {
  const [year, month] = String(monthValue).split("-");
  const index = Number(month) - 1;
  return `${monthNames[index]} ${year}`;
}

function getActor(req) {
  const actorHeader = req.headers["x-actor-email"];
  if (typeof actorHeader !== "string") return "system@smart-perumahan";
  const actor = actorHeader.trim().toLowerCase();
  return actor || "system@smart-perumahan";
}

async function getNextPrefixedId(prefix, tableName, queryFn = query) {
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

function mapBillStatusToTransactionStatus(status) {
  if (status === "Lunas") return "Lunas";
  if (status === "Verifikasi") return "Verifikasi";
  return "Pending";
}

async function createAutoIplTransaction(queryFn, payload) {
  const { actor, billId, amount, billStatus, paymentMethod = "Transfer Bank" } = payload;
  const trxId = await getNextPrefixedId("TRX", "transactions", queryFn);
  const now = nowDateTime();
  const trxStatus = mapBillStatusToTransactionStatus(billStatus);
  const result = await queryFn(
    "INSERT INTO transactions (id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date) VALUES ($1,$2,'Pemasukan',$3,'IPL Warga',$4,$5,$6,$7,$5) RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
    [trxId, billId, "Pembayaran IPL Warga", amount, now, normalizePaymentMethod(paymentMethod), trxStatus]
  );

  await writeAuditLog(queryFn, {
    author: actor,
    tableName: "transactions",
    action: "CREATE",
    recordId: trxId,
    beforeValue: null,
    afterValue: result.rows[0],
  });

  return result.rows[0];
}

async function upsertIplIncomeTransaction(queryFn, payload) {
  const { actor, billId, amount, billStatus, paymentMethod = null } = payload;
  const existing = await queryFn(
    "SELECT id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date FROM transactions WHERE bill_id=$1 AND transaction_type='Pemasukan' AND category='IPL Warga' ORDER BY date DESC, id DESC LIMIT 1",
    [billId]
  );

  const trxStatus = mapBillStatusToTransactionStatus(billStatus);
  const now = nowDateTime();

  if (!existing.rowCount) {
    return createAutoIplTransaction(queryFn, { actor, billId, amount, billStatus, paymentMethod });
  }

  const previous = existing.rows[0];
  const nextStatusDate = previous.status === trxStatus ? previous.status_date : now;
  const result = await queryFn(
    "UPDATE transactions SET transaction_name=$1, amount=$2, date=$3, payment_method=COALESCE($4, payment_method), status=$5, status_date=$6 WHERE id=$7 RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
    [
      previous.transaction_name || "Pembayaran IPL Warga",
      amount,
      now,
      paymentMethod ? normalizePaymentMethod(paymentMethod, previous.payment_method) : null,
      trxStatus,
      nextStatusDate,
      previous.id,
    ]
  );

  await writeAuditLog(queryFn, {
    author: actor,
    tableName: "transactions",
    action: "UPDATE",
    recordId: previous.id,
    beforeValue: previous,
    afterValue: result.rows[0],
  });

  return result.rows[0];
}

function validateHouseEmails(linkedEmails) {
  const emails = (Array.isArray(linkedEmails) ? linkedEmails : [])
    .map((email) => String(email).trim().toLowerCase())
    .filter(Boolean);
  const uniqueEmails = Array.from(new Set(emails));
  if (uniqueEmails.length > 2) return { ok: false, message: "linked_emails maksimal 2 email." };
  return { ok: true, emails: uniqueEmails };
}

function handleError(res, error) {
  const detail = error.detail || error.message || "Unknown error";
  return res.status(500).json({ message: "Server error", detail });
}

async function writeAuditLog(queryFn, payload) {
  const { author, tableName, action, recordId, beforeValue, afterValue } = payload;
  await queryFn(
    `
      INSERT INTO audit_logs (author, table_name, action, record_id, before_value, after_value)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
    `,
    [author, tableName, action, recordId, JSON.stringify(beforeValue), JSON.stringify(afterValue)]
  );
}

async function getHouseSnapshot(queryFn, id) {
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
    [id]
  );
  return result.rows[0] ?? null;
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
  await query(
    "ALTER TABLE houses ADD CONSTRAINT houses_residential_status_check CHECK (residential_status IN ('Owner', 'Contract'))"
  );
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
  await query("ALTER TABLE house_users ADD CONSTRAINT house_users_user_order_check CHECK (user_order IN (1, 2))");
  await query("ALTER TABLE house_users DROP CONSTRAINT IF EXISTS house_users_house_id_user_order_key");
  await query("ALTER TABLE house_users ADD CONSTRAINT house_users_house_id_user_order_key UNIQUE (house_id, user_order)");
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
  await query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'superadmin', 'warga', 'finance'))");
}

async function ensureBillColumns() {
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS status_date TIMESTAMPTZ");
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_to_developer BOOLEAN");
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS date_paid_period_to_developer DATE");
  await query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method TEXT");
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
    "UPDATE bills SET payment_method = 'Transfer Bank' WHERE payment_method IS NULL OR BTRIM(payment_method) = '' OR payment_method NOT IN ('Transfer Bank', 'Cash', 'QRIS', 'E-wallet')"
  );
  await query("ALTER TABLE bills ALTER COLUMN payment_method SET NOT NULL");
  await query("ALTER TABLE bills ALTER COLUMN payment_method SET DEFAULT 'Transfer Bank'");
  await query("ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_payment_method_check");
  await query(
    "ALTER TABLE bills ADD CONSTRAINT bills_payment_method_check CHECK (payment_method IN ('Transfer Bank', 'Cash', 'QRIS', 'E-wallet'))"
  );
}

async function ensureTransactionColumns() {
  await query("ALTER TABLE transactions ALTER COLUMN bill_id DROP NOT NULL");
  await query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT");
  await query("UPDATE transactions SET transaction_type='Pemasukan' WHERE transaction_type IS NULL");
  await query("ALTER TABLE transactions ALTER COLUMN transaction_type SET NOT NULL");
  await query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_name TEXT");
  await query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT");
  await query(
    "UPDATE transactions SET category='IPL Warga' WHERE category IS NULL OR BTRIM(category) = '' OR LOWER(BTRIM(category)) IN ('ipl', 'ipl warga', 'warga', 'pemasukan')"
  );
  await query(
    "UPDATE transactions SET category='IPL Cluster' WHERE LOWER(BTRIM(category)) IN ('ipl cluster', 'cluster')"
  );
  await query(
    "UPDATE transactions SET category='Barang Inventaris' WHERE LOWER(BTRIM(category)) IN ('barang inventaris', 'inventaris', 'barang')"
  );
  await query(
    "UPDATE transactions SET category='Other' WHERE LOWER(BTRIM(category)) IN ('other', 'pengeluaran lainnya', 'lainnya', 'kas rw', 'santunan', 'lain lain', 'lain-lain')"
  );
  await query(
    "UPDATE transactions SET category = CASE WHEN transaction_type='Pengeluaran' THEN 'Other' ELSE 'IPL Warga' END WHERE category NOT IN ('IPL Warga', 'IPL Cluster', 'Barang Inventaris', 'Other')"
  );
  await query("ALTER TABLE transactions ALTER COLUMN category SET NOT NULL");
  await query("ALTER TABLE transactions ALTER COLUMN category SET DEFAULT 'IPL Warga'");
  await query(
    "UPDATE transactions SET transaction_name = CASE WHEN category='IPL Cluster' THEN 'Transfer IPL ke Cluster' WHEN category='Barang Inventaris' THEN 'Pembelian Barang Inventaris' WHEN category='Other' THEN CASE WHEN transaction_type='Pengeluaran' THEN 'Pengeluaran Lainnya' ELSE 'Pemasukan Lainnya' END ELSE 'Pembayaran IPL Warga' END WHERE transaction_name IS NULL OR BTRIM(transaction_name) = ''"
  );
  await query("ALTER TABLE transactions ALTER COLUMN transaction_name SET NOT NULL");
  await query("ALTER TABLE transactions ALTER COLUMN transaction_name SET DEFAULT 'Pembayaran IPL Warga'");
  await query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT");
  await query("UPDATE transactions SET status='Lunas' WHERE status IS NULL");
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
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_category_check'
      ) THEN
        ALTER TABLE transactions
        DROP CONSTRAINT transactions_category_check;
      END IF;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_category_check'
      ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_category_check
        CHECK (category IN ('IPL Warga', 'IPL Cluster', 'Barang Inventaris', 'Other'));
      END IF;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_transaction_type_check'
      ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_transaction_type_check
        CHECK (transaction_type IN ('Pemasukan', 'Pengeluaran'));
      END IF;
    END $$;
  `);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_status_check'
      ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_status_check
        CHECK (status IN ('Lunas', 'Verifikasi', 'Pending'));
      END IF;
    END $$;
  `);
}

app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "smart-perumahan-api" });
});

app.get("/api/audit-logs", async (req, res) => {
  try {
    const tableName = typeof req.query.table === "string" ? req.query.table : null;
    const recordId = typeof req.query.record_id === "string" ? req.query.record_id.trim() : null;
    const limitRaw = Number(req.query.limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const whereParts = [];
    const params = [];

    if (tableName) {
      whereParts.push(`table_name = $${params.length + 1}`);
      params.push(tableName);
    }
    if (recordId) {
      whereParts.push(`record_id = $${params.length + 1}`);
      params.push(recordId);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const sql = `
      SELECT id, updated_at, author, table_name, action, record_id, before_value, after_value
      FROM audit_logs
      ${whereClause}
      ORDER BY updated_at DESC, id DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/users", async (_, res) => {
  try {
    const result = await query("SELECT id, name, email, phone, role FROM users ORDER BY id ASC");
    res.json(result.rows);
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const actor = getActor(req);
    const { id, name, email, phone, role: rawRole } = req.body;
    const role = normalizeUserRole(rawRole, "");
    if (!role) {
      return res.status(400).json({ message: "Role tidak valid. Gunakan admin, superadmin, warga, atau finance." });
    }
    await ensureUserRoleConstraint();
    const result = await query(
      "INSERT INTO users (id, name, email, phone, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, phone, role",
      [id, name, String(email).toLowerCase(), phone, role]
    );

    await writeAuditLog(query, {
      author: actor,
      tableName: "users",
      action: "CREATE",
      recordId: result.rows[0].id,
      beforeValue: null,
      afterValue: result.rows[0],
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "ID atau email sudah digunakan." });
    }
    if (error.code === "23514") {
      return res.status(400).json({ message: "Role tidak valid. Gunakan admin, superadmin, warga, atau finance." });
    }
    handleError(res, error);
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const actor = getActor(req);
    const { id } = req.params;
    const { name, email, phone, role: rawRole } = req.body;
    const role = normalizeUserRole(rawRole, "");
    if (!role) {
      return res.status(400).json({ message: "Role tidak valid. Gunakan admin, superadmin, warga, atau finance." });
    }
    await ensureUserRoleConstraint();
    const before = await query("SELECT id, name, email, phone, role FROM users WHERE id=$1", [id]);
    if (!before.rows.length) return res.status(404).json({ message: "User tidak ditemukan." });

    const result = await query(
      "UPDATE users SET name=$1, email=$2, phone=$3, role=$4 WHERE id=$5 RETURNING id, name, email, phone, role",
      [name, String(email).toLowerCase(), phone, role, id]
    );

    await writeAuditLog(query, {
      author: actor,
      tableName: "users",
      action: "UPDATE",
      recordId: id,
      beforeValue: before.rows[0],
      afterValue: result.rows[0],
    });

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email sudah digunakan user lain." });
    }
    if (error.code === "23514") {
      return res.status(400).json({ message: "Role tidak valid. Gunakan admin, superadmin, warga, atau finance." });
    }
    handleError(res, error);
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const actor = getActor(req);
    const result = await query("DELETE FROM users WHERE id=$1 RETURNING id, name, email, phone, role", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: "User tidak ditemukan." });

    await writeAuditLog(query, {
      author: actor,
      tableName: "users",
      action: "DELETE",
      recordId: req.params.id,
      beforeValue: result.rows[0],
      afterValue: null,
    });

    res.json({ status: true });
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/api/houses", async (_, res) => {
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
    res.json(result.rows);
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/houses", async (req, res) => {
  const transaction = await pool.connect();
  try {
    const actor = getActor(req);
    const {
      id,
      blok,
      nomor,
      status: statusRaw,
      residential_status: residentialStatusRaw,
      is_occupied: isOccupiedSnakeRaw,
      isOccupied: isOccupiedRaw,
      primary_email: primaryEmailRaw,
      secondary_email: secondaryEmailRaw,
      email_1: email1Raw,
      email_2: email2Raw,
      linked_emails: linkedEmails,
    } = req.body;
    const linkedEmailsInput = Array.isArray(linkedEmails) ? linkedEmails : [primaryEmailRaw ?? email1Raw, secondaryEmailRaw ?? email2Raw];
    const validation = validateHouseEmails(linkedEmailsInput);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }
    const residentialStatus = normalizeResidentialStatus(residentialStatusRaw ?? statusRaw);
    const isOccupied = normalizeBoolean(isOccupiedRaw ?? isOccupiedSnakeRaw, false);

    await transaction.query("BEGIN");

    const usersFound = await transaction.query("SELECT email FROM users WHERE email = ANY($1::text[])", [validation.emails]);
    if (usersFound.rowCount !== validation.emails.length) {
      await transaction.query("ROLLBACK");
      return res.status(400).json({ message: "Ada email house yang belum terdaftar di users." });
    }

    await transaction.query(
      "INSERT INTO houses (id, blok, nomor, residential_status, is_occupied) VALUES ($1,$2,$3,$4,$5)",
      [id, blok, nomor, residentialStatus, isOccupied]
    );

    for (const [index, email] of validation.emails.entries()) {
      await transaction.query("INSERT INTO house_users (house_id, user_email, user_order) VALUES ($1,$2,$3)", [id, email, index + 1]);
    }

    const afterSnapshot = await getHouseSnapshot((text, params) => transaction.query(text, params), id);
    await writeAuditLog((text, params) => transaction.query(text, params), {
      author: actor,
      tableName: "houses",
      action: "CREATE",
      recordId: id,
      beforeValue: null,
      afterValue: afterSnapshot,
    });

    await transaction.query("COMMIT");
    res.status(201).json(afterSnapshot);
  } catch (error) {
    await transaction.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "ID house sudah digunakan." });
    }
    handleError(res, error);
  } finally {
    transaction.release();
  }
});

app.put("/api/houses/:id", async (req, res) => {
  const transaction = await pool.connect();
  try {
    const actor = getActor(req);
    const { id } = req.params;
    const {
      blok,
      nomor,
      status: statusRaw,
      residential_status: residentialStatusRaw,
      is_occupied: isOccupiedSnakeRaw,
      isOccupied: isOccupiedRaw,
      primary_email: primaryEmailRaw,
      secondary_email: secondaryEmailRaw,
      email_1: email1Raw,
      email_2: email2Raw,
      linked_emails: linkedEmails,
    } = req.body;
    const linkedEmailsInput = Array.isArray(linkedEmails) ? linkedEmails : [primaryEmailRaw ?? email1Raw, secondaryEmailRaw ?? email2Raw];
    const validation = validateHouseEmails(linkedEmailsInput);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }
    const residentialStatus = normalizeResidentialStatus(residentialStatusRaw ?? statusRaw);
    const isOccupied = normalizeBoolean(isOccupiedRaw ?? isOccupiedSnakeRaw, false);

    await transaction.query("BEGIN");

    const beforeSnapshot = await getHouseSnapshot((text, params) => transaction.query(text, params), id);
    if (!beforeSnapshot) {
      await transaction.query("ROLLBACK");
      return res.status(404).json({ message: "House tidak ditemukan." });
    }

    const usersFound = await transaction.query("SELECT email FROM users WHERE email = ANY($1::text[])", [validation.emails]);
    if (usersFound.rowCount !== validation.emails.length) {
      await transaction.query("ROLLBACK");
      return res.status(400).json({ message: "Ada email house yang belum terdaftar di users." });
    }

    await transaction.query(
      "UPDATE houses SET blok=$1, nomor=$2, residential_status=$3, is_occupied=$4 WHERE id=$5",
      [blok, nomor, residentialStatus, isOccupied, id]
    );
    await transaction.query("DELETE FROM house_users WHERE house_id=$1", [id]);
    for (const [index, email] of validation.emails.entries()) {
      await transaction.query("INSERT INTO house_users (house_id, user_email, user_order) VALUES ($1,$2,$3)", [id, email, index + 1]);
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

    await transaction.query("COMMIT");
    res.json(afterSnapshot);
  } catch (error) {
    await transaction.query("ROLLBACK");
    handleError(res, error);
  } finally {
    transaction.release();
  }
});

app.delete("/api/houses/:id", async (req, res) => {
  const transaction = await pool.connect();
  try {
    const actor = getActor(req);
    await transaction.query("BEGIN");

    const beforeSnapshot = await getHouseSnapshot((text, params) => transaction.query(text, params), req.params.id);
    if (!beforeSnapshot) {
      await transaction.query("ROLLBACK");
      return res.status(404).json({ message: "House tidak ditemukan." });
    }

    await transaction.query("DELETE FROM houses WHERE id=$1", [req.params.id]);
    await writeAuditLog((text, params) => transaction.query(text, params), {
      author: actor,
      tableName: "houses",
      action: "DELETE",
      recordId: req.params.id,
      beforeValue: beforeSnapshot,
      afterValue: null,
    });

    await transaction.query("COMMIT");
    res.json({ status: true });
  } catch (error) {
    await transaction.query("ROLLBACK");
    handleError(res, error);
  } finally {
    transaction.release();
  }
});

app.get("/api/bills", async (_, res) => {
  try {
    const result = await query(
      "SELECT id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer FROM bills ORDER BY id DESC"
    );
    res.json(result.rows.map(mapBillRowDates));
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/bills", async (req, res) => {
  const transaction = await pool.connect();
  try {
    const actor = getActor(req);
    const {
      id,
      house_id: houseId,
      periode,
      amount,
      payment_method: rawPaymentMethod,
      status: rawStatus,
      paid_to_developer: rawPaidToDeveloper,
      date_paid_period_to_developer: rawDatePaidPeriodToDeveloper,
    } = req.body;
    const status = normalizeBillStatus(rawStatus) ?? "Belum Dibayar";
    const paymentMethod = normalizePaymentMethod(rawPaymentMethod, "Transfer Bank");
    const statusDate = nowDateTime();
    const paidToDeveloper = normalizeBoolean(rawPaidToDeveloper, false);
    const datePaidPeriodToDeveloper = paidToDeveloper ? normalizeOptionalDateOnly(rawDatePaidPeriodToDeveloper) : null;

    await transaction.query("BEGIN");
    const result = await transaction.query(
      "INSERT INTO bills (id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer",
      [id, houseId, periode, amount, paymentMethod, status, statusDate, paidToDeveloper, datePaidPeriodToDeveloper]
    );

    await writeAuditLog((text, params) => transaction.query(text, params), {
      author: actor,
      tableName: "bills",
      action: "CREATE",
      recordId: result.rows[0].id,
      beforeValue: null,
      afterValue: result.rows[0],
    });

    await createAutoIplTransaction((text, params) => transaction.query(text, params), {
      actor,
      billId: result.rows[0].id,
      amount,
      billStatus: status,
      paymentMethod,
    });

    await transaction.query("COMMIT");
    res.status(201).json(mapBillRowDates(result.rows[0]));
  } catch (error) {
    await transaction.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "ID IPL atau kombinasi house+periode sudah digunakan." });
    }
    handleError(res, error);
  } finally {
    transaction.release();
  }
});

app.put("/api/bills/:id", async (req, res) => {
  const transaction = await pool.connect();
  try {
    const actor = getActor(req);
    const { id } = req.params;
    const {
      house_id: houseId,
      periode,
      amount,
      payment_method: rawPaymentMethod,
      status: rawStatus,
      status_date: rawStatusDate,
      paid_to_developer: rawPaidToDeveloper,
      date_paid_period_to_developer: rawDatePaidPeriodToDeveloper,
    } = req.body;
    const status = normalizeBillStatus(rawStatus) ?? "Belum Dibayar";

    await transaction.query("BEGIN");

    const before = await transaction.query(
      "SELECT id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer FROM bills WHERE id=$1 FOR UPDATE",
      [id]
    );
    if (!before.rows.length) {
      await transaction.query("ROLLBACK");
      return res.status(404).json({ message: "IPL tidak ditemukan." });
    }

    const previous = before.rows[0];
    const paidToDeveloper = normalizeBoolean(rawPaidToDeveloper, previous.paid_to_developer);
    const paymentMethod = normalizePaymentMethod(rawPaymentMethod, previous.payment_method ?? "Transfer Bank");
    const datePaidPeriodToDeveloper = !paidToDeveloper
      ? null
      : rawDatePaidPeriodToDeveloper === undefined
        ? previous.date_paid_period_to_developer
        : normalizeOptionalDateOnly(rawDatePaidPeriodToDeveloper);
    const manualStatusDate = rawStatusDate === undefined ? null : normalizeDateTimeInput(rawStatusDate);
    if (rawStatusDate !== undefined && !manualStatusDate) {
      await transaction.query("ROLLBACK");
      return res.status(400).json({ message: "Format status_date tidak valid. Gunakan format datetime yang benar." });
    }
    const statusDate = manualStatusDate ?? (previous.status === status ? previous.status_date : nowDateTime());

    const result = await transaction.query(
      "UPDATE bills SET house_id=$1, periode=$2, amount=$3, payment_method=$4, status=$5, status_date=$6, paid_to_developer=$7, date_paid_period_to_developer=$8 WHERE id=$9 RETURNING id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer",
      [houseId, periode, amount, paymentMethod, status, statusDate, paidToDeveloper, datePaidPeriodToDeveloper, id]
    );

    await writeAuditLog((text, params) => transaction.query(text, params), {
      author: actor,
      tableName: "bills",
      action: "UPDATE",
      recordId: id,
      beforeValue: previous,
      afterValue: result.rows[0],
    });

    if (status === "Lunas") {
      await upsertIplIncomeTransaction((text, params) => transaction.query(text, params), {
        actor,
        billId: id,
        amount,
        billStatus: status,
        paymentMethod,
      });
    }

    await transaction.query("COMMIT");
    res.json(mapBillRowDates(result.rows[0]));
  } catch (error) {
    await transaction.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Kombinasi house+periode sudah digunakan." });
    }
    handleError(res, error);
  } finally {
    transaction.release();
  }
});

app.delete("/api/bills/:id", async (req, res) => {
  try {
    const actor = getActor(req);
    const result = await query(
      "DELETE FROM bills WHERE id=$1 RETURNING id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: "IPL tidak ditemukan." });

    await writeAuditLog(query, {
      author: actor,
      tableName: "bills",
      action: "DELETE",
      recordId: req.params.id,
      beforeValue: result.rows[0],
      afterValue: null,
    });

    res.json({ status: true });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/bills/generate", async (req, res) => {
  const transaction = await pool.connect();
  try {
    const actor = getActor(req);
    const { month, amount, updateExistingUnpaid = false } = req.body;
    if (!month || !amount) {
      return res.status(400).json({ message: "month dan amount wajib diisi." });
    }

    const periode = toPeriode(month);
    await transaction.query("BEGIN");

    const houses = await transaction.query("SELECT id FROM houses ORDER BY id ASC");
    await transaction.query(
      "UPDATE bills SET payment_method='Transfer Bank' WHERE periode=$1 AND (payment_method IS NULL OR BTRIM(payment_method) = '' OR payment_method NOT IN ('Transfer Bank', 'Cash', 'QRIS', 'E-wallet'))",
      [periode]
    );
    const existingBills = await transaction.query(
      "SELECT id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer FROM bills WHERE periode=$1",
      [periode]
    );
    const billByHouse = new Map(existingBills.rows.map((row) => [row.house_id, row]));

    let created = 0;
    let updated = 0;
    let skipPaid = 0;
    let skipExisting = 0;

    const nextBillId = await getNextPrefixedId("BILL", "bills", (text, params) => transaction.query(text, params));
    let nextNumber = Number(nextBillId.replace("BILL", ""));

    for (const house of houses.rows) {
      const existing = billByHouse.get(house.id);
      if (existing) {
        if (existing.status === "Lunas") {
          skipPaid += 1;
          continue;
        }

        if (updateExistingUnpaid) {
          const beforeValue = { ...existing };
          const updatedResult = await transaction.query(
            "UPDATE bills SET amount=$1 WHERE id=$2 RETURNING id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer",
            [amount, existing.id]
          );
          await writeAuditLog((text, params) => transaction.query(text, params), {
            author: actor,
            tableName: "bills",
            action: "UPDATE",
            recordId: existing.id,
            beforeValue,
            afterValue: updatedResult.rows[0],
          });
          updated += 1;
        } else {
          skipExisting += 1;
        }
        continue;
      }

      const billId = `BILL${String(nextNumber).padStart(3, "0")}`;
      const inserted = await transaction.query(
        "INSERT INTO bills (id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer",
        [billId, house.id, periode, amount, "Transfer Bank", "Belum Dibayar", nowDateTime(), false, null]
      );
      await writeAuditLog((text, params) => transaction.query(text, params), {
        author: actor,
        tableName: "bills",
        action: "CREATE",
        recordId: billId,
        beforeValue: null,
        afterValue: inserted.rows[0],
      });
      await createAutoIplTransaction((text, params) => transaction.query(text, params), {
        actor,
        billId,
        amount,
        billStatus: "Belum Dibayar",
        paymentMethod: "Transfer Bank",
      });
      nextNumber += 1;
      created += 1;
    }

    await transaction.query("COMMIT");
    res.json({
      periode,
      created,
      updated,
      skipPaid,
      skipExisting,
      message: `Generate ${periode} selesai.`,
    });
  } catch (error) {
    await transaction.query("ROLLBACK");
    handleError(res, error);
  } finally {
    transaction.release();
  }
});

app.get("/api/transactions", async (_, res) => {
  try {
    const result = await query(
      "SELECT id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date FROM transactions ORDER BY id DESC"
    );
    res.json(result.rows.map(mapTransactionRowDates));
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const actor = getActor(req);
    const {
      id,
      bill_id: rawBillId,
      transaction_type: rawType,
      transaction_name: rawTransactionName,
      category: rawCategory,
      amount,
      date,
      payment_method: paymentMethod,
      status: rawStatus,
    } = req.body;
    const billId = normalizeIplId(rawBillId);
    const transactionType = normalizeTransactionType(rawType) || "Pemasukan";
    const defaultCategory = transactionType === "Pengeluaran" ? "Other" : "IPL Warga";
    const category = normalizeTransactionCategory(rawCategory, defaultCategory);
    const transactionName =
      typeof rawTransactionName === "string" && rawTransactionName.trim()
        ? rawTransactionName.trim()
        : defaultTransactionName(category || defaultCategory, transactionType);
    const status = normalizeTransactionStatus(rawStatus) || "Lunas";
    const transactionDate = normalizeDateTimeInput(date);
    const statusDate = nowDateTime();

    if (!id || !amount || !date || !paymentMethod || !transactionName) {
      return res.status(400).json({ message: "id, transaction_name, amount, date, dan payment_method wajib diisi." });
    }
    if (!transactionDate) {
      return res.status(400).json({ message: "Format date tidak valid. Gunakan format datetime yang benar." });
    }
    if (!category) {
      return res.status(400).json({ message: "category tidak valid. Pilih IPL Warga, IPL Cluster, Barang Inventaris, atau Other." });
    }

    if (billId) {
      const billExists = await query("SELECT 1 FROM bills WHERE id=$1 LIMIT 1", [billId]);
      if (!billExists.rowCount) {
        return res.status(400).json({ message: "ipl_id tidak valid. Pilih IPL yang tersedia atau kosongkan untuk non-IPL." });
      }
    }

    const result = await query(
      "INSERT INTO transactions (id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
      [id, billId, transactionType, transactionName, category, amount, transactionDate, paymentMethod, status, statusDate]
    );

    await writeAuditLog(query, {
      author: actor,
      tableName: "transactions",
      action: "CREATE",
      recordId: result.rows[0].id,
      beforeValue: null,
      afterValue: result.rows[0],
    });

    res.status(201).json(mapTransactionRowDates(result.rows[0]));
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "ID transaction sudah digunakan." });
    }
    if (error.code === "23514") {
      return res.status(400).json({ message: "Nilai transaction_type, category, payment_method, atau status tidak valid." });
    }
    if (error.code === "23502") {
      return res.status(400).json({ message: "Data transaction belum lengkap. Cek kembali form." });
    }
    if (error.code === "23503") {
      return res.status(400).json({ message: "ipl_id tidak valid. Gunakan ID IPL yang tersedia atau kosongkan untuk non-IPL." });
    }
    handleError(res, error);
  }
});

app.put("/api/transactions/:id", async (req, res) => {
  try {
    const actor = getActor(req);
    const { id } = req.params;
    const {
      bill_id: rawBillId,
      transaction_type: rawType,
      transaction_name: rawTransactionName,
      category: rawCategory,
      amount,
      date,
      payment_method: paymentMethod,
      status: rawStatus,
    } = req.body;
    const billId = normalizeIplId(rawBillId);
    const transactionType = normalizeTransactionType(rawType) || "Pemasukan";
    const defaultCategory = transactionType === "Pengeluaran" ? "Other" : "IPL Warga";
    const category = normalizeTransactionCategory(rawCategory, defaultCategory);
    const status = normalizeTransactionStatus(rawStatus) || "Lunas";
    const transactionDate = normalizeDateTimeInput(date);
    const transactionName =
      typeof rawTransactionName === "string" && rawTransactionName.trim()
        ? rawTransactionName.trim()
        : defaultTransactionName(category || defaultCategory, transactionType);

    if (!amount || !date || !paymentMethod || !transactionName) {
      return res.status(400).json({ message: "transaction_name, amount, date, dan payment_method wajib diisi." });
    }
    if (!transactionDate) {
      return res.status(400).json({ message: "Format date tidak valid. Gunakan format datetime yang benar." });
    }
    if (!category) {
      return res.status(400).json({ message: "category tidak valid. Pilih IPL Warga, IPL Cluster, Barang Inventaris, atau Other." });
    }

    if (billId) {
      const billExists = await query("SELECT 1 FROM bills WHERE id=$1 LIMIT 1", [billId]);
      if (!billExists.rowCount) {
        return res.status(400).json({ message: "ipl_id tidak valid. Pilih IPL yang tersedia atau kosongkan untuk non-IPL." });
      }
    }

    const before = await query(
      "SELECT id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date FROM transactions WHERE id=$1",
      [id]
    );
    if (!before.rows.length) return res.status(404).json({ message: "Transaction tidak ditemukan." });
    const previous = before.rows[0];
    const statusDate = previous.status === status ? previous.status_date : nowDateTime();

    const result = await query(
      "UPDATE transactions SET bill_id=$1, transaction_type=$2, transaction_name=$3, category=$4, amount=$5, date=$6, payment_method=$7, status=$8, status_date=$9 WHERE id=$10 RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
      [billId, transactionType, transactionName, category, amount, transactionDate, paymentMethod, status, statusDate, id]
    );

    await writeAuditLog(query, {
      author: actor,
      tableName: "transactions",
      action: "UPDATE",
      recordId: id,
      beforeValue: previous,
      afterValue: result.rows[0],
    });

    res.json(mapTransactionRowDates(result.rows[0]));
  } catch (error) {
    if (error.code === "23514") {
      return res.status(400).json({ message: "Nilai transaction_type, category, payment_method, atau status tidak valid." });
    }
    if (error.code === "23502") {
      return res.status(400).json({ message: "Data transaction belum lengkap. Cek kembali form." });
    }
    if (error.code === "23503") {
      return res.status(400).json({ message: "ipl_id tidak valid. Gunakan ID IPL yang tersedia atau kosongkan untuk non-IPL." });
    }
    handleError(res, error);
  }
});

app.delete("/api/transactions/:id", async (req, res) => {
  try {
    const actor = getActor(req);
    const result = await query(
      "DELETE FROM transactions WHERE id=$1 RETURNING id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Transaction tidak ditemukan." });

    await writeAuditLog(query, {
      author: actor,
      tableName: "transactions",
      action: "DELETE",
      recordId: req.params.id,
      beforeValue: result.rows[0],
      afterValue: null,
    });

    res.json({ status: true });
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/api/warga/pay-qris", async (req, res) => {
  const transaction = await pool.connect();
  try {
    const actor = getActor(req);
    const { billId } = req.body;
    if (!billId) return res.status(400).json({ message: "iplId wajib diisi." });

    await transaction.query("BEGIN");
    const billResult = await transaction.query(
      "SELECT id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer FROM bills WHERE id=$1 FOR UPDATE",
      [billId]
    );
    const bill = billResult.rows[0];
    if (!bill) {
      await transaction.query("ROLLBACK");
      return res.status(404).json({ message: "IPL tidak ditemukan." });
    }

    let latestBill = bill;
    if (bill.status === "Belum Dibayar") {
      const updatedBill = await transaction.query(
        "UPDATE bills SET status=$1, status_date=$2, payment_method='QRIS' WHERE id=$3 RETURNING id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer",
        ["Verifikasi", nowDateTime(), billId]
      );
      latestBill = updatedBill.rows[0];
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
      amount: latestBill.amount,
      billStatus: latestBill.status,
      paymentMethod: "QRIS",
    });

    await transaction.query("COMMIT");
    res.json({
      status: true,
      billId,
      newBillStatus: latestBill.status,
      transaction: upsertedTransaction ? mapTransactionRowDates(upsertedTransaction) : null,
    });
  } catch (error) {
    await transaction.query("ROLLBACK");
    handleError(res, error);
  } finally {
    transaction.release();
  }
});

async function startServer() {
  try {
    await ensureAuditTable();
    await ensureUserRoleConstraint();
    await ensureHouseColumns();
    await ensureHouseUserOrderColumn();
    await ensureBillColumns();
    await ensureTransactionColumns();
    app.listen(PORT, () => {
      console.log(`Hunita API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Gagal start backend:", error);
    process.exit(1);
  }
}

startServer();
