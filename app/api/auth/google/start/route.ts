import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getGoogleOAuthConfig } from "@/lib/server/google-oauth";

const GOOGLE_STATE_COOKIE = "smart_google_oauth_state";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(request);
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=google_config_missing", request.url));
  }

  const state = randomBytes(32).toString("hex");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
