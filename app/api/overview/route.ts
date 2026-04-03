import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/server/api-route";
import { readSessionFromRequest } from "@/lib/server/auth-session";
import { query } from "@/lib/server/db";
import { ApiHttpError, ensureBackendReady, getOverviewSnapshot } from "@/lib/server/smart-api";

type Role = "admin" | "superadmin" | "warga" | "finance";

type SessionUserRow = {
  id: string;
  email: string;
  role: Role;
};

async function requireSessionUser(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) throw new ApiHttpError(401, "Unauthenticated.");

  const result = await query<SessionUserRow>(
    "SELECT id, email, role FROM users WHERE id=$1 AND LOWER(email)=$2 LIMIT 1",
    [session.userId, session.email.toLowerCase()],
  );
  const user = result.rows[0];
  if (!user) throw new ApiHttpError(401, "Sesi tidak valid.");
  return user;
}

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await ensureBackendReady();
    const user = await requireSessionUser(request);
    const snapshot = await getOverviewSnapshot();

    if (user.role === "admin" || user.role === "superadmin") {
      return NextResponse.json({
        can_refresh: true,
        snapshot,
      });
    }

    if (user.role === "finance") {
      return NextResponse.json({
        can_refresh: false,
        snapshot: {
          generated_at: snapshot.generated_at,
          generated_by: snapshot.generated_by,
          finance: snapshot.finance,
        },
      });
    }

    return NextResponse.json({
      can_refresh: false,
      snapshot: {
        generated_at: snapshot.generated_at,
        generated_by: snapshot.generated_by,
        warga: snapshot.warga,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
