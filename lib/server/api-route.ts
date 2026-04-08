import { NextResponse } from "next/server";

import { ApiHttpError, ensureBackendReady, getActorFromHeaders } from "@/lib/server/smart-api";
import { query } from "@/lib/server/db";
import { readSessionFromToken } from "@/lib/server/auth-session";

export type AppRole = "admin" | "superadmin" | "warga" | "finance";

type SessionUserRow = {
  id: string;
  email: string;
  role: AppRole;
};

const SESSION_COOKIE_NAME = "smart_perumahan_session";

function readCookieValue(headers: Headers, name: string) {
  const raw = headers.get("cookie");
  if (!raw) return null;
  const chunks = raw.split(";").map((item) => item.trim());
  for (const chunk of chunks) {
    if (!chunk) continue;
    const [key, ...rest] = chunk.split("=");
    if (key !== name) continue;
    const value = rest.join("=");
    if (!value) return "";
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export type ApiSessionUser = {
  id: string;
  email: string;
  role: AppRole;
};

export async function requireSessionActor(request: Request, allowedRoles?: AppRole[]): Promise<ApiSessionUser> {
  const token = readCookieValue(request.headers, SESSION_COOKIE_NAME);
  const session = readSessionFromToken(token);
  if (!session) throw new ApiHttpError(401, "Unauthenticated.");

  const userResult = await query<SessionUserRow>(
    "SELECT id, email, role FROM users WHERE id=$1 AND LOWER(email)=$2 LIMIT 1",
    [session.userId, session.email.toLowerCase()],
  );
  const user = userResult.rows[0];
  if (!user) throw new ApiHttpError(401, "Sesi tidak valid.");

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    throw new ApiHttpError(403, "Forbidden.");
  }

  return {
    id: user.id,
    email: user.email.toLowerCase(),
    role: user.role,
  };
}

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
  handler: (actor: string, sessionUser?: ApiSessionUser) => Promise<unknown>,
  options?: {
    status?: number;
    auth?: {
      required?: boolean;
      roles?: AppRole[];
    };
  },
) {
  try {
    await ensureBackendReady();
    const shouldRequireAuth = options?.auth?.required || Boolean(options?.auth?.roles?.length);
    const sessionUser = shouldRequireAuth
      ? await requireSessionActor(request, options?.auth?.roles)
      : undefined;
    const actor = sessionUser?.email ?? getActorFromHeaders(request.headers);
    const data = await handler(actor, sessionUser);
    return NextResponse.json(data, { status: options?.status ?? 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
