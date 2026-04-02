import { NextRequest, NextResponse } from "next/server";

import { applySessionCookie, clearSessionCookie, createSessionToken } from "@/lib/server/auth-session";
import { query } from "@/lib/server/db";
import { getGoogleOAuthConfig } from "@/lib/server/google-oauth";

const GOOGLE_STATE_COOKIE = "smart_google_oauth_state";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  email?: string;
  name?: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "superadmin" | "warga" | "finance";
};

export const runtime = "nodejs";

function clearGoogleStateCookie(response: NextResponse) {
  response.cookies.set({
    name: GOOGLE_STATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

async function revokeGoogleToken(token?: string) {
  if (!token) return;
  try {
    const payload = new URLSearchParams();
    payload.set("token", token);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
      cache: "no-store",
    });
  } catch {
    // ignore revoke errors
  }
}

function loginErrorRedirect(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, request.url));
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(request);

  if (!clientId || !clientSecret) {
    const response = loginErrorRedirect(request, "google_config_missing");
    clearGoogleStateCookie(response);
    return response;
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    const response = loginErrorRedirect(request, "google_oauth_failed");
    clearGoogleStateCookie(response);
    clearSessionCookie(response);
    return response;
  }

  try {
    const tokenBody = new URLSearchParams();
    tokenBody.set("client_id", clientId);
    tokenBody.set("client_secret", clientSecret);
    tokenBody.set("code", code);
    tokenBody.set("grant_type", "authorization_code");
    tokenBody.set("redirect_uri", redirectUri);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
      cache: "no-store",
    });

    const tokenData = (await tokenResponse.json().catch(() => null)) as GoogleTokenResponse | null;
    const accessToken = tokenData?.access_token;
    const refreshToken = tokenData?.refresh_token;
    if (!tokenResponse.ok || !accessToken) {
      const response = loginErrorRedirect(request, "google_oauth_failed");
      clearGoogleStateCookie(response);
      clearSessionCookie(response);
      return response;
    }

    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const userInfo = (await userInfoResponse.json().catch(() => null)) as GoogleUserInfoResponse | null;
    const email = userInfo?.email?.trim().toLowerCase();
    if (!userInfoResponse.ok || !email) {
      await revokeGoogleToken(accessToken);
      await revokeGoogleToken(refreshToken);
      const response = loginErrorRedirect(request, "google_oauth_failed");
      clearGoogleStateCookie(response);
      clearSessionCookie(response);
      return response;
    }

    const userResult = await query<UserRow>(
      "SELECT id, name, email, role FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [email]
    );
    const matchedUser = userResult.rows[0];

    if (!matchedUser) {
      await revokeGoogleToken(accessToken);
      await revokeGoogleToken(refreshToken);
      const response = loginErrorRedirect(request, "email_not_registered");
      clearGoogleStateCookie(response);
      clearSessionCookie(response);
      return response;
    }

    if (matchedUser.role !== "admin" && matchedUser.role !== "superadmin" && matchedUser.role !== "warga" && matchedUser.role !== "finance") {
      await revokeGoogleToken(accessToken);
      await revokeGoogleToken(refreshToken);
      const response = loginErrorRedirect(request, "google_oauth_failed");
      clearGoogleStateCookie(response);
      clearSessionCookie(response);
      return response;
    }

    const token = createSessionToken({
      userId: matchedUser.id,
      email: matchedUser.email,
      role: matchedUser.role,
      name: matchedUser.name || userInfo?.name || matchedUser.email,
    });

    const redirectPath =
      matchedUser.role === "admin" || matchedUser.role === "superadmin" || matchedUser.role === "finance"
        ? "/dashboard/admin"
        : "/dashboard/warga";
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    applySessionCookie(response, token);
    clearGoogleStateCookie(response);
    return response;
  } catch {
    const response = loginErrorRedirect(request, "google_oauth_failed");
    clearGoogleStateCookie(response);
    clearSessionCookie(response);
    return response;
  }
}
