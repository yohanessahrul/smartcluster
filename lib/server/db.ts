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
  return `postgresql://${process.env.PGUSER || "postgres"}:${process.env.PGPASSWORD || "postgres"}@${
    process.env.PGHOST || "localhost"
  }:${process.env.PGPORT || "5432"}/${process.env.PGDATABASE || "smart_perumahan"}`;
}

if (!globalDbState.smartPerumahanPgPool) {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    console.warn(
      "[next-api] DATABASE_URL/SUPABASE_DB_URL tidak ditemukan. Menggunakan fallback PGUSER/PGPASSWORD/PGHOST/PGPORT/PGDATABASE.",
    );
  }
  const connectionString = getConnectionString();
  const useSsl =
    process.env.DB_SSL === "true" ||
    (process.env.DB_SSL !== "false" && /supabase\.co/i.test(connectionString));
  globalDbState.smartPerumahanPgPool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
}

export const pool = globalDbState.smartPerumahanPgPool;

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}

export type DbQueryResult<T extends QueryResultRow = QueryResultRow> = QueryResult<T>;
