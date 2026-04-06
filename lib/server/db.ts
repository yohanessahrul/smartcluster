import { Pool, PoolClient, QueryResult, QueryResultRow, types } from "pg";

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

function normalizeConnectionString(raw: string) {
  try {
    const url = new URL(raw);
    const isSupabasePooler = /pooler\.supabase\.com/i.test(url.hostname);
    let changed = false;

    // In Supabase pooler, port 5432 is session mode (easy to hit connection limits on serverless).
    // Force transaction mode (6543) for safer fan-out behavior.
    if (isSupabasePooler && (!url.port || url.port === "5432")) {
      url.port = "6543";
      changed = true;
    }

    if (isSupabasePooler && url.port === "6543" && !url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
      changed = true;
    }

    if (/supabase\.co$/i.test(url.hostname) && !url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
      changed = true;
    }

    return {
      connectionString: changed ? url.toString() : raw,
      isSupabasePooler,
    };
  } catch {
    const isSupabasePooler = /pooler\.supabase\.com/i.test(raw);
    let connectionString = raw;
    if (isSupabasePooler) {
      connectionString = connectionString.replace(/pooler\.supabase\.com:5432/i, "pooler.supabase.com:6543");
      if (!/[?&]pgbouncer=/i.test(connectionString)) {
        connectionString += connectionString.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
      }
      if (!/[?&]sslmode=/i.test(connectionString)) {
        connectionString += connectionString.includes("?") ? "&sslmode=require" : "?sslmode=require";
      }
    }
    return {
      connectionString,
      isSupabasePooler,
    };
  }
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
  if (!error || typeof error !== "object") return false;
  const err = error as { message?: unknown; code?: unknown };
  const message = typeof err.message === "string" ? err.message.toLowerCase() : "";
  const code = typeof err.code === "string" ? err.code : "";

  if (code === "53300" || code === "57P03") return true;

  return (
    message.includes("connection terminated due to connection timeout") ||
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("ecconnreset") ||
    message.includes("econnrefused") ||
    message.includes("maxclientsinsessionmode") ||
    message.includes("too many clients")
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
  const normalized = normalizeConnectionString(getConnectionString());
  const connectionString = normalized.connectionString;
  const useSsl =
    process.env.DB_SSL === "true" ||
    (process.env.DB_SSL !== "false" && /supabase\.co/i.test(connectionString));
  const isProductionRuntime = shouldRequireExplicitDbUrl();
  const defaultPoolMax = isProductionRuntime ? 1 : 10;
  const requestedMax = asPositiveInt(process.env.DB_POOL_MAX, defaultPoolMax);
  const max = isProductionRuntime ? Math.min(requestedMax, 1) : requestedMax;
  const requestedIdleTimeoutMillis = asPositiveInt(process.env.DB_IDLE_TIMEOUT_MS, isProductionRuntime ? 1_000 : 10_000);
  const idleTimeoutMillis = isProductionRuntime
    ? Math.min(Math.max(requestedIdleTimeoutMillis, 500), 5_000)
    : requestedIdleTimeoutMillis;
  const connectionTimeoutMillis = asPositiveInt(
    process.env.DB_CONNECTION_TIMEOUT_MS,
    isProductionRuntime ? 10_000 : 5_000,
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
    maxLifetimeSeconds: isProductionRuntime ? 60 : 0,
  });
}

export const pool = globalDbState.smartPerumahanPgPool;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  const isReadQuery = isReadOnlySelectQuery(text);
  const maxAttempts = isReadQuery ? 3 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await pool.query<T>(text, params);
    } catch (error) {
      if (!isReadQuery || !isTransientConnectionError(error) || attempt >= maxAttempts) {
        throw error;
      }
      await wait(200 * attempt);
    }
  }

  // Unreachable, keeps TS happy.
  return pool.query<T>(text, params);
}

export async function connect() {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await pool.connect();
    } catch (error) {
      if (!isTransientConnectionError(error) || attempt >= maxAttempts) {
        throw error;
      }
      await wait(250 * attempt);
    }
  }
  return pool.connect();
}

export type DbQueryResult<T extends QueryResultRow = QueryResultRow> = QueryResult<T>;
