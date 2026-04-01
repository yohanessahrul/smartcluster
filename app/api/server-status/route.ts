import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/server/api-route";
import { readSessionFromRequest } from "@/lib/server/auth-session";
import { query } from "@/lib/server/db";
import { ApiHttpError } from "@/lib/server/smart-api";
import { getSupabaseStorageBucket } from "@/lib/server/supabase";

type RoleRow = {
  role: "admin" | "warga" | "finance";
};

type DatabaseSizeRow = {
  used_bytes: number | string;
};

type TableSizeRow = {
  table_name: string;
  size_bytes: number | string;
  row_estimate: number | string;
};

type ServerStatusPayload = {
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
  table_sizes: Array<{ table_name: string; size_bytes: number; row_estimate: number }>;
};

type StorageUsageRow = {
  used_bytes: number | string;
  object_count: number | string;
};

const MAX_DATABASE_BYTES = 500 * 1024 * 1024;
const MAX_STORAGE_BYTES = 1024 * 1024 * 1024;
const STATUS_TABLES = ["users", "houses", "house_users", "bills", "transactions", "audit_logs"];

function toNumber(value: number | string | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function ensureAdminSession(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) {
    throw new ApiHttpError(401, "Unauthenticated.");
  }

  const userResult = await query<RoleRow>("SELECT role FROM users WHERE id=$1 AND LOWER(email)=$2 LIMIT 1", [
    session.userId,
    session.email.toLowerCase(),
  ]);
  const user = userResult.rows[0];
  if (!user) {
    throw new ApiHttpError(401, "Sesi tidak valid.");
  }
  if (user.role !== "admin") {
    throw new ApiHttpError(403, "Hanya admin yang bisa melihat Status Server.");
  }
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await ensureAdminSession(request);

    const databaseSizeResult = await query<DatabaseSizeRow>(
      "SELECT pg_database_size(current_database())::bigint AS used_bytes",
    );
    const usedBytes = Math.max(0, toNumber(databaseSizeResult.rows[0]?.used_bytes));
    const storageBucket = getSupabaseStorageBucket();

    const tableSizesResult = await query<TableSizeRow>(
      `
        SELECT
          c.relname AS table_name,
          pg_total_relation_size(c.oid)::bigint AS size_bytes,
          COALESCE(s.n_live_tup, 0)::bigint AS row_estimate
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = ANY($1::text[])
        ORDER BY pg_total_relation_size(c.oid) DESC, c.relname ASC
      `,
      [STATUS_TABLES],
    );

    const tableSizeMap = new Map(
      tableSizesResult.rows.map((row) => [
        row.table_name,
        {
          table_name: row.table_name,
          size_bytes: Math.max(0, toNumber(row.size_bytes)),
          row_estimate: Math.max(0, toNumber(row.row_estimate)),
        },
      ]),
    );

    const tableSizes = STATUS_TABLES.map((name) => {
      const found = tableSizeMap.get(name);
      if (found) return found;
      return { table_name: name, size_bytes: 0, row_estimate: 0 };
    }).sort((a, b) => b.size_bytes - a.size_bytes);

    let storageUsedBytes = 0;
    let storageObjectCount = 0;
    try {
      const storageUsageResult = await query<StorageUsageRow>(
        `
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN (metadata->>'size') ~ '^[0-9]+$' THEN (metadata->>'size')::bigint
                  ELSE 0
                END
              ),
              0
            )::bigint AS used_bytes,
            COUNT(*)::bigint AS object_count
          FROM storage.objects
          WHERE bucket_id = $1
        `,
        [storageBucket],
      );
      storageUsedBytes = Math.max(0, toNumber(storageUsageResult.rows[0]?.used_bytes));
      storageObjectCount = Math.max(0, toNumber(storageUsageResult.rows[0]?.object_count));
    } catch {
      storageUsedBytes = 0;
      storageObjectCount = 0;
    }

    const remainingBytes = Math.max(0, MAX_DATABASE_BYTES - usedBytes);
    const storageRemainingBytes = Math.max(0, MAX_STORAGE_BYTES - storageUsedBytes);

    const payload: ServerStatusPayload = {
      plan_limit_mb: 500,
      max_bytes: MAX_DATABASE_BYTES,
      used_bytes: usedBytes,
      remaining_bytes: remainingBytes,
      over_limit: usedBytes > MAX_DATABASE_BYTES,
      generated_at: new Date().toISOString(),
      storage_bucket: storageBucket,
      storage_max_bytes: MAX_STORAGE_BYTES,
      storage_used_bytes: storageUsedBytes,
      storage_remaining_bytes: storageRemainingBytes,
      storage_over_limit: storageUsedBytes > MAX_STORAGE_BYTES,
      storage_object_count: storageObjectCount,
      table_sizes: tableSizes,
    };

    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
}
