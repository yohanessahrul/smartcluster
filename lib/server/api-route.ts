import { NextResponse } from "next/server";

import { ApiHttpError, ensureBackendReady, getActorFromHeaders } from "@/lib/server/smart-api";

export async function readJsonBody(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ApiHttpError) {
    const payload: Record<string, unknown> = { message: error.message };
    if (error.detail) payload.detail = error.detail;
    return NextResponse.json(payload, { status: error.status });
  }

  return NextResponse.json(
    {
      message: "Server error",
      detail: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 },
  );
}

export async function handleApi(
  request: Request,
  handler: (actor: string) => Promise<unknown>,
  options?: { status?: number },
) {
  try {
    await ensureBackendReady();
    const actor = getActorFromHeaders(request.headers);
    const data = await handler(actor);
    return NextResponse.json(data, { status: options?.status ?? 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
