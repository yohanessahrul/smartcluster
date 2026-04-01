import { NextRequest } from "next/server";

function sanitizeBaseUrl(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveAppBaseUrl(request: NextRequest) {
  return (
    sanitizeBaseUrl(process.env.GOOGLE_OAUTH_BASE_URL) ||
    sanitizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    sanitizeBaseUrl(process.env.BETTER_AUTH_URL) ||
    request.nextUrl.origin
  );
}

export function resolveGoogleRedirectUri(request: NextRequest) {
  const fromEnv = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  return `${resolveAppBaseUrl(request)}/api/auth/google/callback`;
}

export function getGoogleOAuthConfig(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = resolveGoogleRedirectUri(request);
  return { clientId, clientSecret, redirectUri };
}
