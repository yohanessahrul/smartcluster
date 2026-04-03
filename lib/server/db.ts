import { Pool, QueryResult, QueryResultRow, types } from "pg";

type GlobalDbState = typeof globalThis & {
  smartPerumahanPgPool?: Pool;
  smartPerumahanPgTypeParsersReady?: boolean;
};

const globalDbState = globalThis as GlobalDbState;

if (!globalDbState.smartPerumahanPgTypeParsersReady) {
  // Keep PostgreSQL DATE/TIMESTAMP values as raw strings to avoid timezone shifts.
  types.setTypeParser(1082, (value) => value); // date
  types.setTypeParser(1114, (value) => value); // timestamp without time zone
  types.setTypeParser(1184, (value) => value); // timestamp with time zone
  globalDbState.smartPerumahanPgTypeParsersReady = true;
}

function getConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.POSTGRES_URL_NON_POOLING) return process.env.POSTGRES_URL_NON_POOLING;
  if (process.env.POSTGRES_PRISMA_URL) return process.env.POSTGRES_PRISMA_URL;
  return `postgresql://${process.env.PGUSER || "postgres"}:${process.env.PGPASSWORD || "postgres"}@${
    process.env.PGHOST || "localhost"
  }:${process.env.PGPORT || "5432"}/${process.env.PGDATABASE || "smart_perumahan"}`;
}

function shouldRequireExplicitDbUrl() {
  const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();
  return nodeEnv === "production" || vercelEnv === "production";
}

function asPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientConnectionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("connection terminated due to connection timeout") ||
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("ecconnreset") ||
    message.includes("econnrefused")
  );
}

function isReadOnlySelectQuery(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized.startsWith("select");
}

if (!globalDbState.smartPerumahanPgPool) {
  const hasExplicitDbUrl = Boolean(
    process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.POSTGRES_PRISMA_URL,
  );

  if (!hasExplicitDbUrl && shouldRequireExplicitDbUrl()) {
    throw new Error(
      "DATABASE_URL belum diset di environment production. Tambahkan DATABASE_URL/SUPABASE_DB_URL/POSTGRES_URL di Vercel.",
    );
  }

  if (!hasExplicitDbUrl) {
    console.warn(
      "[next-api] DATABASE_URL/SUPABASE_DB_URL tidak ditemukan. Menggunakan fallback PGUSER/PGPASSWORD/PGHOST/PGPORT/PGDATABASE.",
    );
  }
  const connectionString = getConnectionString();
  const useSsl =
    process.env.DB_SSL === "true" ||
    (process.env.DB_SSL !== "false" && /supabase\.co/i.test(connectionString));
  const isSupabasePooler = /pooler\.supabase\.com/i.test(connectionString);
  const defaultPoolMax = shouldRequireExplicitDbUrl() ? (isSupabasePooler ? 10 : 1) : 10;
  const max = asPositiveInt(process.env.DB_POOL_MAX, defaultPoolMax);
  const idleTimeoutMillis = asPositiveInt(process.env.DB_IDLE_TIMEOUT_MS, shouldRequireExplicitDbUrl() ? 30_000 : 10_000);
  const connectionTimeoutMillis = asPositiveInt(
    process.env.DB_CONNECTION_TIMEOUT_MS,
    shouldRequireExplicitDbUrl() ? 15_000 : 5_000,
  );

  globalDbState.smartPerumahanPgPool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    allowExitOnIdle: true,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
}

export const pool = globalDbState.smartPerumahanPgPool;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  try {
    return await pool.query<T>(text, params);
  } catch (error) {
    if (!isTransientConnectionError(error) || !isReadOnlySelectQuery(text)) throw error;
    await wait(250);
    return pool.query<T>(text, params);
  }
}

export type DbQueryResult<T extends QueryResultRow = QueryResultRow> = QueryResult<T>;
