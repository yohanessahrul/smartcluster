import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/server/api-route";
import { readSessionFromRequest } from "@/lib/server/auth-session";
import { query } from "@/lib/server/db";
import { ApiHttpError, ensureBackendReady, refreshOverviewSnapshot } from "@/lib/server/smart-api";

type Role = "admin" | "superadmin" | "warga" | "finance";

type SessionUserRow = {
  id: string;
  email: string;
  role: Role;
};

async function requireAdminSessionUser(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) throw new ApiHttpError(401, "Unauthenticated.");

  const result = await query<SessionUserRow>(
    "SELECT id, email, role FROM users WHERE id=$1 AND LOWER(email)=$2 LIMIT 1",
    [session.userId, session.email.toLowerCase()],
  );
  const user = result.rows[0];
  if (!user) throw new ApiHttpError(401, "Sesi tidak valid.");
  if (user.role !== "admin" && user.role !== "superadmin") {
    throw new ApiHttpError(403, "Hanya admin/superadmin yang bisa refresh overview.");
  }
  return user;
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await ensureBackendReady();
    const user = await requireAdminSessionUser(request);
    const snapshot = await refreshOverviewSnapshot(user.email.toLowerCase());
    return NextResponse.json({
      status: true,
      message: "Beranda berhasil diperbarui.",
      snapshot,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
