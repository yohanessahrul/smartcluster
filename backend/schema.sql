CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(16) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'warga', 'finance'))
);

CREATE TABLE IF NOT EXISTS houses (
  id VARCHAR(16) PRIMARY KEY,
  blok VARCHAR(16) NOT NULL,
  nomor VARCHAR(16) NOT NULL,
  residential_status TEXT NOT NULL DEFAULT 'Owner' CHECK (residential_status IN ('Owner', 'Contract')),
  is_occupied BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS house_users (
  house_id VARCHAR(16) NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE RESTRICT,
  user_order SMALLINT NOT NULL CHECK (user_order IN (1, 2)),
  UNIQUE (house_id, user_order),
  PRIMARY KEY (house_id, user_email)
);

CREATE TABLE IF NOT EXISTS bills (
  id VARCHAR(16) PRIMARY KEY,
  house_id VARCHAR(16) NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  periode TEXT NOT NULL,
  amount TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Transfer Bank' CHECK (payment_method IN ('Transfer Bank', 'Cash', 'QRIS', 'E-wallet')),
  status TEXT NOT NULL CHECK (status IN ('Lunas', 'Belum Dibayar', 'Verifikasi')),
  status_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_proof_url TEXT,
  paid_to_developer BOOLEAN NOT NULL DEFAULT FALSE,
  date_paid_period_to_developer DATE,
  UNIQUE (house_id, periode)
);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(16) PRIMARY KEY,
  bill_id VARCHAR(16) REFERENCES bills(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Pemasukan', 'Pengeluaran')),
  transaction_name TEXT NOT NULL DEFAULT 'Pembayaran IPL Warga',
  category TEXT NOT NULL DEFAULT 'IPL Warga' CHECK (category IN ('IPL Warga', 'IPL Cluster', 'Barang Inventaris', 'Other')),
  amount TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Transfer Bank', 'Cash', 'QRIS', 'E-wallet')),
  status TEXT NOT NULL CHECK (status IN ('Lunas', 'Verifikasi', 'Pending')),
  status_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author TEXT NOT NULL,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id TEXT,
  before_value JSONB,
  after_value JSONB
);
