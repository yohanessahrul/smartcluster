import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/server/auth-session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ status: true });
  clearSessionCookie(response);
  response.cookies.set({
    name: "smart_google_oauth_state",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
