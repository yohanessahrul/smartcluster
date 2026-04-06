import { NextRequest } from "next/server";

import { handleApi } from "@/lib/server/api-route";
import { ApiHttpError, listAuditLogs } from "@/lib/server/smart-api";
import { getWargaScopedDataByEmail } from "@/lib/server/warga-scope";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const table = request.nextUrl.searchParams.get("table");
  const recordId = request.nextUrl.searchParams.get("record_id");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);

  return handleApi(
    request,
    async (actor, sessionUser) => {
      if (!sessionUser) throw new ApiHttpError(401, "Unauthenticated.");

      if (sessionUser.role === "warga") {
        if (table !== "bills" || !recordId) {
          throw new ApiHttpError(403, "Warga hanya bisa melihat riwayat tagihan miliknya.");
        }
        const scoped = await getWargaScopedDataByEmail(actor);
        const allowedBillIds = new Set(scoped.houseBills.map((item) => item.id));
        if (!allowedBillIds.has(recordId)) {
          throw new ApiHttpError(403, "Warga hanya bisa melihat riwayat tagihan miliknya.");
        }
      }

      if (sessionUser.role === "finance") {
        if (table && table !== "bills" && table !== "transactions") {
          throw new ApiHttpError(403, "Finance hanya bisa melihat riwayat bills/transactions.");
        }
      }

      return listAuditLogs({
        table,
        recordId,
        limit,
      });
    },
    { auth: { roles: ["admin", "superadmin", "finance", "warga"] } },
  );
}
