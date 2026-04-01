import { NextRequest } from "next/server";

import { handleApi } from "@/lib/server/api-route";
import { listAuditLogs } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const table = request.nextUrl.searchParams.get("table");
  const recordId = request.nextUrl.searchParams.get("record_id");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);

  return handleApi(request, async () =>
    listAuditLogs({
      table,
      recordId,
      limit,
    }),
  );
}
