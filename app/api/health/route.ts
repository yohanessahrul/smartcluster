import { NextResponse } from "next/server";

import { ensureBackendReady, getHealthStatus } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function GET() {
  await ensureBackendReady();
  return NextResponse.json(getHealthStatus());
}
