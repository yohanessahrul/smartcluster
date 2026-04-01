const { Pool, types } = require("pg");

// Keep PostgreSQL DATE/TIMESTAMP values as raw strings to avoid timezone shifting
// when serializing to JSON (important for status_date and transaction date).
types.setTypeParser(1082, (value) => value); // date
types.setTypeParser(1114, (value) => value); // timestamp without time zone
types.setTypeParser(1184, (value) => value); // timestamp with time zone

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || "postgres"}:${process.env.PGPASSWORD || "postgres"}@${
    process.env.PGHOST || "localhost"
  }:${process.env.PGPORT || "5432"}/${process.env.PGDATABASE || "smart_perumahan"}`;

if (!process.env.DATABASE_URL) {
  console.warn(
    "[backend] DATABASE_URL tidak ditemukan. Menggunakan fallback PGUSER/PGPASSWORD/PGHOST/PGPORT/PGDATABASE."
  );
}

const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
