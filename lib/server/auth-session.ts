import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

type SessionRole = "admin" | "superadmin" | "warga" | "finance";

export type AppSession = {
  userId: string;
  email: string;
  role: SessionRole;
  name: string;
  issuedAt: string;
  expiresAt: string;
};

type SessionTokenPayload = AppSession & {
  iat: number;
  exp: number;
};

const SESSION_COOKIE_NAME = "smart_perumahan_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "smart-perumahan-dev-session-secret-change-this"
  );
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

function verifySignature(encodedPayload: string, signature: string) {
  const expected = signPayload(encodedPayload);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function createSessionToken(input: {
  userId: string;
  email: string;
  role: SessionRole;
  name: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_MAX_AGE_SECONDS;
  const payload: SessionTokenPayload = {
    userId: input.userId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    name: input.name,
    issuedAt: new Date(now * 1000).toISOString(),
    expiresAt: new Date(exp * 1000).toISOString(),
    iat: now,
    exp,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function readSessionFromToken(token: string | null | undefined): AppSession | null {
  if (!token || !token.includes(".")) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!verifySignature(encodedPayload, signature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionTokenPayload;
    if (!parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!parsed.email || !parsed.userId || !parsed.name) return null;
    if (parsed.role !== "admin" && parsed.role !== "superadmin" && parsed.role !== "warga" && parsed.role !== "finance") return null;

    return {
      userId: parsed.userId,
      email: parsed.email,
      role: parsed.role,
      name: parsed.name,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function readSessionFromRequest(request: NextRequest) {
  return readSessionFromToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export function applySessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
